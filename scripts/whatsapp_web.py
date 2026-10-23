"""Small local WhatsApp Web adapter used by ClientHunter.

The adapter deliberately works only with a persistent local browser profile and
only opens chats whose phone numbers were supplied by ClientHunter. It never
scans the general inbox or tries to bypass QR/login challenges.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import Page, sync_playwright


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8", errors="strict")


READY_SELECTORS = (
    '[data-testid="chat-list"]',
    '[aria-label="Chat list"]',
    '#pane-side',
)
LOGIN_TEXT = re.compile(r"to use whatsapp on your computer|используйте whatsapp на компьютере|qr code|qr-код", re.I)


class SafePreSendError(RuntimeError):
    """The current lead could not be sent to and no text reached Send."""


def output(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def parse_message_time(value: str) -> str | None:
    match = re.search(r"(\d{1,2}):(\d{2}),\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})", value or "")
    if not match:
        return None
    hour, minute, day, month, year = (int(part) for part in match.groups())
    if year < 100:
        year += 2000
    try:
        return datetime(year, month, day, hour, minute, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def page_text(page: Page) -> str:
    try:
        return page.locator("body").inner_text(timeout=2500)
    except Exception:
        return ""


def open_whatsapp(page: Page) -> None:
    if page.url.startswith("https://web.whatsapp.com"):
        page.wait_for_timeout(2500)
        return
    page.goto("https://web.whatsapp.com/", wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(2500)


def browser_status(page: Page) -> dict[str, Any]:
    text = page_text(page)
    for selector in READY_SELECTORS:
        if page.locator(selector).count() > 0:
            return {"status": "ready", "title": page.title(), "url": page.url}
    if LOGIN_TEXT.search(text) or page.locator("canvas").count() > 0:
        return {"status": "needs_login", "title": page.title(), "url": page.url}
    return {"status": "loading", "title": page.title(), "url": page.url}


def wait_for_browser_ready(page: Page, timeout_ms: int = 20_000) -> dict[str, Any]:
    """Wait for the existing WhatsApp Web tab to finish rendering."""
    deadline = time.monotonic() + timeout_ms / 1000
    state = browser_status(page)
    while state.get("status") == "loading" and time.monotonic() < deadline:
        page.wait_for_timeout(750)
        state = browser_status(page)
    return state


def debug_page(page: Page) -> dict[str, Any]:
    return {
        "url": page.url,
        "title": page.title(),
        "bodyText": page_text(page)[:1200],
        "readySelectors": {selector: page.locator(selector).count() for selector in READY_SELECTORS},
        "canvasCount": page.locator("canvas").count(),
        "contenteditableCount": page.locator('[contenteditable="true"]').count(),
        "footerContenteditableCount": page.locator('footer div[contenteditable="true"]').count(),
        "inputs": page.locator("input").evaluate_all("els => els.slice(0, 10).map(el => ({placeholder: el.placeholder || '', aria: el.getAttribute('aria-label') || '', value: el.value || ''}))"),
        "buttons": page.locator("button").evaluate_all("els => els.slice(0, 20).map(el => ({text: (el.innerText || '').trim(), aria: el.getAttribute('aria-label') || '', title: el.getAttribute('title') || ''}))"),
        "nameMatches": {
            "plain": page.get_by_text("Вы", exact=True).count(),
            "parenthesized": page.get_by_text("(Вы)", exact=True).count(),
            "contains": page.get_by_text("Вы", exact=False).count(),
        },
        "nameElements": page.locator("body *").evaluate_all("els => els.filter(el => (el.innerText || '').trim() === '(Вы)' || (el.innerText || '').trim() === 'Вы').slice(-12).map(el => ({tag: el.tagName, role: el.getAttribute('role') || '', testid: el.getAttribute('data-testid') || '', cls: el.className || '', html: el.outerHTML.slice(0, 500), ancestors: (() => { const out=[]; let cur=el; for (let i=0; cur && i<7; i++, cur=cur.parentElement) out.push({tag:cur.tagName, role:cur.getAttribute('role') || '', testid:cur.getAttribute('data-testid') || '', cls:cur.className || ''}); return out; })()}))"),
        "pages": len(page.context.pages),
    }


def find_search_input(page: Page):
    for selector in (
        'input[placeholder*="Search"]',
        'input[placeholder*="Поиск"]',
        'input[aria-label*="Search"]',
        'input[aria-label*="Поиск"]',
        'div[contenteditable="true"][data-tab="3"]',
        'div[role="textbox"]',
        'div[contenteditable="true"][aria-label*="Search"]',
        'div[contenteditable="true"][aria-label*="Поиск"]',
    ):
        locator = page.locator(selector).first
        if locator.count() > 0:
            return locator
    return None


def clear_search(page: Page) -> None:
    try:
        for index in range(page.locator("input").count()):
            input_item = page.locator("input").nth(index)
            if input_item.is_visible():
                input_item.click(force=True)
                input_item.fill("")
                input_item.press("Escape")
        page.keyboard.press("Escape")
    except Exception:
        pass
    try:
        close_button = page.get_by_role("button", name="Закрыть").first
        if close_button.count() > 0:
            close_button.click(timeout=1500, force=True)
    except Exception:
        pass
    try:
        all_tab = page.get_by_text("Все", exact=True).first
        if all_tab.count() > 0:
            all_tab.click(timeout=1500, force=True)
    except Exception:
        pass
    page.wait_for_timeout(1200)


def begin_search(page: Page):
    for selector in (
        '[data-testid="chat-list-search"]',
        '[aria-label*="Search"]',
        '[aria-label*="Поиск"]',
        'button[title*="Search"]',
        'button[title*="Поиск"]',
    ):
        button = page.locator(selector).first
        if button.count() > 0:
            try:
                button.click(timeout=1500)
                page.wait_for_timeout(300)
                break
            except Exception:
                continue
    return find_search_input(page)


def open_chat_by_phone_url(page: Page, phone: str) -> Page | None:
    """Open a CRM number even when it is not already present in the chat list."""
    try:
        # Navigate the already-authenticated WhatsApp Web tab directly. The
        # wa.me page opens a second tab and may leave Playwright attached to
        # the api.whatsapp.com landing page instead of the actual chat.
        page.goto(f"https://web.whatsapp.com/send/?phone={phone}", wait_until="domcontentloaded", timeout=30_000)
        active_page = page
        state = wait_for_browser_ready(active_page)
        if state.get("status") != "ready":
            return None
        compose = active_page.locator(
            'footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="Type a message"], div[contenteditable="true"][aria-label*="Введите сообщение"]'
        ).last
        compose.wait_for(state="visible", timeout=15_000)
        return active_page
    except Exception:
        return None


def open_known_chat(page: Page, target: dict[str, Any]) -> Page | None:
    phone = digits(str(target.get("phone", "")))
    if len(phone) < 8:
        return None
    # Navigate by the full normalized number. Chat-list name matching can
    # select a different business with a similar or duplicate display name.
    return open_chat_by_phone_url(page, phone)


def verify_opened_chat(page: Page, target: dict[str, Any]) -> None:
    """Fail closed unless WhatsApp exposes an identifiable active conversation."""
    phone = digits(str(target.get("phone", "")))
    name = str(target.get("name", "")).strip().lower()
    if len(phone) < 8:
        raise RuntimeError("Нельзя проверить чат без корректного номера лида.")

    header = page.locator('[data-testid="conversation-info-header-chat-title-name"]').first
    header.wait_for(state="visible", timeout=10_000)
    header_text = (header.inner_text(timeout=1500) or "").strip().lower()
    if not header_text:
        raise RuntimeError("WhatsApp Web не показал заголовок активного чата.")

    # Require proof for the exact number. A matching display name alone is
    # not enough to send to a CRM lead.
    url_phone = digits(parse_qs(urlparse(page.url).query).get("phone", [""])[0])
    exact_phone_in_chat = False
    try:
        chat_ids = page.locator("#main [data-id]").evaluate_all(
            "els => els.map(item => item.getAttribute('data-id') || '').join(' ')"
        )
        exact_phone_in_chat = any(
            match.group(1) == phone
            for match in re.finditer(r"(?:true_)?(\d{8,16})@(?:c\.us|s\.whatsapp\.net)", chat_ids, re.I)
        )
    except Exception:
        pass
    header_phone = digits(header_text)
    if len(header_phone) >= 8 and header_phone != phone:
        raise RuntimeError(f"В WhatsApp открыт номер {header_phone}, ожидался {phone}. Отправка остановлена.")
    if url_phone != phone and header_phone != phone and not exact_phone_in_chat:
        # WhatsApp now removes the phone query after opening a new chat and
        # message IDs no longer expose the contact JID. Confirm through the
        # read-only contact details drawer before allowing any message input.
        header.click(timeout=3000)
        drawer = page.locator('[data-testid="chat-info-drawer"]').first
        drawer.wait_for(state="visible", timeout=5000)
        drawer_phone = digits(drawer.inner_text(timeout=1500))
        page.keyboard.press("Escape")
        if phone not in drawer_phone:
            raise RuntimeError(f"Не удалось подтвердить точный номер {phone} в карточке WhatsApp для «{header_text}». Отправка остановлена.")

    compose = page.locator(
        'footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="Type a message"], div[contenteditable="true"][aria-label*="Введите сообщение"]'
    ).last
    compose.wait_for(state="visible", timeout=10_000)


def open_named_chat(page: Page, name: str) -> bool:
    target_name = name.strip().lower()
    if not target_name:
        return False
    if page.locator("#pane-side").count() > 0 and page.locator('[data-testid="chat-list"]').count() == 0:
        try:
            page.reload(wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(7000)
        except Exception:
            pass
    try:
        page.locator('[data-testid="chat-list"], [data-testid="you-label"]').first.wait_for(state="attached", timeout=20_000)
    except Exception:
        pass
    if target_name in {"вы", "you"}:
        # Do not clear the current chat before using the stable self-chat row.
        # WhatsApp can temporarily render an empty list while rebuilding search.
        current_chat = page.locator('[data-testid="conversation-info-header-chat-title-name"]').first
        compose = page.locator('footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="message" i], div[contenteditable="true"][aria-label*="сообщ" i]').last
        try:
            if current_chat.count() > 0 and current_chat.inner_text(timeout=1500).strip().lower() in {"вы", "you", "(вы)", "(you)"}:
                compose.wait_for(state="visible", timeout=10_000)
                return True
        except Exception:
            pass
        try:
            row = page.locator('[data-testid="message-yourself-row"]').first
            row.wait_for(state="attached", timeout=10_000)
            row.click(timeout=3000, force=True)
            compose.wait_for(state="visible", timeout=10_000)
            return True
        except Exception:
            pass
    try:
        clear_search(page)
        inputs = page.locator("input")
        for index in range(inputs.count()):
            try:
                input_item = inputs.nth(index)
                if input_item.is_visible():
                    input_item.evaluate("""el => {
                      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                      setter.call(el, '');
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    }""")
            except Exception:
                continue
        search_field = find_search_input(page)
        if search_field is not None:
            search_field.evaluate("""el => {
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
              if (setter && el instanceof HTMLInputElement) setter.call(el, '');
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }""")
            search_field.press("Escape")
        chat_tab = page.get_by_role("button", name="Чаты").first
        if chat_tab.count() > 0:
            chat_tab.click(timeout=1500, force=True)
        page.wait_for_timeout(400)
    except Exception:
        pass
    if target_name in {"вы", "you"}:
        current_chat = page.locator('[data-testid="conversation-info-header-chat-title-name"]').first
        try:
            if current_chat.count() > 0 and current_chat.inner_text(timeout=1500).strip().lower() in {"вы", "you", "(вы)", "(you)"}:
                compose = page.locator('footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="message" i], div[contenteditable="true"][aria-label*="сообщ" i]').last
                compose.wait_for(state="visible", timeout=10_000)
                return True
        except Exception:
            pass
        row = page.locator('[data-testid="message-yourself-row"]').first
        try:
            row.wait_for(state="attached", timeout=30_000)
        except Exception:
            pass
        if row.count() > 0:
            try:
                row.click(timeout=3000, force=True)
                compose = page.locator('footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="message" i], div[contenteditable="true"][aria-label*="сообщ" i]').last
                compose.wait_for(state="visible", timeout=10_000)
                return True
            except Exception:
                pass
    display_name = name.strip().capitalize()
    for visible_name in (name.strip(), display_name, f"({name.strip()})", f"({display_name})"):
        direct = page.get_by_text(visible_name, exact=True).last
        if direct.count() == 0:
            continue
        try:
            direct.click(timeout=2500, force=True)
            page.wait_for_timeout(2500)
            if page.locator('footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="message" i], div[contenteditable="true"][aria-label*="сообщ" i]').count() > 0:
                return True
        except Exception:
            continue
    search = begin_search(page)
    if search is None:
        return False
    try:
        search.fill(name.strip())
        page.wait_for_timeout(1200)
    except Exception:
        return False
    candidates = page.locator('[data-testid="cell-frame-container"], [role="listitem"], [role="gridcell"]')
    for index in range(min(candidates.count(), 30)):
        candidate = candidates.nth(index)
        try:
            content = candidate.inner_text(timeout=800).strip().lower()
        except Exception:
            continue
        if content.split("\n", 1)[0].strip() == target_name or target_name in content:
            try:
                candidate.click(timeout=1500)
                page.wait_for_timeout(700)
                return True
            except Exception:
                continue
    return False


def message_records(page: Page, target: dict[str, Any]) -> list[dict[str, Any]]:
    sent_at = str(target.get("sentAt") or "")
    known_ids = set(str(value) for value in target.get("knownMessageIds", []))
    records: list[dict[str, Any]] = []
    messages = page.locator('[data-pre-plain-text]')
    for index in range(max(0, messages.count() - 80), messages.count()):
        message = messages.nth(index)
        try:
            pre = message.get_attribute("data-pre-plain-text") or ""
            text = (message.inner_text(timeout=800) or "").strip()
            meta = message.evaluate(
                """(el) => {
                  const root = el.closest('[data-id]') || el;
                  return {
                    id: root.getAttribute('data-id') || '',
                    outgoing: Boolean(el.closest('.message-out') || el.closest('[data-testid="msg-container"]')?.classList.contains('message-out'))
                  };
                }"""
            )
        except Exception:
            continue
        if not text or bool(meta.get("outgoing")):
            continue
        message_id = str(meta.get("id") or "")
        parsed_timestamp = parse_message_time(pre)
        if sent_at and not parsed_timestamp:
            continue
        timestamp = parsed_timestamp or now_iso()
        if message_id and message_id in known_ids:
            continue
        if sent_at and timestamp < sent_at:
            continue
        if not message_id:
            message_id = "wa-web:" + hashlib.sha256(f"{target.get('phone')}|{timestamp}|{text}".encode("utf-8")).hexdigest()[:24]
        records.append({
            "messageId": message_id,
            "chatId": digits(str(target.get("phone", ""))),
            "text": text,
            "timestamp": timestamp,
        })
    return records


def check_incoming(page: Page, targets: list[dict[str, Any]]) -> dict[str, Any]:
    result: list[dict[str, Any]] = []
    skipped: list[str] = []
    for target in targets:
        try:
            chat_page = open_known_chat(page, target)
            if chat_page is None:
                skipped.append(str(target.get("leadId")))
                continue
            result.extend([{**record, "leadId": target.get("leadId")} for record in message_records(chat_page, target)])
        except Exception:
            skipped.append(str(target.get("leadId")))
    return {"messages": result, "skippedLeadIds": skipped}


def send_message(page: Page, target: dict[str, Any]) -> dict[str, Any]:
    chat_page = open_known_chat(page, target)
    if chat_page is None:
        raise SafePreSendError("Не удалось открыть известный чат WhatsApp Web по номеру лида.")
    try:
        verify_opened_chat(chat_page, target)
    except Exception as error:
        raise SafePreSendError(str(error)) from error
    text = str(target.get("text", "")).strip()
    if not text:
        raise SafePreSendError("Нельзя отправить пустое сообщение.")
    compose = None
    for selector in (
        'footer div[contenteditable="true"]',
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][aria-label*="Type a message"]',
        'div[contenteditable="true"][aria-label*="Введите сообщение"]',
    ):
        candidate = chat_page.locator(selector).last
        if candidate.count() > 0:
            compose = candidate
            break
    if compose is None:
        raise SafePreSendError("Поле сообщения WhatsApp Web не найдено.")
    if outgoing_message_exists(chat_page, text):
        raise RuntimeError("В активном чате уже есть исходящее сообщение с этим текстом; повторная отправка остановлена для ручной проверки.")
    try:
        compose.fill(text)
        entered_text = (compose.inner_text(timeout=1500) or "").strip()
    except Exception as error:
        raise SafePreSendError(f"Не удалось подготовить поле сообщения WhatsApp: {error}") from error
    if entered_text != text:
        try:
            compose.fill("")
        except Exception:
            pass
        raise SafePreSendError("WhatsApp Web не подтвердил точный текст перед отправкой.")
    compose.press("Enter")
    observed = confirm_outgoing_message(chat_page, text)
    if observed.get("deliveryStatus") == "failed":
        raise RuntimeError("Исходящее сообщение видно, но WhatsApp показывает ошибку отправки. CRM не обновлена; проверьте чат вручную, автоматического повтора не будет.")
    if observed.get("deliveryStatus") == "pending":
        raise RuntimeError("Исходящее сообщение пока не получило отметку отправки WhatsApp. Результат неопределён; CRM не обновлена, повтор заблокирован.")
    sent_at = now_iso()
    message_id = observed.get("messageId") or "wa-web:" + hashlib.sha256(f"{target.get('phone')}|{sent_at}|{text}".encode("utf-8")).hexdigest()[:24]
    return {"messageId": message_id, "sentAt": sent_at, "deliveryStatus": observed.get("deliveryStatus", "sent")}


def prepare_message(page: Page, target: dict[str, Any]) -> dict[str, Any]:
    """Open and fill a specific test chat without pressing Send."""
    chat_page = open_known_chat(page, target)
    if chat_page is None:
        raise RuntimeError("Не удалось открыть тестовый чат WhatsApp Web по номеру.")
    verify_opened_chat(chat_page, target)
    text = str(target.get("text", "")).strip()
    if not text:
        raise RuntimeError("Нельзя подготовить пустое тестовое сообщение.")
    if outgoing_message_exists(chat_page, text):
        raise RuntimeError("В тестовом чате уже есть исходящее сообщение с этим текстом; повторная отправка остановлена.")
    compose = chat_page.locator(
        'footer div[contenteditable="true"], div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][aria-label*="Type a message"], div[contenteditable="true"][aria-label*="Введите сообщение"]'
    ).last
    compose.fill(text)
    entered = (compose.inner_text(timeout=1500) or "").strip()
    if entered != text:
        raise RuntimeError("WhatsApp Web не подтвердил точный текст тестового сообщения.")
    header = chat_page.locator('[data-testid="conversation-info-header-chat-title-name"]').first.inner_text(timeout=1500)
    return {"prepared": True, "header": header, "enteredExactly": True}


def send_current_message(page: Page, target: dict[str, Any]) -> dict[str, Any]:
    text = str(target.get("text", "")).strip()
    if not text:
        raise RuntimeError("Нельзя отправить пустое сообщение.")
    compose = None
    for selector in (
        'footer div[contenteditable="true"]',
        'div[contenteditable="true"][data-tab="10"]',
        'div[contenteditable="true"][aria-label*="Type a message"]',
        'div[contenteditable="true"][aria-label*="Введите сообщение"]',
    ):
        candidate = page.locator(selector).last
        if candidate.count() > 0:
            compose = candidate
            break
    if compose is None:
        raise RuntimeError("Поле сообщения WhatsApp Web не найдено.")
    compose.fill(text)
    compose.press("Enter")
    confirm_outgoing_message(page, text)
    sent_at = now_iso()
    message_id = "wa-web:" + hashlib.sha256(f"test|{sent_at}|{text}".encode("utf-8")).hexdigest()[:24]
    return {"messageId": message_id, "sentAt": sent_at}


def confirm_outgoing_message(page: Page, text: str) -> dict[str, str]:
    """Require an outgoing message and report its separate delivery indicator."""
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        observed = find_outgoing_message(page, text)
        if observed:
            return observed
        page.wait_for_timeout(250)
    raise RuntimeError("WhatsApp Web не подтвердил появление исходящего сообщения в чате.")


def find_outgoing_message(page: Page, text: str) -> dict[str, str] | None:
    expected = text.strip()
    if not expected:
        return None
    try:
        matches = page.locator('[data-testid^="conv-msg-"], [data-pre-plain-text]').filter(has_text=expected)
        for index in range(matches.count() - 1, -1, -1):
            message = matches.nth(index)
            body = message.inner_text(timeout=1000) or ""
            if expected not in body:
                continue
            meta = message.evaluate("""el => {
              const root = el.closest('[data-id]') || el;
              const icons = Array.from(root.querySelectorAll('[data-icon]')).map(icon => icon.getAttribute('data-icon') || '');
              const classes = [root, root.parentElement, root.parentElement?.parentElement].filter(Boolean).map(item => String(item.className || '')).join(' ');
              return {
                id: root.getAttribute('data-id') || '',
                icons: icons.join(' '),
                outgoing: /(?:^|\\s)message-out(?:\\s|$)/.test(classes) || icons.some(icon => /^(?:tail-out|msg-(?:dblcheck(?:-ack)?|check|time|error))$/.test(icon))
              };
            }""")
            if not meta.get("outgoing"):
                continue
            icons = str(meta.get("icons", ""))
            delivery_status = "sent"
            if "msg-error" in icons:
                delivery_status = "failed"
            elif "msg-dblcheck-ack" in icons:
                delivery_status = "read"
            elif "msg-dblcheck" in icons:
                delivery_status = "delivered"
            elif "msg-time" in icons:
                delivery_status = "pending"
            return {"messageId": str(meta.get("id") or ""), "deliveryStatus": delivery_status}
    except Exception:
        pass
    return None


def outgoing_message_exists(page: Page, text: str) -> bool:
    expected = text.strip()
    if not expected:
        return False
    try:
        matches = page.locator('[data-testid^="conv-msg-"], [data-pre-plain-text]').filter(has_text=expected)
        for index in range(matches.count() - 1, -1, -1):
            message = matches.nth(index)
            if expected not in (message.inner_text(timeout=1000) or ""):
                continue
            outgoing = message.evaluate("""el => {
              const root = el.closest('[data-id]') || el;
              const icons = Array.from(root.querySelectorAll('[data-icon]')).map(icon => icon.getAttribute('data-icon') || '');
              const classes = [root, root.parentElement, root.parentElement?.parentElement].filter(Boolean).map(item => String(item.className || '')).join(' ');
              return /(?:^|\\s)message-out(?:\\s|$)/.test(classes) || icons.some(icon => /^(?:tail-out|msg-(?:dblcheck(?:-ack)?|check|time|error))$/.test(icon));
            }""")
            if outgoing:
                return True
    except Exception:
        pass
    return False


def launch_context(playwright, profile_dir: Path):
    profile_dir.mkdir(parents=True, exist_ok=True)
    return playwright.chromium.launch_persistent_context(
        str(profile_dir),
        headless=False,
        locale="ru-RU",
        viewport={"width": 1440, "height": 960},
        args=["--disable-blink-features=AutomationControlled"],
    )


def handle_payload(context, payload: dict[str, Any]) -> dict[str, Any]:
    pages = list(context.pages)
    page = next((candidate for candidate in reversed(pages) if candidate.url.startswith("https://web.whatsapp.com")), None)
    page = page or (pages[-1] if pages else context.new_page())
    action = str(payload.get("action", "status"))
    if action == "close":
        return {"ok": True, "status": "disconnected"}
    if action == "send-current-test":
        try:
            open_whatsapp(page)
            state = wait_for_browser_ready(page)
            if state.get("status") != "ready":
                return {"ok": False, **state, "error": "WhatsApp Web ещё не готов к отправке."}
            return {"ok": True, **state, **send_current_message(page, payload)}
        except PlaywrightTimeoutError as error:
            return {"ok": False, "status": "error", "error": f"WhatsApp Web не ответил вовремя: {error}"}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    if action == "send-self-test":
        try:
            open_whatsapp(page)
            state = wait_for_browser_ready(page)
            if state.get("status") != "ready":
                return {"ok": False, **state, "error": "WhatsApp Web ещё не готов к отправке."}
            if not open_named_chat(page, "\u0412\u044b"):
                raise RuntimeError("Не удалось открыть выбранный тестовый чат в текущей сессии WhatsApp Web.")
            test_payload = {**payload, "text": "\u0422\u0435\u0441\u0442 ClientHunter. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435, \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043b\u044e\u0431\u043e\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435."}
            return {"ok": True, **state, **send_current_message(page, test_payload)}
        except PlaywrightTimeoutError as error:
            return {"ok": False, "status": "error", "error": f"WhatsApp Web не ответил вовремя: {error}"}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    if action == "debug-current":
        try:
            return {"ok": True, **browser_status(page), **debug_page(page)}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    if action == "prepare-test":
        try:
            open_whatsapp(page)
            state = wait_for_browser_ready(page)
            if state.get("status") != "ready":
                return {"ok": False, **state, "error": "WhatsApp Web ещё не авторизован."}
            result = prepare_message(page, {
                "phone": payload.get("phone", ""),
                "name": payload.get("name", ""),
                "text": payload.get("text", ""),
            })
            return {"ok": True, **state, **result}
        except PlaywrightTimeoutError as error:
            return {"ok": False, "status": "error", "error": f"WhatsApp Web не ответил вовремя: {error}"}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    if action == "debug-open":
        try:
            open_whatsapp(page)
            state = wait_for_browser_ready(page)
            opened = open_named_chat(page, str(payload.get("name", "")))
            return {"ok": True, "opened": opened, **state, **debug_page(page)}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    if action == "debug-click-you":
        try:
            open_whatsapp(page)
            state = wait_for_browser_ready(page)
            if state.get("status") != "ready":
                return {"ok": False, **state, "error": "WhatsApp Web ещё не готов к открытию чата."}
            clear_search(page)
            page.locator('[data-testid="message-yourself-row"]').first.wait_for(state="attached", timeout=20_000)
            page.locator('[data-testid="message-yourself-row"]').first.click(timeout=3000, force=True)
            page.wait_for_timeout(2500)
            return {"ok": True, **browser_status(page), **debug_page(page)}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error), **debug_page(page)}
    if action == "clear-search":
        try:
            clear_search(page)
            return {"ok": True, **browser_status(page), **debug_page(page)}
        except Exception as error:
            return {"ok": False, "status": "error", "error": str(error)}
    try:
        open_whatsapp(page)
        state = wait_for_browser_ready(page)
        if action == "status":
            return {"ok": True, **state}
        if action == "send-test":
            if not open_named_chat(page, str(payload.get("name", ""))):
                raise RuntimeError("Не удалось открыть выбранный тестовый чат в текущей сессии WhatsApp Web.")
            return {"ok": True, **state, **send_current_message(page, payload)}
        if state.get("status") != "ready":
            return {"ok": False, **state, "error": "WhatsApp Web ещё не авторизован. Откройте QR-код в локальном окне браузера."}
        if action == "check":
            return {"ok": True, **state, **check_incoming(page, list(payload.get("targets", [])))}
        if action == "send":
            return {"ok": True, **state, **send_message(page, payload)}
        return {"ok": False, "error": f"Неизвестное действие: {action}"}
    except SafePreSendError as error:
        return {"ok": False, "status": browser_status(page).get("status", "error"), "error": str(error), "safeToSkip": True}
    except PlaywrightTimeoutError as error:
        return {"ok": False, "status": "error", "error": f"WhatsApp Web не ответил вовремя: {error}"}
    except Exception as error:
        return {"ok": False, "status": "error", "error": str(error)}


def serve(profile_dir: Path) -> None:
    with sync_playwright() as playwright:
        context = launch_context(playwright, profile_dir)
        try:
            for line in sys.stdin:
                if not line.strip():
                    continue
                request = json.loads(line)
                result = handle_payload(context, request)
                output({"requestId": request.get("requestId"), **result})
                if request.get("action") == "close":
                    break
        finally:
            context.close()


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--server":
        serve(Path(sys.argv[2]).resolve())
        return
    if len(sys.argv) != 2:
        output({"ok": False, "error": "Ожидался JSON payload."})
        return
    payload = json.loads(sys.argv[1])
    profile_dir = Path(str(payload.get("profileDir", "runtime/whatsapp-profile"))).resolve()
    with sync_playwright() as playwright:
        context = launch_context(playwright, profile_dir)
        try:
            output(handle_payload(context, payload))
        finally:
            context.close()


if __name__ == "__main__":
    main()
