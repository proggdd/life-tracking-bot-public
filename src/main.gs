// ============================================================================
// main.gs — Telegram webhook entry point + text state router
//
// doPost is registered as the Web App `exec` endpoint. Every Telegram update
// (message / callback_query) arrives here. The function does three things:
//
//   1. Authenticate: drop updates from chat IDs not in ALLOWED_USERS.
//   2. Dispatch callback_query to handleCallback() — the inline-button router.
//   3. Dispatch message.text to the wait-state router below — a flat switch on
//      `state_{chatId}` from CacheService. Every multi-step text input flow
//      (weight, quest title, transaction amount, FX amount, diary text, etc.)
//      is a named state with a single handler.
//
// The text router intentionally deletes the user's incoming message on the
// happy path to keep the chat clean. On validation error it re-prompts in the
// same message bubble via renderMenu(..., null, ...).
// ============================================================================

function doPost(e) {
  if (!e || !e.postData) return;

  var contents = JSON.parse(e.postData.contents);
  var cache = CacheService.getScriptCache();

  if (contents.callback_query) {
    handleCallback(contents.callback_query);
    return;
  }
  if (!contents.message) return;

  var msg = contents.message;
  var chatId = String(msg.chat.id);
  var text = msg.text || "";

  if (getAllowedUsers().indexOf(chatId) === -1) return;

  var lowerText = text.toLowerCase().trim();
  var state = cache.get("state_" + chatId);

  // Global command phrases — recognise them regardless of active state.
  var globalCmds = ["/start", L.sys_bottom_hub.toLowerCase(), "menu", "hub", L.sys_bottom_help.toLowerCase(), "help"];
  var isCancel   = lowerText.indexOf("cancel") !== -1 || lowerText.indexOf("stop") !== -1;
  var isHub      = globalCmds.indexOf(lowerText) !== -1 || isCancel;

  if (isHub) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });
    resetState(chatId);
    initUserSheets(chatId);

    var bottomKb = {
      keyboard: [[{ text: L.sys_bottom_hub }, { text: L.sys_bottom_help }]],
      resize_keyboard: true,
    };
    callTelegram("sendMessage", {
      chat_id: chatId,
      text: L.initialized,
      parse_mode: "HTML",
      reply_markup: JSON.stringify(bottomKb),
    });
    sendMainMenu(chatId);
    return;
  }

  if (lowerText === L.sys_bottom_help.toLowerCase() || lowerText === "help") {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });
    callTelegram("sendMessage", {
      chat_id: chatId,
      text: L.help_title + "\n\n" + L.help_body,
      parse_mode: "HTML",
      reply_markup: JSON.stringify({
        inline_keyboard: [[{ text: L.btn_close, callback_data: "close_menu" }]],
      }),
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // Wait-state dispatcher. One handler per state.
  // ---------------------------------------------------------------------------
  if (state === "wait_char_name")     return handleCharNameInput(chatId, msg, text);
  if (state === "wait_weight")        return handleWeightInput(chatId, msg, text);
  if (state === "wait_stat_dates")    return handleStatDatesInput(chatId, msg, text);
  if (state === "wait_quest_add")     return handleQuestAddInput(chatId, msg, text);
  if (state === "wait_amount")        return handleTxAmountInput(chatId, msg, text);
  if (state === "wait_exc_amt1")      return handleExcAmt1Input(chatId, msg, text);
  if (state === "wait_exc_amt2")      return handleExcAmt2Input(chatId, msg, text);
  if (state === "wait_exc_comm_amt")  return handleExcCommInput(chatId, msg, text);
  if (state === "wait_new_cat")       return handleNewCategoryInput(chatId, msg, text);
  if (state === "wait_diary_text")    return handleDiaryTextInput(chatId, msg, text);
}

// Helper used by the "back to hub" flow, by the diary save flow, and by any
// finalizer that wants to re-render the main screen cleanly.
function sendMainMenu(chatId) {
  deleteLastMenu(chatId);
  var callback = {
    data: "hub_main",
    message: { chat: { id: chatId }, message_id: null },
    id: "sys",
  };
  handleCallback(callback);
}

// ============================================================================
// Wait-state input handlers
// ============================================================================

function handleCharNameInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var charSheet = ss.getSheetByName(getSh(SH_CHAR, chatId));
  if (!charSheet) {
    initUserSheets(chatId);
    charSheet = ss.getSheetByName(getSh(SH_CHAR, chatId));
  }
  if (charSheet) charSheet.getRange("B2").setValue(text);
  resetState(chatId);
  sendClassSelection(chatId);
}

function handleWeightInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var weight = parseFloat(text.replace(",", "."));
  if (isNaN(weight)) {
    renderMenu(chatId, null, "❌ Not a number. Type a weight (e.g. 82.5):", null);
    return;
  }
  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(getSh(SH_WEIGHT, chatId));
  if (!sh) {
    setupWeightSheet(chatId);
    sh = ss.getSheetByName(getSh(SH_WEIGHT, chatId));
  }
  sh.appendRow([getCurrentDateStr(), getCurrentTimeStr(), weight]);

  resetState(chatId);
  renderMenu(chatId, null, L.shape_saved(weight), {
    inline_keyboard: [
      [{ text: L.shape_back, callback_data: "hub_shape" }],
      [{ text: L.btn_back_hub, callback_data: "hub_main" }],
    ],
  });
}

function handleStatDatesInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var cat = cache.get("stat_cat_" + chatId);
  var match = text.match(/^(\d{6})\s+(\d{6})$/);
  if (!match) {
    renderMenu(chatId, null, L.stats_err_dates, null);
    return;
  }
  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }
  resetState(chatId);

  var report = generateAdvancedReport(cat, "custom", match[1], match[2], chatId);
  renderMenu(chatId, null, report, {
    inline_keyboard: [[
      { text: L.btn_back_hub, callback_data: "hub_main" },
      { text: L.btn_close, callback_data: "close_menu" },
    ]],
  });
}

function handleQuestAddInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var qType = cache.get("temp_q_type_" + chatId);
  var defaults = QUEST_DEFAULT_REWARDS[qType] || QUEST_DEFAULT_REWARDS.daily;
  var xp = defaults.xp, gold = defaults.gold;

  // Inline syntax: "<title> <xp> <gold>" overrides defaults.
  var title = text;
  var m = text.match(/(.*?)\s+(\d+)\s+(\d+)$/);
  if (m) {
    title = m[1].trim();
    xp = parseInt(m[2]);
    gold = parseInt(m[3]);
  }

  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_QUEST, chatId));
  sh.appendRow([qType, title, xp, gold, false, "", ""]);

  resetState(chatId);
  renderMenu(chatId, null, L.quest_added(title, xp, gold), {
    inline_keyboard: [[{ text: L.btn_back, callback_data: "q_back_to_cats" }]],
  });
}

function handleTxAmountInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var parsed = parseMathAndNote(text);
  if (!parsed.success) {
    renderMenu(chatId, null, L.fin_err_number, null);
    return;
  }
  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }
  var curTx = JSON.parse(cache.get("cur_tx_" + chatId));
  curTx.amount = parsed.amount;
  curTx.note = parsed.note;
  cache.put("cur_tx_" + chatId, JSON.stringify(curTx), 600);

  sendCategoryKeyboard(chatId, cache.get("flow_type_" + chatId));
}

function handleExcAmt1Input(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var parsed = parseMathAndNote(text);
  if (!parsed.success) {
    renderMenu(chatId, null, L.exc_err_number, null);
    return;
  }
  cache.put("exc_amt1_" + chatId, String(parsed.amount), 600);

  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }

  var kb = { inline_keyboard: buildCurrencyKeyboard("exc2_", "hub_main") };
  var m = callTelegram("sendMessage", {
    chat_id: chatId,
    text: L.exc_step2,
    parse_mode: "HTML",
    reply_markup: JSON.stringify(kb),
  });
  rememberPrompt(chatId, m);
  cache.remove("state_" + chatId);
}

function handleExcAmt2Input(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var parsed = parseMathAndNote(text);
  if (!parsed.success) {
    renderMenu(chatId, null, L.exc_err_number, null);
    return;
  }
  cache.put("exc_amt2_" + chatId, String(parsed.amount), 600);

  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }
  cache.put("state_" + chatId, "wait_exc_comm_amt", 600);

  var kb = {
    inline_keyboard: [
      [{ text: L.exc_no_fee, callback_data: "exc_skip_comm" }],
      [{ text: L.btn_cancel, callback_data: "hub_main" }],
    ],
  };
  var m = callTelegram("sendMessage", {
    chat_id: chatId,
    text: L.exc_step3,
    parse_mode: "HTML",
    reply_markup: JSON.stringify(kb),
  });
  rememberPrompt(chatId, m);
}

function handleExcCommInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var parsed = parseMathAndNote(text);
  if (!parsed.success) {
    renderMenu(chatId, null, L.exc_err_number_fee, null);
    return;
  }
  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }
  cache.put("exc_comm_amt_" + chatId, String(parsed.amount), 600);
  cache.remove("state_" + chatId);

  var kb = { inline_keyboard: buildCurrencyKeyboard("exc3_", "hub_main") };
  var m = callTelegram("sendMessage", {
    chat_id: chatId,
    text: L.exc_step4_prefix + parsed.amount + "):",
    parse_mode: "HTML",
    reply_markup: JSON.stringify(kb),
  });
  rememberPrompt(chatId, m);
}

function handleNewCategoryInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });

  var flowType = cache.get("flow_type_" + chatId);
  addCategoryToSheet(flowType, text);

  var pId = cache.get("prompt_msg_id_" + chatId);
  if (pId) {
    callTelegram("deleteMessage", { chat_id: chatId, message_id: pId });
    cache.remove("prompt_msg_id_" + chatId);
  }
  cache.put("state_" + chatId, "wait_category", 600);
  sendCategoryKeyboard(chatId, flowType);
}

function handleDiaryTextInput(chatId, msg, text) {
  var cache = CacheService.getScriptCache();
  callTelegram("deleteMessage", { chat_id: chatId, message_id: String(msg.message_id) });
  cache.put("temp_diary_text_" + chatId, text, 600);

  var promptId = cache.get("diary_prompt_msg_" + chatId);
  var kb = {
    inline_keyboard: [
      [{ text: L.diary_btn_save, callback_data: "diary_save_final" }],
      [{ text: L.btn_cancel, callback_data: "hub_main" }],
    ],
  };
  renderMenu(chatId, promptId, L.diary_preview(text), kb);
}

// ---------------------------------------------------------------------------
// Small shared utilities used by the wait-state handlers.
// ---------------------------------------------------------------------------

// Quest default rewards by type — used when the user supplies only a title.
var QUEST_DEFAULT_REWARDS = {
  daily:    { xp: 10,  gold: 5 },
  weekly:   { xp: 50,  gold: 20 },
  monthly:  { xp: 150, gold: 50 },
  raid:     { xp: 200, gold: 100 },
  epic:     { xp: 500, gold: 200 },
  personal: { xp: 20,  gold: 10 },
};

// Build a 2-column inline currency keyboard with a trailing cancel row.
function buildCurrencyKeyboard(prefix, cancelData) {
  var rows = [];
  var row = [];
  for (var i = 0; i < L.currencies.length; i++) {
    var cur = L.currencies[i];
    var icon = L.currency_icons[cur] || "💱";
    row.push({ text: icon + " " + cur, callback_data: prefix + cur });
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push(row);
  rows.push([{ text: L.btn_back_hub, callback_data: cancelData || "hub_main" }]);
  return rows;
}

// Remember the last bot prompt message id so it can be cleaned up when the
// next state transitions in. Called right after callTelegram("sendMessage").
function rememberPrompt(chatId, sendRes) {
  if (!sendRes) return;
  var cache = CacheService.getScriptCache();
  var body = JSON.parse(sendRes.getContentText());
  if (body.ok) cache.put("prompt_msg_id_" + chatId, String(body.result.message_id), 600);
}

// Tolerant calculator. Accepts "100 + 250 - 50 note text" and extracts
// {amount: 300, note: "note text"}. Walks the left side down by one word at a
// time until eval() yields a number, so a note that shadows the expression
// ("groceries 20% off") still parses.
function parseMathAndNote(text) {
  var match = text.match(/^([\d\s+\-*/.,()]+)/);
  if (!match) return { success: false };
  var rawStr = match[1].trim();
  var amount = null;

  while (rawStr.length > 0) {
    try {
      var result = eval(rawStr.replace(/,/g, "."));
      if (typeof result === "number" && !isNaN(result)) {
        amount = result;
        break;
      }
    } catch (e) {
      var lastSpace = rawStr.lastIndexOf(" ");
      if (lastSpace === -1) break;
      rawStr = rawStr.substring(0, lastSpace).trim();
    }
  }
  if (amount === null) return { success: false };

  return {
    success: true,
    amount: Math.abs(amount),
    note: text.substring(text.indexOf(rawStr) + rawStr.length)
      .trim()
      .replace(/^[-–—]\s*/, ""),
  };
}
