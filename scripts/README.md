# scripts/

Small operational tooling that ships with the repo but is not part of the
runtime Apps Script code.

## smoke_test.py

Synthetic-webhook integration harness. POSTs fabricated Telegram Update JSON
to the deployed `/exec` endpoint to drive the bot through ~7 end-to-end
scenarios (start, expense, income, exchange, weight, diary, analytics) in
roughly 30 seconds.

Motivation: tapping through every FSM branch manually after each deploy is
slow and error-prone. The harness turns a smoke-test into a single command
and doubles as a regression check — if a branch breaks, the first POST into
that flow returns non-2xx.

### Usage

```bash
export BOT_TOKEN='<from BotFather>'
export DEPLOYMENT_URL='https://script.google.com/macros/s/.../exec'
export SMOKE_CHAT_ID='<your telegram numeric id>'

# run everything:
python3 smoke_test.py

# run a subset:
export SMOKE_SCENARIOS='start,expense,weight'
python3 smoke_test.py
```

The harness needs `requests` (stdlib doesn't give us a clean JSON POST):

```bash
pip install requests
```

### Verification

The script asserts HTTP status codes only. Bot-side side-effects (rows
written to `finance_<chat>`, `diary_<chat>`, `weight_<chat>` sheets,
updated XP/gold, etc.) must be verified by opening the linked Google Sheet
after the run. Deeper assertions will land in the Python migration's
pytest suite, where the database is accessible in-process.

### Design choices

* **No hardcoded secrets.** Everything via env vars so the file is safe to
  commit.
* **Minimal deps.** Only `requests`. Runs on any Python 3.9+.
* **Synthetic `update_id`.** We fabricate a monotonically increasing integer.
  Telegram normally guarantees uniqueness; Apps Script doesn't care either
  way since the bot is stateless w.r.t. update_id.
* **Fake `message_id` 1.** The bot sometimes calls `deleteMessage` on the
  user's original message to keep the chat clean. A 400 from Telegram there
  is non-fatal and we intentionally ignore it.
* **Delay between steps.** `SLEEP_BETWEEN` (default 1.5s) lets the operator
  watch the bot reply in real time on Telegram, which is often the fastest
  way to notice a regression that HTTP 200 alone wouldn't catch.
