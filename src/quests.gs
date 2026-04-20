// ============================================================================
// quests.gs — quest folders, list, add, complete-single, complete-all-dailies
//
// The questlog sheet holds one row per quest:
//   [type, title, xp, gold, is_done, deadline, notes]
//
// type is stored as an ASCII enum ("daily" / "weekly" / "monthly" / "raid" /
// "epic" / "personal") so i18n can happen at the UI layer only. The cron
// reset logic keys off this enum — never the displayed label.
// ============================================================================

// Render the quest folder menu (one tile per quest type, plus the day-off
// toggle). Day-off counters live in PropertiesService.
function sendQuestCategories(chatId, messageIdToEdit) {
  var props = PropertiesService.getScriptProperties();
  var left   = parseInt(props.getProperty("dayoff_left_" + chatId) || "2");
  var active = props.getProperty("dayoff_active_" + chatId) === getCurrentDateStr();

  var btnDayOff = active ? L.quest_dayoff_active : L.quest_dayoff_take(left);

  var kb = {
    inline_keyboard: [
      [
        { text: L.quest_type_icons.daily  + " " + L.quest_type_labels.daily,  callback_data: "q_cat_daily" },
        { text: L.quest_type_icons.weekly + " " + L.quest_type_labels.weekly, callback_data: "q_cat_weekly" },
      ],
      [{ text: L.quest_type_icons.monthly + " " + L.quest_type_labels.monthly, callback_data: "q_cat_monthly" }],
      [
        { text: L.quest_type_icons.raid + " " + L.quest_type_labels.raid, callback_data: "q_cat_raid" },
        { text: L.quest_type_icons.epic + " " + L.quest_type_labels.epic, callback_data: "q_cat_epic" },
      ],
      [{ text: L.quest_type_icons.personal + " " + L.quest_type_labels.personal, callback_data: "q_cat_personal" }],
      [{ text: btnDayOff, callback_data: "take_dayoff" }],
      [{ text: L.btn_back_hub, callback_data: "hub_main" }],
    ],
  };
  renderMenu(chatId, messageIdToEdit, L.quest_folders_title, kb);
}

// Render a single-type quest list with multi-select via q_cart.
function sendQuestList(chatId, type, messageIdToEdit) {
  var cache = CacheService.getScriptCache();
  var cart = cache.get("q_cart_" + chatId) ? JSON.parse(cache.get("q_cart_" + chatId)) : [];

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();

  var kb = [];
  var count = 0, selectedCount = 0;
  var icon = L.quest_type_icons[type] || "🔸";
  var label = L.quest_type_labels[type] || type;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === type && data[i][4] !== true) {
      var isSel = cart.indexOf(i + 1) !== -1;
      if (isSel) selectedCount++;
      kb.push([{
        text: (isSel ? "✅ " : icon + " ") + data[i][1],
        callback_data: "q_toggle_" + type + "_" + (i + 1),
      }]);
      count++;
    }
  }
  if (selectedCount > 0) {
    kb.push([{ text: L.quest_btn_submit(selectedCount), callback_data: "q_cart_conf_" + type }]);
  } else if (type === "daily" && count > 0) {
    kb.push([{ text: L.quest_btn_close_all_dailies, callback_data: "q_done_all_dailies" }]);
  }
  kb.push([{ text: L.quest_btn_add(label), callback_data: "q_add_" + type }]);
  kb.push([
    { text: L.btn_back, callback_data: "q_back_to_cats" },
    { text: L.btn_back_hub, callback_data: "hub_main" },
  ]);

  renderMenu(chatId, messageIdToEdit, L.quest_list_title(label, count), { inline_keyboard: kb });
}

// Called when the user taps a quest row: toggles its inclusion in q_cart.
function toggleQuestInCart(chatId, messageId, data) {
  var parts = data.split("_");        // q_toggle_<type>_<row>
  var type = parts[2];
  var row  = parseInt(parts[3]);

  var cache = CacheService.getScriptCache();
  var cart = cache.get("q_cart_" + chatId) ? JSON.parse(cache.get("q_cart_" + chatId)) : [];
  var idx = cart.indexOf(row);
  if (idx !== -1) cart.splice(idx, 1);
  else cart.push(row);
  cache.put("q_cart_" + chatId, JSON.stringify(cart), 600);

  sendQuestList(chatId, type, messageId);
}

// Preview screen before submission. Sums up XP/gold across the selected rows.
function confirmQuestCart(chatId, messageId, data) {
  var type = data.substring("q_cart_conf_".length);
  var cart = CacheService.getScriptCache().get("q_cart_" + chatId);
  cart = cart ? JSON.parse(cart) : [];
  if (cart.length === 0) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  var totalXp = 0, totalGold = 0, textList = "";

  for (var i = 0; i < cart.length; i++) {
    var q = sheet.getRange(cart[i], 1, 1, 7).getValues()[0];
    var xp = parseInt(q[2]) || 0, gold = parseInt(q[3]) || 0;
    totalXp += xp; totalGold += gold;
    textList += "🔸 " + q[1] + " (+" + xp + " XP | +" + gold + " 🪙)\n";
  }
  var label = L.quest_type_labels[type] || type;
  var msg =
    L.quest_submit_title(label) + "\n━━━━━━━━━━━━━━━\n" +
    textList +
    "━━━━━━━━━━━━━━━\n" +
    L.quest_submit_total(totalXp, totalGold) + "\n" +
    L.quest_submit_confirm;

  renderMenu(chatId, messageId, msg, {
    inline_keyboard: [
      [{ text: "✅", callback_data: "q_cart_submit_" + type }],
      [{ text: L.btn_cancel, callback_data: "q_cat_" + type }],
    ],
  });
}

