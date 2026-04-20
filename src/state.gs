// ============================================================================
// state.gs — conversation state + cache helpers
//
// All per-chat runtime state lives in CacheService with a 10-minute default
// TTL. Keys are namespaced by chatId:
//   state_{chatId}            current named wait-state
//   prompt_msg_id_{chatId}    message id of the latest prompt (for cleanup)
//   flow_type_{chatId}        "expense" or "income" for the finance flow
//   cur_tx_{chatId}           current transaction being built (JSON)
//   cart_{chatId}             transactions queued for batch save (JSON array)
//   q_cart_{chatId}           quests queued for batch submission (row ids)
//   shop_cart_{chatId}        shopping cart (JSON {row: qty})
//   cat_cart_{chatId}         category multi-select
//   diary_stats_{chatId}      3-axis diary values before text
//   diary_scale_ids_{chatId}  message ids of diary scale prompts for cleanup
//   temp_q_type_{chatId}      quest type being created
//   temp_diary_text_{chatId}  diary text buffer
//   exc_*_{chatId}            four-step currency exchange buffers
// ============================================================================

function resetState(chatId) {
  var cache = CacheService.getScriptCache();

  // Clean up any floating prompt / scale messages still on screen.
  var scaleIds = JSON.parse(cache.get("diary_scale_ids_" + chatId) || "[]");
  scaleIds.forEach(function (id) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(id) });
  });
  var headId = cache.get("diary_head_id_" + chatId);
  if (headId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(headId) });
  }
  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(pId) });
  }

  cache.removeAll([
    "state_" + chatId,
    "cur_tx_" + chatId,
    "temp_diary_text_" + chatId,
    "flow_type_" + chatId,
    "diary_stats_" + chatId,
    "temp_q_type_" + chatId,
    "diary_scale_ids_" + chatId,
    "diary_head_id_" + chatId,
    "diary_prompt_msg_" + chatId,
    "prompt_msg_id_" + chatId,
    "cat_cart_" + chatId,
  ]);
}

function updateLastActivity(chatId, state) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("last_active_" + chatId, new Date().getTime().toString());
  if (state) props.setProperty("current_menu_" + chatId, state);
}
