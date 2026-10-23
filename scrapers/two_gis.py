"""Normal Playwright provider for publicly visible 2GIS company data.

This module deliberately does not bypass CAPTCHA, browser checks, rate limits, or
access controls. It emits JSON for the Node server and never fabricates contacts.
"""
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _provider_id(url: str) -> str | None:
    match = re.search(r"/(?:firm|geo)/(\d+)", url)
    return match.group(1) if match else None


_TRANSLIT = str.maketrans({
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"shch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
})


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().translate(_TRANSLIT)).strip("-")


def _number(text: str) -> float:
    match = re.search(r"\b([0-5](?:[.,]\d)?)\b\s*\n(?:Подтвержд|2GIS Awards|\(\d)", text, re.I)
    if not match:
        match = re.search(r"\b([0-5][.,]\d)\b", text)
    return float(match.group(1).replace(",", ".")) if match else 0


def _reviews(text: str) -> int:
    match = re.search(r"\b[0-5](?:[.,]\d)?\b(?:\s*\n[^\n]{0,50})?\s*\n\((\d[\d \u00a0]*)\)", text)
    if not match:
        match = re.search(r"(\d[\d \u00a0]*)[ \u00a0]*(?:отзыв|оцен)", text, re.I)
    return int(match.group(1).replace(" ", "").replace("\u00a0", "")) if match else 0


def _is_blocked(text: str) -> bool:
    lower = text.lower()
    return any(value in lower for value in ("captcha", "капча", "automated access", "доступ ограничен"))


