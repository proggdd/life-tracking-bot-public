// ============================================================================
// exchange.gs — 4-step FX exchange flow
//
// The user exchanges currency A for currency B with an optional fee in any
// currency. Modelled as three ledger writes:
//   - expense row  (A, amount given)
//   - income row   (B, amount received)
//   - expense row  (fee currency, fee amount), only if a fee was entered
//
// All three rows use dedicated categories (L.fx_category_label,
// L.fx_fee_label) so the analytics module can segregate them from "real"
// spending when computing budget breakdowns.
//
// The step sequence:
//   exc1_{CUR}                → wait_exc_amt1   (how much we give away)
//   exc2_{CUR}                → wait_exc_amt2   (how much we actually receive)
//   wait_exc_comm_amt OR skip → fee currency picker (exc3_{CUR})
//                            → finalizeExchange()
// ============================================================================

function startExchange(chatId, messageId) {
  resetState(chatId);
  renderMenu(chatId, messageId, L.exc_step1, {
    inline_keyboard: buildCurrencyKeyboard("exc1_", "hub_main"),
  });
}

function pickExchangeGiveCurrency(chatId, messageId, data) {
  var cur1 = data.substring("exc1_".length);
  var cache = CacheService.getScriptCache();
  cache.put("exc_cur1_" + chatId, cur1, 600);
  cache.put("state_" + chatId, "wait_exc_amt1", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);

  renderMenu(chatId, messageId, L.exc_amt1_prompt(cur1), {
    inline_keyboard: [[{ text: L.btn_cancel, callback_data: "hub_main" }]],
  });
}

function pickExchangeReceiveCurrency(chatId, messageId, data) {
  var cur2 = data.substring("exc2_".length);
  var cache = CacheService.getScriptCache();
  cache.put("exc_cur2_" + chatId, cur2, 600);
  cache.put("state_" + chatId, "wait_exc_amt2", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);

  renderMenu(chatId, messageId, L.exc_amt2_prompt(cur2), {
    inline_keyboard: [[{ text: L.btn_cancel, callback_data: "hub_main" }]],
  });
}

function skipExchangeFee(chatId, messageId) {
  if (messageId) callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
  finalizeExchange(chatId, 0, "");
}

function pickExchangeFeeCurrency(chatId, messageId, data) {
  var commCur = data.substring("exc3_".length);
  var commAmt = parseFloat(CacheService.getScriptCache().get("exc_comm_amt_" + chatId)) || 0;
  if (messageId) callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
  finalizeExchange(chatId, commAmt, commCur);
}

// Writes the three ledger rows and renders a summary. Cache cleanup is
// centralized here so the user can't get stuck halfway through a second
// exchange if something goes wrong mid-flow.
function finalizeExchange(chatId, commAmt, commCur) {
  var cache = CacheService.getScriptCache();
  var cur1 = cache.get("exc_cur1_" + chatId);
  var amt1 = parseFloat(cache.get("exc_amt1_" + chatId));
  var cur2 = cache.get("exc_cur2_" + chatId);
  var amt2 = parseFloat(cache.get("exc_amt2_" + chatId));

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dStr = getCurrentDateStr();
  var tStr = getCurrentTimeStr();

  ss.getSheetByName(SH_EXPENSE).appendRow([
    dStr, tStr, cur1, amt1, L.fx_category_label, "Exchange to " + cur2,
  ]);
  ss.getSheetByName(SH_INCOME).appendRow([
    dStr, tStr, cur2, amt2, L.fx_category_label, "Exchange from " + cur1,
  ]);

  var msg =
    L.exc_done_title + "\n━━━━━━━━━━━━━━━\n" +
    L.exc_done_given(amt1, cur1) + "\n" +
    L.exc_done_received(amt2, cur2) + "\n";

  if (commAmt > 0) {
    ss.getSheetByName(SH_EXPENSE).appendRow([
      dStr, tStr, commCur, commAmt, L.fx_fee_label, "",
    ]);
    msg += L.exc_done_fee(commAmt, commCur) + "\n";
  } else {
    msg += L.exc_done_no_fee + "\n";
  }

  resetState(chatId);
  cache.removeAll([
    "exc_cur1_" + chatId, "exc_amt1_" + chatId,
    "exc_cur2_" + chatId, "exc_amt2_" + chatId,
    "exc_comm_amt_" + chatId,
  ]);

  // Flash the receipt, then bounce back to the hub.
  var res = callTelegram("sendMessage", { chat_id: String(chatId), text: msg, parse_mode: "HTML" });
  if (res) {
    var body = JSON.parse(res.getContentText());
    if (body.ok) scheduleMsgDelete(chatId, body.result.message_id);
  }
  sendMainMenu(chatId);
}