// Atomic-ish submit: append history rows, mark done on the questlog, flush,
// then recompute stats to detect a level-up.
function submitQuestCart(chatId, messageId, data) {
  var type = data.substring("q_cart_submit_".length);
  var cache = CacheService.getScriptCache();
  var cart = cache.get("q_cart_" + chatId);
  cart = cart ? JSON.parse(cart) : [];

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  var statsBefore = getRealTimeStats(chatId);
  var totalXpGain = 0, totalGoldGain = 0;

  for (var i = 0; i < cart.length; i++) {
    var row = cart[i];
    var q = sheet.getRange(row, 1, 1, 7).getValues()[0];
    if (q[4] !== true) {
      var xp = parseInt(q[2]) || 0, gold = parseInt(q[3]) || 0;
      totalXpGain += xp; totalGoldGain += gold;
      logQuestToHistory(chatId, q[0], q[1], xp, gold);
      sheet.getRange(row, 5).setValue(true);
    }
  }
  cache.remove("q_cart_" + chatId);
  SpreadsheetApp.flush();

  var statsAfter = getRealTimeStats(chatId);
  var label = L.quest_type_labels[type] || type;

  var msg =
    L.quest_submit_done_title + "\n━━━━━━━━━━━━━━━\n" +
    L.quest_submit_done_gain(totalXpGain, totalGoldGain);

  var kb = {
    inline_keyboard: [
      [{ text: L.quest_btn_submit_done_more(label), callback_data: "q_cat_" + type }],
      [{ text: L.quest_btn_submit_hub, callback_data: "hub_main" }],
    ],
  };
  if (statsAfter.lvl > statsBefore.lvl) {
    msg = L.levelup_title(statsAfter.lvl) + "\n━━━━━━━━━━━━━━━\n" + msg + "\n\n" + L.levelup_unlocked;
    kb.inline_keyboard.unshift([{ text: L.levelup_btn_open(statsAfter.lvl), callback_data: "open_lootbox" }]);
  }
  renderMenu(chatId, messageId, msg, kb);
}

function startAddQuest(chatId, messageId, data) {
  var type = data.substring("q_add_".length);
  var cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, "wait_quest_add", 600);
  cache.put("temp_q_type_" + chatId, type, 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);

  var label = L.quest_type_labels[type] || type;
  renderMenu(chatId, messageId, L.quest_add_prompt(label), {
    inline_keyboard: [[{ text: L.btn_back, callback_data: "q_cat_" + type }]],
  });
}

function promptCloseAllDailies(chatId, messageId) {
  renderMenu(chatId, messageId, L.quest_close_all_prompt, {
    inline_keyboard: [
      [{ text: "✅", callback_data: "q_done_all_submit" }],
      [{ text: L.btn_cancel, callback_data: "q_cat_daily" }],
    ],
  });
}

function submitCloseAllDailies(chatId, messageId) {
  var statsBefore = getRealTimeStats(chatId);
  completeAllDailies(chatId);
  SpreadsheetApp.flush();
  var statsAfter = getRealTimeStats(chatId);

  var msg = L.quest_close_all_done;
  var kb = {
    inline_keyboard: [[
      { text: L.btn_back, callback_data: "q_back_to_cats" },
      { text: L.btn_back_hub, callback_data: "hub_main" },
    ]],
  };
  if (statsAfter.lvl > statsBefore.lvl) {
    msg = L.levelup_title(statsAfter.lvl) + "\n━━━━━━━━━━━━━━━\n" + msg + "\n\n" + L.levelup_unlocked;
    kb.inline_keyboard.unshift([{ text: L.levelup_btn_open(statsAfter.lvl), callback_data: "open_lootbox" }]);
  }
  renderMenu(chatId, messageId, msg, kb);
}

// Batch-close all pending dailies for a user. Logs a streak bonus at the end
// if anything was actually closed.
function completeAllDailies(chatId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var completedCount = 0;

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === "daily" && data[i][4] !== true) {
      data[i][4] = true;
      completedCount++;
      logQuestToHistory(chatId, "daily", data[i][1], data[i][2] || 0, data[i][3] || 0);
    }
  }
  if (completedCount > 0) {
    sheet.getRange(2, 1, lastRow - 1, 7).setValues(data);
    // Streak bonus: +50 XP / +20 gold for closing at least one daily batch.
    logQuestToHistory(chatId, "bonus", "Daily streak", 50, 20);
  }
}

function logQuestToHistory(chatId, type, title, xp, gold) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_HISTORY, chatId));
  if (sh) sh.appendRow([getCurrentDateStr(), getCurrentTimeStr(), type, title, xp, gold]);
}
