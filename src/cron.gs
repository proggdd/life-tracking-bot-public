// ============================================================================
// cron.gs — time-based automation
//
// Five schedules, all driven by Google Apps Script triggers. setupAutomation-
// Triggers wipes and re-creates every trigger, so it's safe to call idem-
// potently after edits. Times are evaluated in the user's configured
// TIMEZONE (see config.gs / Script Properties).
//
// Schedule                | Handler                   | When
// ------------------------+---------------------------+------------------------
// Roll over quest status  | resetQuestsRoutine        | every day 00:00
// Pending-work reminder   | sendReminders             | every day 09:00 & 14:00
// Weekly recap newspaper  | weeklyNewspaper           | Mondays 10:00
// Chat garbage collector  | universalGarbageCollector | every 15 minutes
//
// scheduleMsgDelete pushes a message id into PropertiesService, and
// universalGarbageCollector deletes everything that has been sitting there
// for more than an hour. This keeps transient flashes like "saved!" or the
// reminder digest from polluting the chat history.
// ============================================================================

function setupAutomationTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  var tz = getTimezone();
  ScriptApp.newTrigger("resetQuestsRoutine")
    .timeBased().atHour(0).everyDays(1).inTimezone(tz).create();

  ScriptApp.newTrigger("sendReminders")
    .timeBased().atHour(9).everyDays(1).inTimezone(tz).create();
  ScriptApp.newTrigger("sendReminders")
    .timeBased().atHour(14).everyDays(1).inTimezone(tz).create();

  ScriptApp.newTrigger("weeklyNewspaper")
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).inTimezone(tz).create();

  ScriptApp.newTrigger("universalGarbageCollector")
    .timeBased().everyMinutes(15).create();

  console.log("Automation triggers installed.");
}

// ---------------------------------------------------------------------------
// Midnight cross-over routine. Must run as close to 00:00 local as possible
// because it:
//   - evaluates whether yesterday was a day-off for each user (controls
//     whether missed dailies cost XP/gold or not),
//   - logs a "penalty" row per incomplete daily when there was no day-off,
//   - resets the Status checkbox for dailies (every day), weeklies (on
//     Monday), and monthlies (on the 1st of the month).
// ---------------------------------------------------------------------------
function resetQuestsRoutine() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var dayOfWeek  = now.getDay();
  var dayOfMonth = now.getDate();
  var props = PropertiesService.getScriptProperties();

  // "Yesterday" — roll back one hour because the trigger fires at 00:00 so
  // the current day is already the new one.
  var yesterday = new Date(now.getTime() - 3600000);
  var yesterdayStr = Utilities.formatDate(yesterday, getTimezone(), "dd.MM.yyyy");

  getAllowedUsers().forEach(function (chatId) {
    var sheet = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    var changed = false;
    var isDayOff = (props.getProperty("dayoff_active_" + chatId) === yesterdayStr);

    for (var i = 0; i < data.length; i++) {
      var type  = data[i][0];
      var title = data[i][1];
      var isDone = (data[i][4] === true || String(data[i][4]).toUpperCase() === "TRUE");

      if (!isDone && type === "daily" && !isDayOff) {
        logQuestToHistory(chatId, "penalty", title, -1, -1);
      }

      if (isDone) {
        if (type === "daily") { data[i][4] = false; changed = true; }
        else if (type === "weekly"  && dayOfWeek === 1)  { data[i][4] = false; changed = true; }
        else if (type === "monthly" && dayOfMonth === 1) { data[i][4] = false; changed = true; }
      }
    }

    if (changed) sheet.getRange(2, 1, lastRow - 1, 7).setValues(data);
  });
}

