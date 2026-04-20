// ============================================================================
// router.gs — handleCallback: the single callback_query dispatcher
//
// Every inline button we render encodes its action as a short string in
// `callback_data`. This file decodes that string and delegates to one of the
// feature modules. Grouping routes here keeps the wire protocol explicit and
// makes it trivial to audit which prefix belongs to which subsystem.
//
// Callback prefix map:
//   hub_*, open_lootbox, edit_profile, set_class_*  -> rpg.gs, lootbox.gs
//   q_*, take_dayoff                                 -> quests.gs, dayoff.gs
//   shop_*                                           -> shop.gs
//   inv_*                                            -> inventory.gs
//   diary_*, set_stat_*                              -> diary.gs
//   shape_*                                          -> weight.gs
//   cur_*, add_cat, cat_toggle_*, cat_conf, cart_*   -> finance.gs
//   exc1_*, exc2_*, exc3_*, exc_skip_comm            -> exchange.gs
//   stat_cat_*, stat_run_*                           -> analytics.gs
//   close_menu                                       -> inline
// ============================================================================

function handleCallback(callback) {
  var chatId    = String(callback.message.chat.id);
  var data      = callback.data;
  var messageId = callback.message ? callback.message.message_id : null;

  updateLastActivity(chatId, data);

  if (callback.id && callback.id !== "sys") {
    callTelegram("answerCallbackQuery", { callback_query_id: String(callback.id) });
  }
  if (data === "close_menu") {
    if (messageId) callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
    return;
  }
  if (getAllowedUsers().indexOf(chatId) === -1) return;

  var cache = CacheService.getScriptCache();
  var flowType = cache.get("flow_type_" + chatId);

  // ---- hub / profile / party -------------------------------------------------
  if (data === "hub_main")   return renderHub(chatId, messageId);
  if (data === "hub_party")  return renderParty(chatId, messageId, callback);
  if (data === "edit_profile") return startEditProfile(chatId, messageId);
  if (data.indexOf("set_class_") === 0) {
    var cls = data.substring("set_class_".length);
    var charSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getSh(SH_CHAR, chatId));
    if (charSheet) charSheet.getRange("B3").setValue(cls);
    if (messageId) callTelegram("deleteMessage", { chat_id: chatId, message_id: String(messageId) });
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.profile_class_set(cls),
    });
    callback.data = "hub_main";
    handleCallback(callback);
    return;
  }

  // ---- shape (weight) --------------------------------------------------------
  if (data === "hub_shape") return renderShape(chatId, messageId);
  if (data === "shape_add") return promptWeight(chatId, messageId);

  // ---- lootbox ---------------------------------------------------------------
  if (data === "open_lootbox") return openLootbox(chatId, messageId, callback);

  // ---- inventory -------------------------------------------------------------
  if (data === "hub_inv")                   return renderInventory(chatId, messageId);
  if (data.indexOf("inv_use_")  === 0)      return confirmUseItem(chatId, messageId, data);
  if (data.indexOf("inv_conf_") === 0)      return useItem(chatId, messageId, data, callback);
  if (data === "inv_refund")                return refundItem(chatId, callback);
  if (data.indexOf("inv_skip_") === 0)      return skipQuestWithItem(chatId, messageId, data);

  // ---- quests / dayoff -------------------------------------------------------
  if (data === "hub_quests")                return sendQuestCategories(chatId, messageId);
  if (data === "q_back_to_cats")            return sendQuestCategories(chatId, messageId);
  if (data.indexOf("q_cat_") === 0) {
    cache.remove("q_cart_" + chatId);
    return sendQuestList(chatId, data.substring("q_cat_".length), messageId);
  }
  if (data.indexOf("q_add_") === 0)         return startAddQuest(chatId, messageId, data);
  if (data === "take_dayoff")               return takeDayOff(chatId, messageId, callback);
  if (data.indexOf("q_toggle_")   === 0)    return toggleQuestInCart(chatId, messageId, data);
  if (data.indexOf("q_cart_conf_") === 0)   return confirmQuestCart(chatId, messageId, data);
  if (data.indexOf("q_cart_submit_") === 0) return submitQuestCart(chatId, messageId, data);
  if (data === "q_done_all_dailies")        return promptCloseAllDailies(chatId, messageId);
  if (data === "q_done_all_submit")         return submitCloseAllDailies(chatId, messageId);

  // ---- shop ------------------------------------------------------------------
  if (data === "hub_shop")                  return renderShop(chatId, messageId);
  if (data.indexOf("shop_add_") === 0)      return addToShopCart(chatId, data, callback);
  if (data === "shop_clear")                return clearShopCart(chatId, callback);
  if (data === "shop_checkout")             return checkoutShop(chatId, messageId, callback);

  // ---- diary -----------------------------------------------------------------
  if (data === "hub_diary")                 return startDiary(chatId, messageId);
  if (data.indexOf("set_stat_") === 0)      return setDiaryStat(chatId, messageId, data);
  if (data === "diary_approve_stats")       return approveDiaryStats(chatId, messageId);
  if (data === "diary_skip_text")           return skipDiaryText(chatId, messageId);
  if (data === "diary_save_final")          return saveDiaryFinal(chatId);

  // ---- exchange --------------------------------------------------------------
  if (data === "hub_exchange")              return startExchange(chatId, messageId);
  if (data.indexOf("exc1_") === 0)          return pickExchangeGiveCurrency(chatId, messageId, data);
  if (data.indexOf("exc2_") === 0)          return pickExchangeReceiveCurrency(chatId, messageId, data);
  if (data === "exc_skip_comm")             return skipExchangeFee(chatId, messageId);
  if (data.indexOf("exc3_") === 0)          return pickExchangeFeeCurrency(chatId, messageId, data);

  // ---- finance ---------------------------------------------------------------
  if (data === "hub_expense") return startTransactionFlow(chatId, "expense", messageId);
  if (data === "hub_income")  return startTransactionFlow(chatId, "income",  messageId);
  if (data.indexOf("cur_") === 0)           return setTransactionCurrency(chatId, messageId, data);
  if (data === "add_cat")                   return promptNewCategory(chatId, messageId);
  if (data.indexOf("cat_toggle_") === 0)    return toggleCategory(chatId, messageId, data, flowType);
  if (data === "cat_conf")                  return confirmCategories(chatId, messageId, flowType);
  if (data === "cart_add")                  return addTxToCart(chatId, messageId);
  if (data === "cart_more")                 return startTransactionFlow(chatId, flowType, messageId);
  if (data === "cart_save")                 return saveCartToLedger(chatId, messageId);

  // ---- analytics -------------------------------------------------------------
  if (data === "hub_stats")                 return sendStatMainMenu(chatId, messageId);
  if (data.indexOf("stat_cat_") === 0) {
    return sendStatPeriodMenu(chatId, data.substring("stat_cat_".length), messageId);
  }
  if (data.indexOf("stat_run_") === 0)      return runStatReport(chatId, messageId, data);
}
