// ============================================================================
// rpg.gs — real-time level/XP/gold aggregator, hub screen, party view, profile
//
// getRealTimeStats is the hot path of the whole system. Every tap that lands
// on the hub or the shop triggers three Sheets reads and an exponential-level
// loop. In production this turned out to be the dominant source of latency
// and the main reason the bot is being migrated to a proper RDBMS — once we
// have a DB, the totals live in a materialized view (or are just columns on
// the user row) and the hub becomes a single round-trip.
// ============================================================================

function getRealTimeStats(chatId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var xp = 0, gold = 0;

  // Diary — XP/gold columns G, H.
  var dSh = ss.getSheetByName(getSh(SH_DIARY, chatId));
  if (dSh && dSh.getLastRow() > 1) {
    var dData = dSh.getRange(2, 7, dSh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < dData.length; i++) {
      xp   += parseInt(dData[i][0]) || 0;
      gold += parseInt(dData[i][1]) || 0;
    }
  }
  // Quest history — XP/gold columns E, F.
  var hSh = ss.getSheetByName(getSh(SH_HISTORY, chatId));
  if (hSh && hSh.getLastRow() > 1) {
    var hData = hSh.getRange(2, 5, hSh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < hData.length; i++) {
      xp   += parseInt(hData[i][0]) || 0;
      gold += parseInt(hData[i][1]) || 0;
    }
  }
  // Shop history — only gold (negative, from purchases).
  var sSh = ss.getSheetByName(getSh(SH_SHOP_HISTORY, chatId));
  if (sSh && sSh.getLastRow() > 1) {
    var sData = sSh.getRange(2, 3, sSh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < sData.length; i++) gold += parseInt(sData[i][0]) || 0;
  }

  // Exponential level curve. L2 at 1000 XP, each subsequent level needs 20%
  // more than the previous. Gives a gentle early ramp and a real grind at L10+.
  var lvl = 1, nextGoal = 1000, passedXp = 0, coefficient = 1.2;
  while (xp >= passedXp + nextGoal) {
    passedXp += nextGoal;
    lvl++;
    nextGoal = Math.floor(nextGoal * coefficient);
  }
  var curXp = xp - passedXp;

  return { lvl: lvl, xp: xp, gold: gold, curXp: curXp, nextGoal: nextGoal };
}

// Unicode progress bar: fills `length` cells, returns "🟦🟦🟦⬜⬜⬜ 50%".
function drawProgressBar(percent, length, fillChar, emptyChar) {
  var filled = Math.max(0, Math.min(length, Math.round((percent / 100) * length)));
  var bar = "";
  for (var i = 0; i < filled; i++) bar += fillChar;
  for (var i = 0; i < length - filled; i++) bar += emptyChar;
  return bar + " " + Math.round(percent) + "%";
}

