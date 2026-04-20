// ============================================================================
// telegram.gs — thin Telegram Bot API wrapper
// ============================================================================

function callTelegram(method, payload) {
  var options = { method: "post", payload: payload, muteHttpExceptions: true };
  return UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + getBotToken() + "/" + method,
    options
  );
}

function sendMessage(chatId, text) {
  callTelegram("sendMessage", {
    chat_id: String(chatId),
    text: text,
    parse_mode: "HTML",
  });
}

// renderMenu is the bot's single UI primitive. When a message_id is passed, we
// edit the existing message in place — this is how we keep the chat from
// filling up with stale keyboards. When it's null, we send a new message and
// remember its id in the cache so the next render can delete it.
function renderMenu(chatId, messageId, text, kb) {
  var cache = CacheService.getScriptCache();
  if (messageId) {
    callTelegram("editMessageText", {
      chat_id: String(chatId),
      message_id: String(messageId),
      text: text,
      parse_mode: "HTML",
      reply_markup: kb ? JSON.stringify(kb) : undefined,
    });
    return;
  }
  var lastMsgId = cache.get("last_msg_id_" + chatId);
  if (lastMsgId) {
    callTelegram("deleteMessage", {
      chat_id: String(chatId),
      message_id: String(lastMsgId),
    });
  }
  var res = callTelegram("sendMessage", {
    chat_id: String(chatId),
    text: text,
    parse_mode: "HTML",
    reply_markup: kb ? JSON.stringify(kb) : undefined,
  });
  var resJson = JSON.parse(res.getContentText());
  if (resJson.ok) {
    cache.put("last_msg_id_" + chatId, String(resJson.result.message_id), 3600);
  }
}

function deleteLastMenu(chatId) {
  var cache = CacheService.getScriptCache();
  var lastMsgId = cache.get("last_msg_id_" + chatId);
  if (lastMsgId) {
    callTelegram("deleteMessage", {
      chat_id: String(chatId),
      message_id: String(lastMsgId),
    });
    cache.remove("last_msg_id_" + chatId);
  }
}

// One-shot setup utility. Read the deployment URL from Script Properties and
// register it with Telegram as the webhook endpoint. Run once per deploy.
function updateWebhook() {
  var url = getDeploymentUrl();
  if (!url) {
    throw new Error("DEPLOYMENT_URL is not set in Script Properties");
  }
  Logger.log(
    UrlFetchApp.fetch(
      "https://api.telegram.org/bot" + getBotToken() + "/setWebhook?url=" + encodeURIComponent(url)
    ).getContentText()
  );
}
