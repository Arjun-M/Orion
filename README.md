<h1 align="center">Orion — The Hunter</h1>

<p align="center">
  <img src="assets/banner.png" alt="Orion Banner" width="600"/>
</p>

<p align="center">
  <i>Son of Poseidon. Slayer of beasts. Guardian of the celestial sphere.</i>
</p>

<p align="center">
  A Telegram group management bot built with <a href="https://grammy.dev/">grammY</a>.
  Orion guards your camps with moderation, filters, locks, anti-flood, greetings, notes, and more.

## Features

| Module | What it does |
|--------|-------------|
| **Admin** | Promote, demote, custom titles, pin, invite link, list admins |
| **Moderation** | Ban, tban, kick, mute, tmute, warn, reset warns |
| **Filters** | Keyword-triggered replies with variables & buttons |
| **Blocklist** | Word & sticker blacklist with configurable actions |
| **Anti-Flood** | Content locks, flood detection, anti-channel/linked/pin |
| **Greetings** | Customizable welcome/goodbye with variables & buttons |
| **Rules** | Per-group rules with full HTML support |
| **Notes** | Save & retrieve text, photos, stickers, documents |
| **Approval** | Trusted users bypass all restrictions |
| **Reporting** | Report users to admins + @admin mention support |
| **AFK** | Away-from-keyboard auto-notification |
| **Fun** | Slap, roll, toss, shout, shrug, decide, runs |
| **Misc** | ID, info, stickerid, paste, translate, Urban Dictionary, ping |
| **Markdown** | Formatting guide for messages, buttons & variables |

</p>


## Quick Start

```bash
git clone https://github.com/Arjun-M/Orion.git
cd Orion
npm install
cp .env.example .env
# edit .env with your token and settings
npm run dev
```

## Configuration

### `.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ORION_TOKEN` | Yes | — | Telegram bot token from @BotFather |
| `ORION_MONGO_URI` | Yes | `mongodb://localhost:27017/orion` | MongoDB connection string |
| `ORION_OWNER_IDS` | Yes | — | Comma-separated bot owner user IDs |
| `ORION_USERNAME` | | `OrionGroupBot` | Bot username (without @) |
| `ORION_SUPPORT_CHAT` | | — | Support chat @username |
| `ORION_CHANNEL` | | — | Updates channel @username |
| `ORION_CACHE_PATH` | | `orion_cache.db` | SQLite cache file path |
| `ORION_DEL_CMDS` | | `true` | Auto-delete command messages |
| `ORION_STRICT_GBAN` | | `true` | Strict global ban mode |
| `ORION_INFOPIC` | | `true` | Show profile pic in /info |
| `ORION_ALLOW_EXCL` | | `true` | Allow `!` as command prefix |
| `ORION_DEBUG` | | `false` | Enable debug logging |
| `ORION_DROP_UPDATES` | | `true` | Drop pending updates on start |
| `ORION_BAN_STICKER` | | — | Sticker sent on ban (file_id) |
| `ORION_LOG_CHANNEL` | | — | Channel ID for action logs |
| `ORION_GBAN_LOG_CHANNEL` | | — | Channel ID for gban logs |
| `ORION_LASTFM_API_KEY` | | — | Last.fm API key |
| `ORION_CF_API_KEY` | | — | Codeforces API key |
| `ORION_WEBHOOK` | | `false` | Enable webhook mode |
| `ORION_WEBHOOK_URL` | | — | Webhook public URL |
| `ORION_WEBHOOK_PORT` | | `8080` | Webhook listen port |
| `ORION_WEBHOOK_PATH` | | — | Webhook path |
| `ORION_CERT_PATH` | | — | SSL certificate path for webhook |

### Webhook mode

Set `ORION_WEBHOOK=true` and provide `ORION_WEBHOOK_URL`. Currently webhook config is env-only — the bot runs on polling by default. Extend `index.ts` with conditional `bot.api.setWebhook()` to enable it.

## Project Structure

```
orion/
├── index.ts                 # Entry point
├── orion/
│   ├── bot.ts               # Bot & API instance
│   ├── config.ts            # Environment config
│   ├── database/
│   │   ├── engine.ts        # MongoDB connection
│   │   ├── models.ts        # Data access layer
│   │   └── cache.ts         # SQLite cache
│   ├── handlers/
│   │   ├── router.ts        # Composer registration & help modules
│   │   ├── start.ts         # /start, /help, about page
│   │   ├── admin.ts         # Promote, demote, pin, invite, admins
│   │   ├── moderation.ts    # Ban, tban, kick, mute, warn
│   │   ├── filter.ts        # Keyword filters & auto-warn
│   │   ├── blocklist.ts     # Word & sticker blacklist
│   │   ├── antiflood.ts     # Locks, flood, anti-channel
│   │   ├── greetings.ts     # Welcome/goodbye with variables
│   │   ├── rules.ts         # Per-group rules
│   │   ├── groups.ts        # Approval system & auto-triggers
│   │   ├── notes.ts         # Saved notes
│   │   ├── fun.ts           # Slap, roll, toss, etc.
│   │   ├── tools.ts         # ID, info, paste, translate, ping
│   │   ├── afk.ts           # AFK tracking
│   │   ├── reporting.ts     # User reporting & @admin handler
│   │   ├── formatting.ts    # Markdown formatting guide
│   │   ├── inline.ts        # Inline mode
│   │   └── errors.ts        # Global error handler
│   ├── keyboards/
│   │   └── common.ts        # Inline keyboards
│   ├── middlewares/
│   │   ├── logging.ts       # Request logging
│   │   ├── rate_limit.ts    # Rate limiter
│   │   └── reply.ts         # Auto-reply-to-message middleware
│   └── utils/
│       ├── texts.ts         # All response texts
│       ├── helpers.ts       # Shared utilities
│       ├── permissions.ts   # Role system & admin cache
│       └── constants.ts     # Lockable types
```

## Permissions

- **Group creator & administrators** — All moderation and config commands
- **Approved users** — Bypass all filters, locks, blacklists, and flood control
- Bot owners (set via `ORION_OWNER_IDS`) are recognized globally

Admin list is cached per-group and auto-refreshes on promote/demote events. Use `/admins` to force a refresh.

## Commands

All commands work in groups where Orion is admin. Run `/help` in PM to browse modules with detailed descriptions.

## License

MIT
