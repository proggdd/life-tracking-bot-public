// ============================================================================
// diary.gs — three-axis mental-state log (mood / energy / anxiety 1..10)
//
// The flow is deliberately a bit unusual for a Telegram bot: three separate
// scale pickers are sent as separate messages so the user can revise any axis
// independently without losing progress on the others. Once all three are
// filled, a confirmation bubble appears, followed by a free-text note prompt.
//
// Each diary row is worth 10 XP / 5 gold, credited at save time.
// ============================================================================

function startDiary(chatId, messageId) {
  resetState(chatId);
  var cache = CacheService.getScriptCache();

  cache.put("diary_stats_" + chatId, JSON.stringify({ m: null, e: null, a: null }), 600);
  cache.put("diary_head_id_" + chatId, String(messageId), 600);

  renderMenu(chatId, messageId, L.diary_title, {
    inline_keyboard: [[{ text: L.btn_cancel, callback_data: "hub_main" }]],
  });

  sendStatKeyboard(chatId, "m", L.diary_mood);
  sendStatKeyboard(chatId, "e", L.diary_energy);
  sendStatKeyboard(chatId, "a", L.diary_anxiety);
}

// One scale message = two rows of 5 buttons each. We remember the message ids
// in diary_scale_ids so resetState can mop them up on cancel.
function sendStatKeyboard(chatId, statType, text) {
  var row1 = [], row2 = [];
  for (var i = 1; i <= 5; i++)  row1.push({ text: String(i), callback_data: "set_stat_" + statType + "_" + i });
  for (var i = 6; i <= 10; i++) row2.push({ text: String(i), callback_data: "set_stat_" + statType + "_" + i });

  var res = callTelegram("sendMessage", {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({ inline_keyboard: [row1, row2] }),
  });
  if (!res) return;
  var rJson = JSON.parse(res.getContentText());
  if (!rJson.ok) return;

  var cache = CacheService.getScriptCache();
  var arr = JSON.parse(cache.get("diary_scale_ids_" + chatId) || "[]");
  arr.push(rJson.result.message_id);
  cache.put("diary_scale_ids_" + chatId, JSON.stringify(arr), 600);
}

function setDiaryStat(chatId, messageId, data) {
  var parts = data.split("_");      // set_stat_<axis>_<value>
  var statType = parts[2];
  var val = parseInt(parts[3]);

  var cache = CacheService.getScriptCache();
  var dsStr = cache.get("diary_stats_" + chatId);
  if (!dsStr) return;
  var ds = JSON.parse(dsStr);
  ds[statType] = val;
  cache.put("diary_stats_" + chatId, JSON.stringify(ds), 600);

  callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: String(messageId),
    text: L.diary_labels[statType] + ": <b>" + val + "</b>",
    parse_mode: "HTML",
  });

  // When all three axes are in, surface the confirm button.
  if (ds.m !== null && ds.e !== null && ds.a !== null) {
    callTelegram("sendMessage", {
      chat_id: chatId,
      text: L.diary_confirm_stats,
      parse_mode: "HTML",
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: L.diary_btn_approve, callback_data: "diary_approve_stats" }],
          [{ text: L.btn_cancel, callback_data: "hub_main" }],
        ],
      }),
    });
  }
}

function approveDiaryStats(chatId, messageId) {
  var cache = CacheService.getScriptCache();
  cache.put("state_" + chatId, "wait_diary_text", 600);
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });

  // Clean up the three scale messages and the header bubble.
  JSON.parse(cache.get("diary_scale_ids_" + chatId) || "[]").forEach(function (id) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(id) });
  });
  var headId = cache.get("diary_head_id_" + chatId);
  if (headId) callTelegram("deleteMessage", { chat_id: chatId, message_id: String(headId) });

  var res = callTelegram("sendMessage", {
    chat_id: chatId,
    text: L.diary_prompt_text,
    parse_mode: "HTML",
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: L.diary_btn_skip, callback_data: "diary_skip_text" }]],
    }),
  });
  if (res) {
    var rJson = JSON.parse(res.getContentText());
    if (rJson.ok) cache.put("diary_prompt_msg_" + chatId, String(rJson.result.message_id), 600);
  }
}

function skipDiaryText(chatId, messageId) {
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
  saveDiaryEntry(chatId, "");
}

function saveDiaryFinal(chatId) {
  var text = CacheService.getScriptCache().get("temp_diary_text_" + chatId) || "";
  saveDiaryEntry(chatId, text);
}

function saveDiaryEntry(chatId, text) {
  var cache = CacheService.getScriptCache();
  var dsStr = cache.get("diary_stats_" + chatId);
  if (!dsStr) return;
  var ds = JSON.parse(dsStr);

  SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(getSh(SH_DIARY, chatId))
    .appendRow([getCurrentDateStr(), getCurrentTimeStr(), ds.m, ds.e, ds.a, text, 10, 5]);

  var promptId = cache.get("diary_prompt_msg_" + chatId);
  cache.removeAll([
    "diary_stats_" + chatId,
    "temp_diary_text_" + chatId,
    "diary_head_id_" + chatId,
    "diary_prompt_msg_" + chatId,
  ]);
  resetState(chatId);

  // Flash a save confirmation, schedule it for GC, then re-render the hub so
  // any level-up that just happened is picked up by renderHub.
  var res = callTelegram("sendMessage", {
    chat_id: String(chatId),
    text: L.diary_saved,
    parse_mode: "HTML",
  });
  var rJson = JSON.parse(res.getContentText());
  if (rJson.ok) scheduleMsgDelete(chatId, rJson.result.message_id);

  if (promptId) {
    callTelegram("deleteMessage", { chat_id: String(chatId), message_id: String(promptId) });
  }

  var callback = {
    data: "hub_main",
    message: { chat: { id: chatId }, message_id: null },
    id: "sys",
  };
  handleCallback(callback);
}
