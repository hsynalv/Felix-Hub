# Notifications Plugin

System notifications via **native OS** (macOS/Linux/Windows) and **Telegram** (Bot API).

## REST Endpoints

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| POST | `/notifications/show` | write | Native OS notification |
| POST | `/notifications/send` | write | Send via `native`, `telegram`, or `auto` |
| GET | `/notifications/channels` | read | List channels and config status |
| POST | `/notifications/sound` | write | Play system sound |
| GET | `/notifications/history` | read | Recent notifications |
| GET | `/notifications/os` | read | OS / channel info |
| POST | `/notifications/telegram/webhook` | public* | Telegram bot webhook |

\* Webhook protected by `TELEGRAM_WEBHOOK_SECRET` header when set.

## MCP Tools

- `notifications_send` — unified send (`channel`: native | telegram | auto)
- `notifications_list_channels` — channel list
- `notification_show` — native only (backward compat)
- `notification_sound`, `notification_task_complete`, `notification_error`, `notification_history`

## Telegram configuration

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_ALLOWED_CHAT_IDS=12345,67890   # required for agent bot
TELEGRAM_WEBHOOK_SECRET=random_secret   # optional webhook header
TELEGRAM_POLLING=true                   # dev: long polling (no HTTPS)
TELEGRAM_NOTIFY_UI_TOKEN=true           # also send UI tokens to Telegram
TELEGRAM_RATE_LIMIT_PER_MIN=10
```

Keys can be set via Settings UI (Faz 4) with hot reload.

## Telegram agent commands

- `/start`, `/help`, `/tools`, `/ask <question>`
- Free text is treated as a chat message (read-only tools; write tools blocked)

## Deploy webhook (production)

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-host/notifications/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

For local dev without HTTPS, set `TELEGRAM_POLLING=true`.
