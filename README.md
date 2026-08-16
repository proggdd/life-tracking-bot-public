# Life Tracking System — Telegram bot on Google Apps Script

A multi-tenant gamification platform that runs entirely on Google Workspace.
Users interact with a Telegram bot; all state lives in Google Sheets; five
time-based triggers drive the cron side; no servers, no containers, no
external database.

This repository is the public, sanitized snapshot of a codebase that has been
running in production for two users across 44 internal iterations. It is
published as a portfolio case study for a broader write-up on the
architecture, the scaling trade-offs, and the in-progress migration to
Python / FastAPI / PostgreSQL.

> **Status.** Small-scale production MVP (2 daily active users, ~5 months
> uptime). The architecture is deliberately "simple enough to ship, rich
> enough to exercise the real patterns" — sheets-as-database, cache-based
> state machine, webhook + cron, per-user tenancy. Known limits are
> documented in [§ Scaling notes](#scaling-notes) below.

---

## What the bot does

The bot is a daily companion that blends three independent tools behind a
single RPG-style hub:

- **Finance ledger.** Shared household budget with multi-currency support
  (USD / EUR / RUB / CNY by default), multi-select categories, a 4-step
  FX exchange flow with optional fees, and a live dashboard sheet built
  from cross-sheet `SUMIFS` formulas.
- **Quest / habit system.** Six quest types (daily, weekly, monthly, raid,
  epic, personal) with XP and gold rewards, automatic roll-over at 00:00,
  batch-close and streak bonuses, day-off budget, and a pre-computed
  "indulgence" item that skips a quest without penalty.
- **Wellbeing tracker.** Weight log + three-axis daily diary (mood, energy,
  anxiety on a 1–10 scale) with independent revision of each axis before
  commit.

Everything is wrapped in an RPG loop: XP gains level the character up on an
exponential curve (`1000 * 1.2^n`), every level-up unlocks a loot box with
a five-tier rarity system (50 / 30 / 15 / 4 / 1 %), gold is spent in a
reward shop with a persistent cart and purchase history. A cron-driven
weekly "newspaper" closes the loop with a report on streaks, penalties and
day-off usage.

For a deeper dive with diagrams, see
[`case_study/architecture.md`](../case_study/architecture.md) (kept in the
portfolio repo, outside this public snapshot).

---

## Tech stack

| Layer         | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Runtime       | Google Apps Script (V8 engine)                            |
| Interface     | Telegram Bot API over webhook (`doPost` handler)          |
| Storage       | Google Sheets (11 logical tables, 4 shared + 7 per-user)  |
| Conv. state   | `CacheService` — in-memory, 10–60 min TTL                 |
| Counters      | `PropertiesService` — persistent key-value                |
| Scheduling    | 5 time-based triggers (cron, installed by one function)   |
| Secrets       | Script Properties, not source control                     |
| Deployment    | [clasp](https://github.com/google/clasp) → Apps Script    |

Zero infra cost. The whole system fits inside the Google Workspace free
tier and has never exceeded the 6-minute execution ceiling in steady state.

---

## Repository layout

```
public_repo/
├── appsscript.json              # Apps Script manifest (V8, OAuth scopes)
├── .clasp.json.example          # Rename and fill in your scriptId
├── .env.example                 # Script Properties reference
├── LICENSE                      # MIT
├── locales/
│   ├── en.gs                    # English UI strings
│   └── ru.gs                    # Russian UI strings (active — loads last, wins)
└── src/
    ├── main.gs                  # doPost entry + wait-state text handlers
    ├── router.gs                # callback dispatcher (prefix-based)
    ├── config.gs                # sheet names + Properties readers
    ├── telegram.gs              # Bot API wrapper + renderMenu
    ├── state.gs                 # cache/session helpers
    ├── sheets.gs                # schema init + cross-sheet dashboard
    ├── rpg.gs                   # stats, level curve, hub, profile
    ├── quests.gs                # quest folders, submission, streak bonus
    ├── dayoff.gs                # day-off budget (PropertiesService)
    ├── lootbox.gs               # 5-tier rarity table, prize roll
    ├── shop.gs                  # reward catalogue + cart + checkout
    ├── inventory.gs             # CRUD + indulgence flow
    ├── diary.gs                 # three-axis mental-state log
    ├── weight.gs                # body-weight tracker
    ├── finance.gs               # expense / income flow with multi-select
    ├── exchange.gs              # 4-step FX flow (give / receive / fee)
    ├── analytics.gs             # on-demand reports (7 × 5 matrix)
    ├── cron.gs                  # 5 time-based triggers + GC
    └── autoheal.gs              # one-shot spreadsheet repair utilities
```

Every source file has a header comment explaining what lives there and
why. Business logic is routed through a small number of abstractions
(`renderMenu`, `callTelegram`, `getSh`, `L.*`) so the code reads
top-down without a spelunking map.

---

## How the pieces fit

```
Telegram → webhook POST → doPost() ──┬── text? → state machine (wait_*)
                                     └── callback_query? → router.handleCallback()
                                                 ├── hub_*       → rpg.gs
                                                 ├── q_*         → quests.gs
                                                 ├── shop_*      → shop.gs
                                                 ├── inv_*       → inventory.gs
                                                 ├── diary_*     → diary.gs
                                                 ├── exc*_       → exchange.gs
                                                 ├── stat_*      → analytics.gs
                                                 └── …
```

Every mutating operation ends with a flush to Google Sheets. Every
long-lived piece of state (cart contents, selected categories, current
wait-state) lives in `CacheService` with a TTL, so abandoned flows
evaporate on their own without a manual reset.

---

## Getting started (local → production)

You will need a Google account, a Telegram bot token, and
[`clasp`](https://github.com/google/clasp) installed locally.

1. **Create a spreadsheet.** This is where the bot stores everything.
2. **Bind an Apps Script project to it.**
   - In the spreadsheet: _Extensions → Apps Script_.
   - Copy the resulting script ID from the URL; that's what goes in
     `.clasp.json` (copy `.clasp.json.example` first).
3. **Push the code.**
   ```bash
   clasp push
   ```
4. **Set Script Properties** (Apps Script editor → Project Settings →
   Script Properties). See [`.env.example`](./.env.example) for the full
   key list. Required: `BOT_TOKEN`, `ALLOWED_USERS_CSV`.
5. **Install cron triggers.** In the Apps Script editor select the
   `setupAutomationTriggers` function from the dropdown and run it once.
   This schedules the 5 time-driven triggers (morning / afternoon reminders,
   weekly newspaper, nightly quest reset, hourly GC).
6. **Deploy as a Web App.** _Deploy → New deployment → Web app →_
   - Execute as: _Me_.
   - Who has access: _Anyone_.
   - Copy the `/exec` URL.
7. **Register the webhook with Telegram.** Put the `/exec` URL into the
   `DEPLOYMENT_URL` Script Property and run `updateWebhook()`.
8. **Send `/start` from Telegram.** The bot lazy-creates the full schema
   on the first message from an allow-listed chat: `initUserSheets(chatId)`
   in `src/sheets.gs` inserts the 4 shared sheets (`ledger_expense`,
   `ledger_income`, `ledger_categories`, `shop_catalog`) on the first user
   ever, then always the 7 per-user sheets with the `_{chatId}` suffix
   (`diary`, `weight`, `inventory`, `quests`, `questlog`, `shop_history`,
   `character`). Category defaults and the shop catalogue are seeded from
   the active locale, so the sheets are ready for use immediately after
   `/start` returns.

For each additional user: add their Telegram chat ID to `ALLOWED_USERS_CSV`
(comma-separated), then have them press `/start`. Their per-user sheets
are provisioned on that first message.

---

## Locale switching

`L` (the UI-strings object) is defined by the locale file that loads last.
Apps Script loads files alphabetically by basename, so `locales/en.gs`
loads first and is then overwritten by `locales/ru.gs` — the Russian
build wins by default. To deploy the English build, delete `ru.gs` from
the project (or rename it so it sorts before `en.gs`, e.g. `_ru.gs`).
No code changes are required — the two files expose the same keys.

All user-facing text goes through `L.*`. Quest types are stored as ASCII
enums (`"daily"`, `"weekly"`, …) regardless of locale, so history rows are
portable across deployments.

---

## Scaling notes

This codebase is an honest snapshot of a production MVP. A few constraints
are fundamental to the sheets-as-database choice and motivate the Python
migration work-stream:

- **Read cost.** The analytics module (`analytics.gs::generateAdvancedReport`)
  can touch up to five sheets end-to-end per report request. At current
  scale this stays well under a second; at 10× data volume it would start
  bumping against Apps Script's 6-minute execution ceiling.
- **No indexes.** Sheet reads are full-column scans. Aggregations are fine
  while data stays in the low thousands of rows per user.
- **No transactions.** `appendRow` is atomic per call, but cross-sheet
  writes (quest submission → history log → XP re-computation) are not. In
  practice users never observe partial state because the Telegram round
  trip is sequential, but this would bite under a real concurrent load.
- **Limited locale / currency set.** Currencies are loaded from `L.currencies`
  as a fixed array. Adding a currency is a one-line change but the analytics
  module pre-seeds buckets for iteration-order stability.

The accompanying migration repo ports the domain model to SQLAlchemy +
PostgreSQL and the interaction layer to `python-telegram-bot` with a
Finite State Machine abstraction, keeping the UX identical but removing
the sheets bottleneck.

---

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

Built by Daniil (gddviet@gmail.com) as a personal tool, iterated with
two real users into a case study for a data analytics / backend
engineering career transition.