def _event(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def search(city: str, category: str, max_results: int = 10) -> dict:
    search_url = f"https://2gis.ru/{_slug(city)}/search/{_slug(category)}"
    items: list[dict] = []
    opened_cards = 0
    total_available = 0

    with sync_playwright() as playwright:
        profile = Path("runtime/2gis-profile").resolve()
        profile.mkdir(parents=True, exist_ok=True)
        context = playwright.chromium.launch_persistent_context(str(profile), headless=False, locale="ru-RU")
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(search_url, wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(2_000)
            body = page.locator("body").inner_text(timeout=5_000)
            total_match = re.search(r"Места\s*(\d+)", body)
            total_available = int(total_match.group(1)) if total_match else 0
            if "captcha.2gis.ru" in page.url or _is_blocked(body):
                _event({"event": "verification_required"})
                deadline = time.monotonic() + 300
                while time.monotonic() < deadline:
                    time.sleep(1)
                    if "captcha.2gis.ru" not in page.url and "2gis.ru" in page.url:
                        page.wait_for_timeout(1_000)
                        break
                else:
                    return {"verificationRequired": True, "items": [], "openedCards": 0, "total": total_available}

            # Cookie consent is a normal first-party interaction, not a bypass.
            try:
                consent = page.get_by_role("button", name=re.compile("понятно|ok", re.I)).first
                if consent.is_visible(timeout=700):
                    consent.click()
            except PlaywrightTimeoutError:
                pass

            links: list[tuple[str, str]] = []
            seen: set[str] = set()
            no_new_links = 0
            # 2GIS virtualizes the result list.  Collect each visible window and
            # scroll its actual overflow container, rather than relying on CSS classes.
            for _ in range(24):
                anchors = page.locator('a[href*="/firm/"], a[href*="/geo/"]')
                before = len(links)
                for index in range(anchors.count()):
                    anchor = anchors.nth(index)
                    href = (anchor.get_attribute("href") or "").strip()
                    label = (anchor.get_attribute("aria-label") or anchor.get_attribute("title") or anchor.inner_text() or "").strip()
                    full_url = href if href.startswith("http") else f"https://2gis.ru{href}"
                    provider_id = _provider_id(full_url)
                    if not provider_id or provider_id in seen or len(label) < 2:
                        continue
                    seen.add(provider_id)
                    links.append((full_url, label))
                    if len(links) >= max_results:
                        break
                if len(links) >= max_results:
                    break
                no_new_links = no_new_links + 1 if len(links) == before else 0
                reached_end = page.evaluate("""() => {
                    const candidates = [...document.querySelectorAll('div, main')]
                      .filter((element) => {
                        const style = getComputedStyle(element);
                        return element.scrollHeight > element.clientHeight + 100
                          && /(auto|scroll)/.test(style.overflowY);
                      })
                      .sort((left, right) => (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight));
                    const container = candidates[0];
                    if (!container) { window.scrollBy(0, 1200); return false; }
                    const previous = container.scrollTop;
                    container.scrollBy(0, Math.max(container.clientHeight * 0.8, 700));
                    return container.scrollTop === previous || container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
                }""")
                page.wait_for_timeout(500)
                if reached_end and no_new_links >= 2:
                    break

            # The public list exposes regular numbered pagination after its first
            # result window.  Follow it as a normal user interaction when needed.
            if len(links) < max_results:
                try:
                    second_page = page.get_by_role("link", name="2", exact=True).first
                    if second_page.is_visible(timeout=700):
                        second_page.click()
                        page.wait_for_timeout(1_200)
                        anchors = page.locator('a[href*="/firm/"], a[href*="/geo/"]')
                        for index in range(anchors.count()):
                            anchor = anchors.nth(index)
                            href = (anchor.get_attribute("href") or "").strip()
                            label = (anchor.get_attribute("aria-label") or anchor.get_attribute("title") or anchor.inner_text() or "").strip()
                            full_url = href if href.startswith("http") else f"https://2gis.ru{href}"
                            provider_id = _provider_id(full_url)
                            if not provider_id or provider_id in seen or len(label) < 2:
                                continue
                            seen.add(provider_id)
                            links.append((full_url, label))
                            if len(links) >= max_results:
                                break
                except PlaywrightTimeoutError:
                    pass

            if not links:
                return {"error": "Не удалось загрузить результаты 2GIS", "items": [], "openedCards": 0, "total": total_available}

            for company_url, label in links:
                if len(items) >= max_results:
                    break
                opened_cards += 1
                page.goto(company_url, wait_until="domcontentloaded", timeout=30_000)
                page.wait_for_timeout(700)
                detail_text = page.locator("body").inner_text(timeout=5_000)
                if _is_blocked(detail_text):
                    return {"providerBlocked": True, "items": items, "openedCards": opened_cards, "total": total_available}

                # When 2GIS presents its normal "show phone" action, use it once.
                try:
                    reveal_phone = page.get_by_role("button", name=re.compile("показать телефон", re.I)).first
                    if reveal_phone.is_visible(timeout=500):
                        reveal_phone.click()
                        page.wait_for_timeout(400)
                except PlaywrightTimeoutError:
                    pass

                hrefs = page.locator("a[href]")
                phones: list[str] = []
                external_links: list[str] = []
                website = ""
                social_names: list[str] = []
                whatsapp_explicit = False
                for link_index in range(hrefs.count()):
                    anchor = hrefs.nth(link_index)
                    href = (anchor.get_attribute("href") or "").strip()
                    label_text = (anchor.inner_text() or "").strip().lower()
                    if href.startswith("tel:"):
                        phone = href.removeprefix("tel:").strip()
                        if phone and phone not in phones:
                            phones.append(phone)
                    elif href.startswith("http"):
                        host = (urlparse(href).hostname or "").lower()
                        if "2gis" not in host and host not in {"redirect.2gis.com", "link.2gis.com"} and href not in external_links:
                            external_links.append(href)
                    if label_text in {"instagram", "facebook", "tiktok", "telegram"} and label_text not in social_names:
                        social_names.append(label_text)
                    if "whatsapp" in label_text:
                        whatsapp_explicit = True
                    domain = re.fullmatch(r"(?:https?://)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:/[^\s]*)?", label_text, re.I)
                    if domain and not website and not re.search(r"(?:instagram|facebook|tiktok|telegram|whatsapp|wa\.me)", label_text, re.I):
                        website = label_text if label_text.startswith("http") else f"https://{label_text}"

                name = label
                try:
                    heading = page.locator("h1").first.inner_text(timeout=700).strip()
                    if heading:
                        name = heading
                except PlaywrightTimeoutError:
                    pass
                address = ""
                for selector in ('[data-item="address"]', 'a[href^="geo:"]', 'a[href*="/geo/"]', 'button[data-item-id^="address:"]'):
                    try:
                        value = page.locator(selector).first.inner_text(timeout=400).strip()
                        if value:
                            address = value
                            break
                    except PlaywrightTimeoutError:
                        continue
                if not address:
                    address_match = re.search(r"([^\n]+)\n([^\n]+)\nПоказать вход", detail_text)
                    if address_match:
                        address = ", ".join(part.replace("\u200b", "").strip() for part in address_match.groups())
                items.append({
                    "providerId": _provider_id(company_url), "name": name, "address": address,
                    "rating": _number(detail_text), "reviews": _reviews(detail_text), "phones": phones,
                    "links": external_links, "website": website, "socials": social_names,
                    "whatsappExplicit": whatsapp_explicit, "url": company_url.split("?", 1)[0],
                })
                # One durable unit of work: the Node server persists this event
                # before requesting the next public card. This is deliberately
                # gradual and preserves results on cancellation or CAPTCHA.
                _event({"event": "lead", "item": items[-1], "openedCards": opened_cards, "total": total_available})
            return {"providerBlocked": False, "items": items, "openedCards": opened_cards, "total": total_available}
        finally:
            context.close()


if __name__ == "__main__":
    try:
        city, category = sys.argv[1], sys.argv[2]
        maximum = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        _event({"event": "started"})
        _event({"event": "complete", "result": search(city, category, maximum)})
    except Exception as error:
        print(json.dumps({"error": "2GIS Playwright provider failed", "detail": str(error)}, ensure_ascii=False))
        sys.exit(1)
