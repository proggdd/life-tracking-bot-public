// ============================================================================
// dayoff.gs — two-per-week skip tokens
//
// Each user gets 2 day-offs per week. Taking one today grants immunity from
// the daily-quest penalty applied during the next 00:00 reset (see cron.gs).
// Unused tokens convert to a resilience bonus in the Monday newspaper.
//
// State lives in Script Properties:
//   dayoff_left_{chatId}    remaining tokens this week (int 0..2)
//   dayoff_active_{chatId}  date string "dd.MM.yyyy" of today if a token was
//                           used today, otherwise absent
// ============================================================================

function takeDayOff(chatId, messageId, callback) {
  var props = PropertiesService.getScriptProperties();
  var left   = parseInt(props.getProperty("dayoff_left_" + chatId) || "2");
  var active = props.getProperty("dayoff_active_" + chatId) === getCurrentDateStr();

  if (active) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.quest_dayoff_used_today,
      show_alert: true,
    });
    return;
  }
  if (left <= 0) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.quest_dayoff_no_left,
      show_alert: true,
    });
    return;
  }

  props.setProperty("dayoff_left_" + chatId, String(left - 1));
  props.setProperty("dayoff_active_" + chatId, getCurrentDateStr());

  callTelegram("answerCallbackQuery", {
    callback_query_id: String(callback.id),
    text: L.quest_dayoff_ok,
  });
  sendQuestCategories(chatId, messageId);
}
