// ============================================================================
// inventory.gs — per-user inventory CRUD and consumption flow
//
// The inventory sheet has 4 columns: item, qty, total_received, total_used.
// qty is decremented every time an item is activated; the other two counters
// give a lifetime view useful for analytics.
//
// Consumables fall into two classes:
//   - Plain items: tapping "Use" just decrements qty.
//   - Indulgence-type items: present a follow-up picker of active quests and
//     mark one as done without paying XP/gold (logged as type "skip" in the
//     quest history). If the user backs out, the item is refunded.
// ============================================================================

function renderInventory(chatId, messageId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName(getSh(SH_INVENTORY, chatId));
  if (!invSheet) {
    setupInventorySheet(chatId);
    invSheet = ss.getSheetByName(getSh(SH_INVENTORY, chatId));
  }
  var items = invSheet.getDataRange().getValues();

  var kb = [];
  var hasItems = false;
  for (var i = 1; i < items.length; i++) {
    var name = items[i][0];
    var qty  = parseInt(items[i][1]) || 0;
    if (qty > 0) {
      hasItems = true;
      kb.push([{ text: "📦 " + name + " (x" + qty + ")", callback_data: "inv_use_" + i }]);
    }
  }
  kb.push([{ text: L.btn_back_hub, callback_data: "hub_main" }]);

  var title = hasItems ? L.inv_title_full : L.inv_title_empty;
  renderMenu(chatId, messageId, title, { inline_keyboard: kb });
}

function confirmUseItem(chatId, messageId, data) {
  var rowIdx = parseInt(data.substring("inv_use_".length));
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_INVENTORY, chatId));
  var itemName = sh.getRange(rowIdx + 1, 1).getValue();
  renderMenu(chatId, messageId, L.inv_use_confirm(itemName), {
    inline_keyboard: [
      [{ text: L.inv_use_btn, callback_data: "inv_conf_" + rowIdx }],
      [{ text: L.btn_cancel,  callback_data: "hub_inv" }],
    ],
  });
}

function useItem(chatId, messageId, data, callback) {
  var rowIdx = parseInt(data.substring("inv_conf_".length));
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_INVENTORY, chatId));
  var itemName = sh.getRange(rowIdx + 1, 1).getValue();

  if (!useInventoryItem(chatId, itemName)) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.inv_err_missing,
      show_alert: true,
    });
    return;
  }

  // Indulgence: present quest picker instead of a plain confirmation.
  if (itemName.toLowerCase().indexOf("indulgence") !== -1) {
    renderIndulgencePicker(chatId, messageId, itemName);
    return;
  }
  renderMenu(chatId, messageId, L.inv_used(itemName), {
    inline_keyboard: [[{ text: L.inv_back, callback_data: "hub_inv" }]],
  });
}

// Lists unfinished dailies + weeklies so the user can pick one to skip.
function renderIndulgencePicker(chatId, messageId, itemName) {
  var qSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  var qData = qSh.getDataRange().getValues();
  var kb = [];
  var targetTypes = itemName.toLowerCase().indexOf("weekly") !== -1 ? ["weekly"] : ["daily"];
  for (var i = 1; i < qData.length; i++) {
    if (targetTypes.indexOf(qData[i][0]) !== -1 && qData[i][4] !== true) {
      kb.push([{ text: "⏭ " + qData[i][1], callback_data: "inv_skip_" + (i + 1) }]);
    }
  }
  if (kb.length === 0) {
    // No quests to skip — refund the item and bounce back.
    addInventoryItem(chatId, itemName, 1);
    renderMenu(chatId, messageId, L.inv_indulgence_none, {
      inline_keyboard: [[{ text: L.inv_back, callback_data: "hub_inv" }]],
    });
    return;
  }
  CacheService.getScriptCache().put("skip_refund_" + chatId, itemName, 600);
  kb.push([{ text: L.inv_indulgence_refund_btn, callback_data: "inv_refund" }]);
  renderMenu(chatId, messageId, L.inv_indulgence_prompt, { inline_keyboard: kb });
}

function refundItem(chatId, callback) {
  var cache = CacheService.getScriptCache();
  var ref = cache.get("skip_refund_" + chatId);
  if (ref) addInventoryItem(chatId, ref, 1);
  cache.remove("skip_refund_" + chatId);
  callback.data = "hub_inv";
  handleCallback(callback);
}

function skipQuestWithItem(chatId, messageId, data) {
  var r = parseInt(data.substring("inv_skip_".length));
  var qSh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  var title = qSh.getRange(r, 2).getValue();

  qSh.getRange(r, 5).setValue(true);
  logQuestToHistory(chatId, "skip", title, 0, 0);

  CacheService.getScriptCache().remove("skip_refund_" + chatId);
  renderMenu(chatId, messageId, L.inv_indulgence_skipped(title), {
    inline_keyboard: [[{ text: L.inv_back, callback_data: "hub_inv" }]],
  });
}

// Add `qty` of `itemName` (case-sensitive match). Creates the row if missing.
function addInventoryItem(chatId, itemName, qty) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(getSh(SH_INVENTORY, chatId));
  if (!sh) {
    setupInventorySheet(chatId);
    sh = ss.getSheetByName(getSh(SH_INVENTORY, chatId));
  }
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === itemName) {
      sh.getRange(i + 1, 2).setValue((parseInt(data[i][1]) || 0) + qty);
      sh.getRange(i + 1, 3).setValue((parseInt(data[i][2]) || 0) + qty);
      return;
    }
  }
  sh.appendRow([itemName, qty, qty, 0]);
}

// Consume one unit. Returns false if the row is missing or qty already zero.
function useInventoryItem(chatId, itemName) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_INVENTORY, chatId));
  if (!sh) return false;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === itemName && parseInt(data[i][1]) > 0) {
      sh.getRange(i + 1, 2).setValue(parseInt(data[i][1]) - 1);
      sh.getRange(i + 1, 4).setValue((parseInt(data[i][3]) || 0) + 1);
      return true;
    }
  }
  return false;
}
