// ============================================================================
// finance.gs — expense / income transaction flow
//
// Flow, one row at a time:
//   hub_expense|hub_income
//     -> pick currency (cur_USD / cur_EUR / cur_RUB / cur_CNY)
//         -> wait_amount  (free-text "100 + 50 groceries")
//             -> category multi-select (cat_toggle_N / cat_conf / add_cat)
//                 -> confirm -> cart_add
//                     -> cart_more | cart_save (batch flush to the ledger)
//
// The cart lives in CacheService with a 1h TTL. Flushing appends every row
// into the global `ledger_expense` / `ledger_income` sheets.
// ============================================================================

function startTransactionFlow(chatId, type, messageId) {
  resetState(chatId);
  CacheService.getScriptCache().put("flow_type_" + chatId, type, 600);

  renderMenu(chatId, messageId, L.fin_pick_currency, {
    inline_keyboard: buildCurrencyKeyboard("cur_", "hub_main"),
  });
}

function setTransactionCurrency(chatId, messageId, data) {
  var cache = CacheService.getScriptCache();
  var curTx = { currency: data.substring("cur_".length), type: cache.get("flow_type_" + chatId) };
  cache.put("cur_tx_" + chatId, JSON.stringify(curTx), 600);
  cache.put("state_" + chatId, "wait_amount", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);

  renderMenu(chatId, messageId, L.fin_enter_amount, {
    inline_keyboard: [[{ text: L.btn_back_hub, callback_data: "hub_main" }]],
  });
}

// Multi-select category picker. Up to N categories can be combined into one
// row (stored as "A + B + C" in the category column) for cases where a
// purchase legitimately belongs to several buckets.
function sendCategoryKeyboard(chatId, flowType, messageIdToEdit) {
  var cache = CacheService.getScriptCache();
  var selected = cache.get("cat_cart_" + chatId)
    ? JSON.parse(cache.get("cat_cart_" + chatId))
    : [];
  var cats = getCategoriesFromSheet(flowType);

  var kb = [];
  var row = [];
  for (var i = 0; i < cats.length; i++) {
    var isSel = selected.indexOf(i) !== -1;
    row.push({
      text: (isSel ? "✅ " : "") + cats[i],
      callback_data: "cat_toggle_" + i,
    });
    if (row.length === 2 || i === cats.length - 1) {
      kb.push(row);
      row = [];
    }
  }
  if (selected.length > 0) {
    kb.push([{ text: L.fin_btn_confirm_pick, callback_data: "cat_conf" }]);
  }
  kb.push([{ text: L.fin_btn_add_cat, callback_data: "add_cat" }]);
  kb.push([{ text: L.btn_back_hub, callback_data: "hub_main" }]);

  renderMenu(chatId, messageIdToEdit, L.fin_pick_categories, { inline_keyboard: kb });
}

function toggleCategory(chatId, messageId, data, flowType) {
  var idx = parseInt(data.substring("cat_toggle_".length));
  var cache = CacheService.getScriptCache();
  var cart = cache.get("cat_cart_" + chatId) ? JSON.parse(cache.get("cat_cart_" + chatId)) : [];

  var pos = cart.indexOf(idx);
  if (pos !== -1) cart.splice(pos, 1);
  else cart.push(idx);

  cache.put("cat_cart_" + chatId, JSON.stringify(cart), 600);
  sendCategoryKeyboard(chatId, flowType, messageId);
}

function confirmCategories(chatId, messageId, flowType) {
  var cache = CacheService.getScriptCache();
  var cart = cache.get("cat_cart_" + chatId) ? JSON.parse(cache.get("cat_cart_" + chatId)) : [];
  if (cart.length === 0) return;

  var cats = getCategoriesFromSheet(flowType);
  var selected = [];
  for (var i = 0; i < cart.length; i++) selected.push(cats[cart[i]]);

  var curTx = JSON.parse(cache.get("cur_tx_" + chatId));
  curTx.category = selected.join(" + ");
  cache.put("cur_tx_" + chatId, JSON.stringify(curTx), 600);
  cache.remove("cat_cart_" + chatId);

  var preview =
    "Amount: " + curTx.amount + " " + curTx.currency + "\n" +
    "Categories: " + curTx.category + "\n" +
    "Note: " + (curTx.note || "-");
  renderMenu(chatId, messageId, preview, {
    inline_keyboard: [
      [{ text: L.fin_btn_cart_add, callback_data: "cart_add" }],
      [{ text: L.btn_cancel,       callback_data: "hub_main" }],
    ],
  });
}

function promptNewCategory(chatId, messageId) {
  var cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, "wait_new_cat", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);
  renderMenu(chatId, messageId, L.fin_new_cat_prompt, {
    inline_keyboard: [[{ text: L.btn_back_hub, callback_data: "hub_main" }]],
  });
}

function addTxToCart(chatId, messageId) {
  var cache = CacheService.getScriptCache();
  var cart = cache.get("cart_" + chatId) ? JSON.parse(cache.get("cart_" + chatId)) : [];
  cart.push(JSON.parse(cache.get("cur_tx_" + chatId)));

  cache.put("cart_" + chatId, JSON.stringify(cart), 3600);
  cache.remove("cur_tx_" + chatId);
  cache.remove("state_" + chatId);

  renderMenu(chatId, messageId, L.fin_cart_count(cart.length), {
    inline_keyboard: [
      [{ text: L.fin_btn_cart_more, callback_data: "cart_more" }],
      [{ text: L.fin_btn_cart_save, callback_data: "cart_save" }],
    ],
  });
}

function saveCartToLedger(chatId, messageId) {
  var cache = CacheService.getScriptCache();
  var cart = JSON.parse(cache.get("cart_" + chatId));
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  for (var i = 0; i < cart.length; i++) {
    var target = cart[i].type === "expense" ? SH_EXPENSE : SH_INCOME;
    ss.getSheetByName(target).appendRow([
      getCurrentDateStr(),
      getCurrentTimeStr(),
      cart[i].currency,
      cart[i].amount,
      cart[i].category,
      cart[i].note,
    ]);
  }
  cache.remove("cart_" + chatId);
  resetState(chatId);

  if (messageId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
  }
  // Renders the hub with the "Saved" flash, then re-evaluates level-ups.
  sendMainMenu(chatId);
}

// Read the shared categories sheet for the active flow. Column A is expense,
// column B is income.
function getCategoriesFromSheet(flowType) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SETTINGS);
  if (!sh) sh = setupSettingsSheet();
  var col = flowType === "expense" ? 1 : 2;

  var rows = Math.max(1, sh.getLastRow() - 1);
  var data = sh.getRange(2, col, rows, 1).getValues();
  var cats = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() !== "") cats.push(data[i][0]);
  }
  return cats.length > 0 ? cats : ["❓ Misc"];
}

// Append a new category to the bottom of the correct column.
function addCategoryToSheet(flowType, newCat) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SETTINGS);
  if (!sh) sh = setupSettingsSheet();
  var col = flowType === "expense" ? 1 : 2;
  var row = 2;
  while (sh.getRange(row, col).getValue() !== "") row++;
  sh.getRange(row, col).setValue(newCat);
}
