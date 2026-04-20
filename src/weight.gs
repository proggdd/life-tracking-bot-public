// ============================================================================
// weight.gs — body-weight tracker (hub_shape screen + weigh-in prompt)
//
// The shape screen shows the most recent weight entry and offers a button to
// record a new one. The number-input side of the flow is handled in
// main.gs::handleWeightInput under the wait_weight state.
// ============================================================================

function renderShape(chatId, messageId) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_WEIGHT, chatId));
  var lastW = L.shape_none, lastD = L.shape_none_date;

  if (sh && sh.getLastRow() > 1) {
    var row = sh.getRange(sh.getLastRow(), 1, 1, 3).getValues()[0];
    lastD = (row[0] instanceof Date)
      ? Utilities.formatDate(row[0], getTimezone(), "dd.MM.yyyy")
      : String(row[0]);
    lastW = row[2] + " kg";
  }

  var text =
    L.shape_title + "\n━━━━━━━━━━━━━━━\n" +
    L.shape_last + ": <b>" + lastW + "</b>\n" +
    L.shape_date + ": " + lastD + "\n━━━━━━━━━━━━━━━";

  renderMenu(chatId, messageId, text, {
    inline_keyboard: [
      [{ text: L.shape_button,  callback_data: "shape_add" }],
      [{ text: L.btn_back_hub,  callback_data: "hub_main" }],
    ],
  });
}

function promptWeight(chatId, messageId) {
  var cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, "wait_weight", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);

  renderMenu(chatId, messageId, L.shape_prompt, {
    inline_keyboard: [[{ text: L.btn_back, callback_data: "hub_shape" }]],
  });
}
