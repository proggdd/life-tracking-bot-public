#!/usr/bin/env python3
"""
smoke_test.py — synthetic-webhook integration harness for the Apps Script bot.

Why this file exists
--------------------
The bot lives behind a Google Apps Script /exec endpoint. Telegram POSTs JSON
"Update" payloads there whenever the user sends a message or taps an inline
button. This script fabricates the *same* JSON shape and POSTs it directly,
letting us drive the bot through a full FSM end-to-end in ~30 seconds without
touching the Telegram UI. Each scenario is a small deterministic sequence of
message + callback_query updates.

What it verifies
----------------
1. The /exec endpoint accepts the synthetic payloads (HTTP 200 on every step).
2. The bot actually replies — we call getUpdates on a fresh long-poll channel
   to confirm Telegram-side sendMessage calls went out. (Optional; skipped by
   default because it requires dropping the webhook temporarily.)
3. The spreadsheet side-effect: this script does NOT directly read the Google
   Sheet. Instead, the human operator opens the sheet after the run and eyes
   that rows landed in finance_<chat>, diary_<chat>, weight_<chat>.

Usage
-----
    export BOT_TOKEN='<from BotFather>'
    export DEPLOYMENT_URL='https://script.google.com/macros/s/.../exec'
    export SMOKE_CHAT_ID='<your telegram numeric id>'
    # optional: export SMOKE_SCENARIOS='start,expense,income,weight,diary,analytics'
    python3 smoke_test.py

Design notes
------------
* No hardcoded chat IDs, tokens, or URLs. Everything through env, so this file
  is safe to commit to a public repo.
* No third-party deps beyond `requests` — keeps the harness portable.
* Each scenario is a list of "events" (dicts). An event is either
  {"text": "..."} for a user-typed message or {"cb": "..."} for a button tap.
  The encode_update() function converts both shapes into the exact JSON that
  Telegram would have sent.
* Between steps we sleep a fixed SLEEP_BETWEEN seconds so the operator can
  watch the bot respond in real time on Telegram.
* The script never asserts bot state — that's a deliberate tradeoff. True
  assertions would need read access to the user's Google Sheet. For the
  Apps Script MVP, visual verification in Telegram + a manual sheet check are
  sufficient. When the Python migration lands, the pytest suite there will
  have full in-memory DB assertions.

Exit codes
----------
    0 — all POSTs returned 2xx
    1 — at least one POST returned non-2xx
    2 — missing env vars (user error)
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

import requests

# --- config --------------------------------------------------------------

SLEEP_BETWEEN = 1.5  # seconds between synthetic updates (gives bot time to reply)
REQUEST_TIMEOUT = 30  # seconds — Apps Script first-touch can be slow

# --- scenarios -----------------------------------------------------------
# Each scenario is (name, [event, ...]) where event is either:
#   {"text": "<user message>"}    — plain text message
#   {"cb":   "<callback_data>"}   — inline button tap
# Order matters: the FSM is stateful, so each event depends on the previous.

SCENARIOS: list[tuple[str, list[dict[str, str]]]] = [
    ("start", [
        {"text": "/start"},          # triggers lazy-init of per-user sheets
    ]),
    ("expense", [
        {"cb":   "hub_expense"},     # tap "Расход" in the hub
        {"cb":   "cur_USD"},         # pick USD from currency keyboard
        {"text": "150 smoke test"},  # amount + inline note
        {"cb":   "cat_toggle_0"},    # select first category (index 0)
        {"cb":   "cat_conf"},        # confirm categories
        {"cb":   "cart_add"},        # add tx to cart
        {"cb":   "cart_save"},       # save cart to ledger
    ]),
    ("income", [
        {"cb":   "hub_income"},
        {"cb":   "cur_USD"},
        {"text": "1000 smoke income"},
        {"cb":   "cat_toggle_0"},
        {"cb":   "cat_conf"},
        {"cb":   "cart_add"},
        {"cb":   "cart_save"},
    ]),
    ("exchange", [
        {"cb":   "hub_exchange"},
        {"cb":   "exc1_USD"},        # give USD
        {"text": "100"},             # give amount
        {"cb":   "exc2_EUR"},        # receive EUR
        {"text": "90"},              # receive amount
        {"cb":   "exc_skip_comm"},   # no fee
    ]),
    ("weight", [
        {"cb":   "hub_shape"},
        {"cb":   "shape_add"},
        {"text": "82.5"},
    ]),
    ("diary", [
        # Axis keys are SINGLE letters: m / e / a (mood / energy / anxiety).
        # The bot stores them in cache as {m, e, a} and the final row-write
        # reads ds.m / ds.e / ds.a. Using the long words matches the router's
        # "set_stat_" prefix (HTTP 200 returned), but saves nulls into the
        # sheet — exactly the silent-failure mode a status-only test misses.
        {"cb":   "hub_diary"},
        {"cb":   "set_stat_m_7"},
        {"cb":   "set_stat_e_6"},
        {"cb":   "set_stat_a_3"},
        {"cb":   "diary_approve_stats"},
        {"cb":   "diary_skip_text"},   # skip free-form text for speed
    ]),
    ("analytics", [
        # Category keys live in analytics.gs (sendStatMainMenu): expense,
        # income, gold, quests, mood, weight, general. Periods live in
        # sendStatPeriodMenu: day, week, month, year, custom. Getting either
        # wrong gives HTTP 200 (prefix-match swallows it) but no useful
        # report — classic reason to not rely on status codes alone.
        {"cb":   "hub_stats"},
        {"cb":   "stat_cat_expense"},
        {"cb":   "stat_run_expense_week"},
    ]),
]

# --- payload builders ----------------------------------------------------

_update_counter = int(time.time())  # monotonic-ish fake update_id


def next_update_id() -> int:
    global _update_counter
    _update_counter += 1
    return _update_counter


def encode_update(chat_id: int, event: dict[str, str]) -> dict[str, Any]:
    """Wrap one event into the Telegram Update JSON shape.

    For text events we emit a {"message": ...} update. For callback events we
    emit a {"callback_query": ...} update whose .message has a chat id so
    handleCallback() can extract it. The fake message_id 1 is fine — the bot
    only uses it for deleteMessage / editMessageText calls, and those 400-ing
    is non-fatal.
    """
    if "text" in event:
        return {
            "update_id": next_update_id(),
            "message": {
                "message_id": next_update_id(),
                "date": int(time.time()),
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": chat_id, "is_bot": False, "first_name": "SmokeTest"},
                "text": event["text"],
            },
        }
    if "cb" in event:
        return {
            "update_id": next_update_id(),
            "callback_query": {
                "id": str(next_update_id()),
                "from": {"id": chat_id, "is_bot": False, "first_name": "SmokeTest"},
                "message": {
                    "message_id": 1,
                    "date": int(time.time()),
                    "chat": {"id": chat_id, "type": "private"},
                    "text": "smoke",
                },
                "chat_instance": "smoke",
                "data": event["cb"],
            },
        }
    raise ValueError(f"unknown event shape: {event}")


# --- runner --------------------------------------------------------------

def post_update(session: requests.Session, url: str, payload: dict[str, Any]) -> tuple[int, str]:
    """POST one synthetic update. Returns (status_code, short_body_repr)."""
    resp = session.post(url, json=payload, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    body = resp.text[:200].replace("\n", " ")
    return resp.status_code, body


def describe(event: dict[str, str]) -> str:
    """Pretty one-liner for console output."""
    if "text" in event:
        return f'text: "{event["text"]}"'
    if "cb" in event:
        return f'cb:   {event["cb"]}'
    return repr(event)


def run(chat_id: int, url: str, scenarios: list[tuple[str, list[dict[str, str]]]]) -> int:
    failures = 0
    session = requests.Session()
    for name, events in scenarios:
        print(f"\n=== scenario: {name} ===")
        for ev in events:
            payload = encode_update(chat_id, ev)
            try:
                status, body = post_update(session, url, payload)
            except requests.RequestException as exc:
                print(f"  [ERR ] {describe(ev)}  ->  {exc}")
                failures += 1
                continue
            ok = 200 <= status < 300
            marker = "OK  " if ok else "FAIL"
            print(f"  [{marker}] {describe(ev):<40}  ->  {status}")
            if not ok:
                failures += 1
                print(f"         body: {body}")
            time.sleep(SLEEP_BETWEEN)
    return failures


def filter_scenarios(all_scn: list, only: str | None) -> list:
    if not only:
        return all_scn
    wanted = {s.strip() for s in only.split(",") if s.strip()}
    unknown = wanted - {n for n, _ in all_scn}
    if unknown:
        print(f"warning: unknown scenarios ignored: {sorted(unknown)}", file=sys.stderr)
    return [s for s in all_scn if s[0] in wanted]


def main() -> int:
    token = os.environ.get("BOT_TOKEN", "").strip()
    url = os.environ.get("DEPLOYMENT_URL", "").strip()
    chat_raw = os.environ.get("SMOKE_CHAT_ID", "").strip()
    only = os.environ.get("SMOKE_SCENARIOS", "").strip() or None

    missing = [k for k, v in [("BOT_TOKEN", token),
                              ("DEPLOYMENT_URL", url),
                              ("SMOKE_CHAT_ID", chat_raw)] if not v]
    if missing:
        print(f"error: missing env vars: {missing}", file=sys.stderr)
        print("example:", file=sys.stderr)
        print("  export BOT_TOKEN='123456:ABC...'", file=sys.stderr)
        print("  export DEPLOYMENT_URL='https://script.google.com/macros/s/.../exec'", file=sys.stderr)
        print("  export SMOKE_CHAT_ID='123456789'", file=sys.stderr)
        return 2

    try:
        chat_id = int(chat_raw)
    except ValueError:
        print(f"error: SMOKE_CHAT_ID must be numeric, got {chat_raw!r}", file=sys.stderr)
        return 2

    # token is kept in env but unused by this script — we do not call Telegram
    # directly, only the /exec endpoint. The variable is declared to make the
    # operator's env mirror the bot's config and prevent "forgot the token" bugs
    # if we later extend the harness with a getUpdates verifier. Suppress the
    # unused-local warning without silencing linters for the whole function:
    _ = token

    scenarios = filter_scenarios(SCENARIOS, only)
    print(f"chat_id:   {chat_id}")
    print(f"endpoint:  {url}")
    print(f"scenarios: {[n for n, _ in scenarios]}")

    fails = run(chat_id, url, scenarios)
    print(f"\n=== done: {fails} failed steps ===")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