// ---------------------------------------------------------------------------
// Main hub. Re-rendered on every tap. This is also where the "unopened boxes"
// badge surfaces: compare current level with persisted `looted_lvl_{chatId}`.
// ---------------------------------------------------------------------------
function renderHub(chatId, messageId) {
  resetState(chatId);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var charSheet = ss.getSheetByName(getSh(SH_CHAR, chatId));
  if (!charSheet) {
    initUserSheets(chatId);
    charSheet = ss.getSheetByName(getSh(SH_CHAR, chatId));
  }

  var stats = getRealTimeStats(chatId);
  var cName  = charSheet.getRange("B2").getValue() || L.hub_name_default;
  var cClass = charSheet.getRange("B3").getValue() || L.hub_class_default;
  var xpPercent = (stats.curXp / stats.nextGoal) * 100;

  var props = PropertiesService.getScriptProperties();
  var lastLooted = parseInt(props.getProperty("looted_lvl_" + chatId)) || 1;

  var rows = [];
  if (stats.lvl > lastLooted) {
    rows.push([{ text: L.btn_open_boxes(stats.lvl - lastLooted), callback_data: "open_lootbox" }]);
  }
  rows.push([
    { text: L.btn_expense,  callback_data: "hub_expense" },
    { text: L.btn_exchange, callback_data: "hub_exchange" },
    { text: L.btn_income,   callback_data: "hub_income" },
  ]);
  rows.push([
    { text: L.btn_quests, callback_data: "hub_quests" },
    { text: L.btn_diary,  callback_data: "hub_diary" },
  ]);
  rows.push([
    { text: L.btn_stats,     callback_data: "hub_stats" },
    { text: L.btn_inventory, callback_data: "hub_inv" },
  ]);
  rows.push([
    { text: L.btn_shop,  callback_data: "hub_shop" },
    { text: L.btn_shape, callback_data: "hub_shape" },
  ]);
  rows.push([
    { text: L.btn_profile, callback_data: "edit_profile" },
    { text: L.btn_party,   callback_data: "hub_party" },
  ]);

  var hubText =
    L.hub_title + "\n━━━━━━━━━━━━━━━\n" +
    "🎭 <b>" + cName + "</b> (" + cClass + ")\n" +
    "👤 <b>" + L.hub_level + " " + stats.lvl + "</b>\n" +
    "✨ " + L.hub_xp + ": " + stats.curXp + " / " + stats.nextGoal + "\n" +
    drawProgressBar(xpPercent, 10, "🟦", "⬜️") + "\n" +
    "🪙 <b>" + L.hub_gold + ": " + stats.gold + "</b>\n" +
    "━━━━━━━━━━━━━━━\n" +
    L.hub_prompt;

  renderMenu(chatId, messageId, hubText, { inline_keyboard: rows });
}

// Read-only view of another allowed user's stats. When ALLOWED_USERS has
// fewer than 2 entries the party feature is effectively disabled.
function renderParty(chatId, messageId, callback) {
  var partnerId = getAllowedUsers().find(function (id) { return id !== chatId; });
  if (!partnerId) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.party_empty,
      show_alert: true,
    });
    return;
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var charSheet = ss.getSheetByName(getSh(SH_CHAR, partnerId));
  if (!charSheet) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.party_no_profile,
      show_alert: true,
    });
    return;
  }

  var stats = getRealTimeStats(partnerId);
  var pName  = charSheet.getRange("B2").getValue() || L.hub_name_default;
  var pClass = charSheet.getRange("B3").getValue() || L.hub_class_default;
  var pXpPercent = (stats.curXp / stats.nextGoal) * 100;

  var text =
    L.party_title + "\n━━━━━━━━━━━━━━━\n" +
    "🎭 <b>" + pName + "</b> (" + pClass + ")\n" +
    "👤 <b>" + L.hub_level + " " + stats.lvl + "</b>\n" +
    "✨ " + L.hub_xp + ": " + stats.curXp + " / " + stats.nextGoal + "\n" +
    drawProgressBar(pXpPercent, 10, "🟪", "⬜️") + "\n" +
    "🪙 <b>" + L.hub_gold + ": " + stats.gold + "</b>\n" +
    "━━━━━━━━━━━━━━━";
  renderMenu(chatId, messageId, text, {
    inline_keyboard: [[{ text: L.btn_back_hub, callback_data: "hub_main" }]],
  });
}

// ---------------------------------------------------------------------------
// Profile editor. A two-step flow: type the character name (wait_char_name),
// then pick a class (set_class_*). Both values go into character_{chatId}.
// ---------------------------------------------------------------------------
function startEditProfile(chatId, messageId) {
  resetState(chatId);
  var cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, "wait_char_name", 600);
  cache.put("prompt_msg_id_" + chatId, String(messageId), 600);
  renderMenu(chatId, messageId, L.profile_edit_title, {
    inline_keyboard: [[{ text: L.btn_cancel, callback_data: "hub_main" }]],
  });
}

function sendClassSelection(chatId) {
  var kb = [];
  var row = [];
  for (var i = 0; i < L.classes.length; i++) {
    row.push({
      text: L.class_icons[i] + " " + L.classes[i],
      callback_data: "set_class_" + L.classes[i],
    });
    if (row.length === 2) {
      kb.push(row);
      row = [];
    }
  }
  if (row.length > 0) kb.push(row);

  callTelegram("sendMessage", {
    chat_id: String(chatId),
    text: L.profile_pick_class,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({ inline_keyboard: kb }),
  });
}
