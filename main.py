import re
from dataclasses import dataclass, asdict
from pathlib import Path

import pandas as pd
from playwright.sync_api import sync_playwright


@dataclass
class Business:
    name: str = ""
    phone: str = ""
    address: str = ""
    website: str = ""
    rating: float = 0.0
    reviews: int = 0
    maps_url: str = ""


def close_dialogs(page):
    for attempt in range(5):
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except:
            pass


def handle_consent(page):
    """Обнаружить и закрыть окно согласия Google (cookie consent).

    Работает как с полноэкранным редиректом на consent.google.com,
    так и с модальным оверлеем поверх Google Maps.
    """
    page.wait_for_timeout(3000)

    def _try_texts(texts: list[str]) -> bool:
        for t in texts:
            try:
                btn = page.locator(f"button:has-text('{t}')").first
                if btn.is_visible(timeout=500):
                    btn.click()
                    return True
            except:
                try:
                    btn = page.locator(f'div[role="button"]:has-text("{t}")').first
                    if btn.is_visible(timeout=500):
                        btn.click()
                        return True
                except:
                    continue
        return False

    # 1. Пытаемся нажать "Принять все" / "Accept all"
    if _try_texts(["Принять все", "Accept all", "I agree", "Согласен", "Принять", "Accept", "Accept all cookies"]):
        page.wait_for_timeout(2000)
        return True

    # 2. Если нет — "Отклонить все"
    if _try_texts(["Отклонить все", "Reject all", "Отклонить", "Reject", "Decline"]):
        page.wait_for_timeout(2000)
        return True

    # 3. Если мы на странице consent.google.com — ищем любую кнопку
    if "consent" in page.url.lower():
        try:
            any_btn = page.locator("button").first
            if any_btn.is_visible(timeout=2000):
                any_btn.click()
                page.wait_for_timeout(3000)
                return True
        except:
            pass

    return False


