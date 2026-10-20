# LeadScout

LeadScout — локальный инструмент для поиска потенциальных клиентов через публичные карточки 2GIS: компаний с публичным телефоном и без собственного сайта.

> LeadScout не обходит CAPTCHA. Если 2GIS просит проверку, пройдите её вручную в открытом Chromium.

## Возможности

- Реальный поиск 2GIS через Playwright, несколько категорий и Select All.
- Реальные телефоны, сайт и WhatsApp только при явной ссылке в карточке.
- Фильтр «без сайта + есть телефон», SQLite persistence, дедупликация, progress и cancellation.
- CRM statuses, notes и CSV/XLSX export.
- Автономная очередь обычного WhatsApp Web с persistent-профилем, без Cloud API и без ИИ-сервиса во время отправки подготовленных сообщений.

## Требования

- Node.js 22+ (используется `node:sqlite`), npm.
- Python 3.10+.
- Chromium для Python Playwright.

## Установка в Windows

### Скачать проект

```powershell
git clone https://github.com/akaiboldiyev/ClientHunter.git
cd ClientHunter
```

Либо выберите **Code → Download ZIP**, распакуйте архив и откройте PowerShell в папке.

### Быстрый старт

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
.\start.ps1
```

### Ручная установка

```powershell
npm install
python -m pip install -r requirements.txt
python -m playwright install chromium
Copy-Item .env.example .env
npm run dev
```

`start.ps1` сначала собирает приложение, затем запускает сервер ClientHunter отдельным фоновым процессом и открывает http://localhost:3000. После этого можно закрыть PowerShell или Codex: сервер и очередь остаются активны, пока работает компьютер и сам процесс ClientHunter. При следующей перезагрузке Windows запуск не выполняется автоматически — снова запустите `./start.ps1`.

Default provider — `TWOGIS_PROVIDER=playwright`; API key не нужен. В разделе Automation подключите обычный WhatsApp Web: первый запуск требует ручного QR-входа в локальном окне. Профиль сохраняется в `runtime/whatsapp-profile`; автономная очередь берёт подготовленных или одобренных лидов с доступным WhatsApp, корректным номером и непустым `customPitch`. Повторные номера, уже отправленные, с неопределённым результатом, закрытые, взятые вручную и ошибочные лиды исключаются. Интервал выбирается от 1 до 3600 секунд (по умолчанию 5). После перезапуска ClientHunter очередь выключена до явного нажатия «Запустить».

Открытие чата не фиксирует отправку: перед отправкой проверяется точный номер чата, а первичное сообщение попадает в CRM и историю только после появления в исходящих WhatsApp Web. Это подтверждает отправку, но не доставку. Если WhatsApp показывает доступный статус доставки или прочтения, он записывается отдельно. При закрытом браузере, потере сессии или неопределённом результате отправки очередь останавливается без повтора и показывает ошибку; статус `contacted` не выставляется.

## Первый поиск

1. Укажите город, например `Актау`.
2. Выберите категории и лимит на весь запуск.
3. Нажмите поиск. Chromium откроется автоматически; не закрывайте его во время работы.
4. При CAPTCHA пройдите проверку вручную.
5. Используйте фильтр «без сайта + есть телефон».

## Данные и экспорт

Лиды хранятся локально в `runtime/leadscout.sqlite`, остаются между перезапусками и не попадают в Git. Кнопки Excel/CSV скачивают export через браузер в обычную папку Downloads.

## Troubleshooting

### Port 3000 already in use

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Chromium не установлен

```powershell
python -m playwright install chromium
```

### Python command not found

Установите Python 3.10+ с опцией **Add Python to PATH**, затем откройте новый PowerShell.

### CAPTCHA или временная ошибка 2GIS

Пройдите проверку в Chromium или повторите поиск позже. LeadScout не создаёт подменённые результаты.

## Development

```powershell
npm run lint
npm test
npm run test:providers
npm run build
```

`server.ts` — HTTP API; `src/` — React UI; `scrapers/two_gis.py` — Playwright provider; `persistence.ts` — SQLite; `src/utils/leadData.ts` — normalization/deduplication.