// ---------------------------------------------------------------------------
// Twice-a-day digest. Scans each user's quest sheet and diary, assembles a
// single HTML message with:
//   - any quest deadline falling today or tomorrow
//   - pending dailies / weeklies / monthlies
//   - a prod to fill the diary if it hasn't been touched today
// If absolutely nothing is outstanding, nothing is sent (silent-when-green).
// The digest is registered with scheduleMsgDelete so it self-cleans after
// an hour.
// ---------------------------------------------------------------------------
function sendReminders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayStr = getCurrentDateStr();

  getAllowedUsers().forEach(function (chatId) {
    var sheet = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();

    var pendingDailies = [], pendingWeeklies = [], pendingMonthlies = [];
    var deadlineAlerts = [];

    for (var i = 1; i < data.length; i++) {
      var isDone = (data[i][4] === true || String(data[i][4]).toUpperCase() === "TRUE");
      if (isDone) continue;

      var type  = String(data[i][0]).trim();
      var title = String(data[i][1]).trim();
      var deadlineStr = data[i][5];

      if (type === "daily")   pendingDailies.push(L.quest_type_icons.daily + " " + title);
      else if (type === "weekly")  pendingWeeklies.push(L.quest_type_icons.weekly + " " + title);
      else if (type === "monthly") pendingMonthlies.push(L.quest_type_icons.monthly + " " + title);

      if (deadlineStr && String(deadlineStr).trim() !== "" &&
          String(deadlineStr).toLowerCase() !== "false") {
        var dl = parseSheetDate(deadlineStr);
        if (dl && dl.getTime && !isNaN(dl.getTime())) {
          dl.setHours(0, 0, 0, 0);
          var diff = Math.round((dl - today) / 86400000);
          if (diff === 0) deadlineAlerts.push(L.rem_deadline_today(title));
          else if (diff === 1) deadlineAlerts.push(L.rem_deadline_tomorrow(title));
        }
      }
    }

    var diarySheet = ss.getSheetByName(getSh(SH_DIARY, chatId));
    var diaryFilledToday = false;
    if (diarySheet && diarySheet.getLastRow() > 1) {
      var lastVal = diarySheet.getRange(diarySheet.getLastRow(), 1).getValue();
      var lastDiaryDate = (lastVal instanceof Date)
        ? Utilities.formatDate(lastVal, getTimezone(), "dd.MM.yyyy")
        : String(lastVal).trim();
      if (lastDiaryDate === todayStr) diaryFilledToday = true;
    }

    // Silent-when-green: don't spam users who are already on top of things.
    if (pendingDailies.length === 0 && pendingWeeklies.length === 0 &&
        pendingMonthlies.length === 0 && deadlineAlerts.length === 0 &&
        diaryFilledToday) return;

    var msg = L.rem_title + "\n━━━━━━━━━━━━━━━\n";
    if (deadlineAlerts.length > 0)   msg += L.rem_deadlines + "\n" + deadlineAlerts.join("\n") + "\n\n";
    if (pendingDailies.length > 0)   msg += L.rem_dailies   + "\n" + pendingDailies.join("\n") + "\n\n";
    if (pendingWeeklies.length > 0)  msg += L.rem_weeklies  + "\n" + pendingWeeklies.join("\n") + "\n\n";
    if (pendingMonthlies.length > 0) msg += L.rem_monthlies + "\n" + pendingMonthlies.join("\n") + "\n\n";
    if (!diaryFilledToday)           msg += L.rem_diary_missing + "\n\n";
    msg += "━━━━━━━━━━━━━━━\n" + L.rem_footer;

    var kb = { inline_keyboard: [[{ text: L.btn_close, callback_data: "close_menu" }]] };
    var res = callTelegram("sendMessage", {
      chat_id: chatId, text: msg, parse_mode: "HTML",
      reply_markup: JSON.stringify(kb),
    });
    if (res) {
      var rJson = JSON.parse(res.getContentText());
      if (rJson.ok) scheduleMsgDelete(chatId, rJson.result.message_id);
    }
  });
}