def scrape(city: str, category: str) -> list[Business]:
    print(f"\n--- {city} / {category} ---")
    businesses: list[Business] = []
    seen_names: set[str] = set()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = browser.new_page(
            locale="ru-RU",
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )

        # 1. Open Google Maps
        page.goto("https://www.google.com/maps", wait_until="networkidle")
        page.wait_for_timeout(3000)

        # 2. Handle cookie consent dialog
        handle_consent(page)

        # 3. Если нас редиректнуло на consent-страницу — ждём возврата
        if "consent" in page.url.lower():
            try:
                page.wait_for_url("**/maps/**", timeout=30000)
                page.wait_for_timeout(2000)
            except Exception:
                print("  [!] Не удалось пройти consent-страницу")

        # 4. Search
        print("CURRENT URL:", page.url)
        page.screenshot(path="debug.png")

        search_selectors = [
            "#searchboxinput",
            'input[aria-label*="Search"]',
            'input[aria-label*="Поиск"]',
            'input[placeholder*="Search"]',
            'input[placeholder*="Поиск"]',
            'textarea[aria-label*="Search"]',
            'textarea[aria-label*="Поиск"]',
            '[name="q"]',
        ]

        search_box = None
        for sel in search_selectors:
            try:
                candidate = page.locator(sel).first
                if candidate.is_visible(timeout=2000):
                    search_box = candidate
                    print(f"  Поле поиска найдено: {sel}")
                    break
            except:
                continue

        if search_box is None:
            print("  [!] Поле поиска не найдено ни по одному селектору")
            page.screenshot(path="debug_no_input.png")
            browser.close()
            return businesses

        search_box.click()
        page.wait_for_timeout(500)
        search_box.fill(f"{city} {category}")
        page.keyboard.press("Enter")
        print("  Запрос отправлен")
        page.wait_for_timeout(5000)

        # 5. Scroll feed to load more results
        print("  Loading more results...")
        for _ in range(60):
            page.evaluate(
                "document.querySelector('div[role=\"feed\"]')?.scrollBy(0, 10000)"
            )
            page.wait_for_timeout(500)
        page.wait_for_timeout(2000)

        # 6. Get result links from the feed
        items = page.locator('div[role="feed"] a[href*="maps/place"]')
        total = items.count()
        print(f"  Found {total} results")

        for i in range(total):
            try:
                item = items.nth(i)
                href = (item.get_attribute("href") or "").strip()
                name = (item.get_attribute("aria-label") or "").strip()

                if not name or name in seen_names:
                    continue
                seen_names.add(name)

                # Close any open panel before clicking next
                close_dialogs(page)

                item.click()
                page.wait_for_timeout(1500)

                biz = Business(name=name, maps_url=href)

                # Rating
                try:
                    t = page.locator("div.fontHeadlineSmall").first.text_content(
                        timeout=2000
                    )
                    if t:
                        biz.rating = float(t.strip().replace(",", "."))
                except:
                    pass

                # Reviews
                try:
                    t = page.locator('button:has-text("отзыв")').first.text_content(
                        timeout=2000
                    )
                    if t:
                        m = re.search(r"([\d\s]+)", t)
                        if m:
                            biz.reviews = int(m.group(1).strip().replace(" ", ""))
                except:
                    pass

                # Phone
                try:
                    pid = page.locator(
                        'button[data-item-id^="phone:"]'
                    ).first.get_attribute("data-item-id", timeout=2000)
                    if pid:
                        biz.phone = pid.replace("phone:", "").strip()
                except:
                    pass

                # Website (primary method)
                try:
                    w = page.locator(
                        'a[data-item-id^="authority:"]'
                    ).first.get_attribute("href", timeout=2000)
                    if w and "google.com" not in w:
                        biz.website = w.strip()
                except:
                    pass

                # Website (fallback — any external link in the panel)
                if not biz.website:
                    try:
                        panel_links = page.locator("div[role='main'] a[href^='http']")
                        for j in range(panel_links.count()):
                            w = panel_links.nth(j).get_attribute("href")
                            if (
                                w
                                and "google.com" not in w
                                and "maps" not in w
                                and "g.co" not in w
                            ):
                                biz.website = w.strip()
                                break
                    except:
                        pass

                # Address
                try:
                    a = page.locator(
                        'button[data-item-id^="address:"]'
                    ).first.get_attribute("aria-label", timeout=2000)
                    if a:
                        biz.address = a.strip()
                except:
                    try:
                        a = page.locator(
                            '[data-item-id^="address:"]'
                        ).first.text_content(timeout=1000)
                        if a:
                            biz.address = a.strip()
                    except:
                        pass

                if not biz.website:
                    businesses.append(biz)
                    line = f"    [{len(businesses)}] {biz.name}"
                    if biz.phone:
                        line += f" | {biz.phone}"
                    print(line)

                if (i + 1) % 20 == 0:
                    print(f"  Progress: {i+1}/{total}")

            except Exception as e:
                if (i + 1) % 10 == 0:
                    print(f"  [!] Skip #{i}: {e}")
                continue

        browser.close()

    return businesses


def main():
    print("=" * 55)
    print("  Google Maps Business Scraper")
    print("  Поиск компаний без сайта")
    print("=" * 55)

    city = input("Город: ").strip() or "Актау"
    raw = input("Категории (через запятую): ").strip() or "стоматология"
    categories = [c.strip() for c in raw.split(",") if c.strip()]

    all_results: list[Business] = []
    for cat in categories:
        results = scrape(city, cat)
        all_results.extend(results)

    if not all_results:
        print("\nКомпании без сайта не найдены.")
        return

    df = pd.DataFrame([asdict(b) for b in all_results])
    df = df.drop_duplicates(subset=["name", "phone"], keep="first")

    out = Path("results.xlsx")
    df.to_excel(out, index=False, engine="openpyxl")

    total_raw = len(all_results)
    total_dedup = len(df)

    print("\n" + "=" * 55)
    print(f"  Найдено компаний без сайта: {total_raw}")
    print(f"  После удаления дубликатов:  {total_dedup}")
    print(f"  Файл:                       {out.resolve()}")
    print("=" * 55)

    if total_dedup > 0:
        print("\nПервые 10 записей:")
        print(df.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