// ---------------------------------------------------------------------------
// Weekly recap. Runs Mondays at 10:00. Credits a resilience bonus for any
// unused days off, then resets the day-off budget to 2. A 7-day window on
// the quest_history sheet fuels the dailies/weeklies/skipped/net
// XP/gold table.
// ---------------------------------------------------------------------------
function weeklyNewspaper() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var props = PropertiesService.getScriptProperties();

  getAllowedUsers().forEach(function (chatId) {
    var left = parseInt(props.getProperty("dayoff_left_" + chatId) || "2");
    var bonusXp = 0, bonusGold = 0;
    if (left === 1) { bonusXp = 62;  bonusGold = 50;  }
    else if (left === 2) { bonusXp = 125; bonusGold = 100; }
    if (bonusXp > 0) {
      logQuestToHistory(chatId, "bonus",
        "Resilience bonus (day-offs left: " + left + ")", bonusXp, bonusGold);
    }
    // Fresh week, fresh budget.
    props.setProperty("dayoff_left_" + chatId, "2");

    var sh = ss.getSheetByName(getSh(SH_HISTORY, chatId));
    var qStats = { daily: 0, weekly: 0, penalty: 0 };
    var totalBonusXP = 0, totalBonusGold = 0;
    var penaltyXP = 0, penaltyGold = 0;
    var netXP = 0, netGold = 0;

    var weekAgo = new Date(now.getTime() - 7 * 86400000);
    weekAgo.setHours(0, 0, 0, 0);

    if (sh && sh.getLastRow() > 1) {
      var data = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
      for (var i = 0; i < data.length; i++) {
        var d = parseSheetDate(data[i][0]);
        if (d < weekAgo) continue;
        var type = data[i][2];
        var xp   = parseInt(data[i][4]) || 0;
        var gold = parseInt(data[i][5]) || 0;
        if (qStats[type] !== undefined) qStats[type]++;
        if (type === "bonus")   { totalBonusXP += xp; totalBonusGold += gold; }
        else if (type === "penalty") { penaltyXP += xp; penaltyGold += gold; }
        netXP   += xp;
        netGold += gold;
      }
    }

    var msg =
      L.news_title + "\n━━━━━━━━━━━━━━━\n" +
      L.news_dailies_done (qStats.daily)  + "\n" +
      L.news_weeklies_done(qStats.weekly) + "\n" +
      L.news_dayoffs(2 - left) + "\n\n" +
      L.news_bonuses(totalBonusXP, totalBonusGold) + "\n" +
      L.news_skipped(qStats.penalty) + "\n" +
      L.news_penalties(penaltyXP, penaltyGold) + "\n\n" +
      L.news_net(netXP, netGold) + "\n" +
      "━━━━━━━━━━━━━━━\n" + L.news_footer;

    var res = callTelegram("sendMessage", {
      chat_id: chatId, text: msg, parse_mode: "HTML",
    });
    if (res) {
      var rJson = JSON.parse(res.getContentText());
      if (rJson.ok) scheduleMsgDelete(chatId, rJson.result.message_id);
    }
  });
}

// ---------------------------------------------------------------------------
// Delayed-delete helper: pushes a chat/message pair onto the gc_list.
// universalGarbageCollector consumes the list every 15 minutes.
// ---------------------------------------------------------------------------
function scheduleMsgDelete(chatId, messageId) {
  if (!messageId) return;
  var props = PropertiesService.getScriptProperties();
  var list = JSON.parse(props.getProperty("gc_list") || "[]");
  list.push({ c: String(chatId), m: String(messageId), t: new Date().getTime() });
  props.setProperty("gc_list", JSON.stringify(list));
}

function updateLastActivity(chatId, state) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("last_active_" + chatId, new Date().getTime().toString());
  if (state) props.setProperty("current_menu_" + chatId, state);
}

// ---------------------------------------------------------------------------
// Chat-level garbage collector + idle-snap-to-hub. Runs every 15 minutes.
//   1. Anything in gc_list older than 1h is physically deleted from chat.
//   2. Any user who has been on a non-hub screen for >30 min gets bounced
//      back to the main hub, which also clears any "wait_*" cache state.
// ---------------------------------------------------------------------------
function universalGarbageCollector() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date().getTime();

  var list = JSON.parse(props.getProperty("gc_list") || "[]");
  var keep = [];
  for (var i = 0; i < list.length; i++) {
    if (now - list[i].t > 3600000) {
      callTelegram("deleteMessage", { chat_id: list[i].c, message_id: list[i].m });
    } else {
      keep.push(list[i]);
    }
  }
  props.setProperty("gc_list", JSON.stringify(keep));

  getAllowedUsers().forEach(function (chatId) {
    var lastActive  = parseInt(props.getProperty("last_active_"  + chatId) || "0");
    var currentMenu = props.getProperty("current_menu_" + chatId);

    if (lastActive > 0 && currentMenu !== "hub_main" && (now - lastActive > 1800000)) {
      resetState(chatId);
      handleCallback({
        data: "hub_main",
        message: { chat: { id: chatId }, message_id: null },
        id: "sys",
      });
      props.setProperty("last_active_"  + chatId, now.toString());
      props.setProperty("current_menu_" + chatId, "hub_main");
    }
  });
}
