// ============================================================================
// shop.gs — reward catalogue and checkout
//
// The shop catalogue (`shop_catalog`) is a globally shared sheet. Users share
// the same list of rewards but spend their own gold. Each purchase lands in
// the user's `shop_history_{chatId}` ledger as a negative gold_delta, which
// getRealTimeStats later subtracts from the running total.
// ============================================================================

function renderShop(chatId, messageId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shopSheet = ss.getSheetByName(SH_SHOP);
  if (!shopSheet) {
    setupShopSheet();
    shopSheet = ss.getSheetByName(SH_SHOP);
  }

  var items = shopSheet.getLastRow() > 1
    ? shopSheet.getRange(2, 1, shopSheet.getLastRow() - 1, 2).getValues()
    : [];

  var cache = CacheService.getScriptCache();
  var cart = cache.get("shop_cart_" + chatId)
    ? JSON.parse(cache.get("shop_cart_" + chatId))
    : {};

  var kb = [];
  var totalCartPrice = 0, totalItems = 0;

  for (var i = 0; i < items.length; i++) {
    if (!items[i][0]) continue;
    var fullName = items[i][0];
    var price    = parseInt(items[i][1]);
    var qty      = cart[i + 2] || 0;
    var short    = fullName.split(" (")[0];
    if (short.length > 22) short = short.substring(0, 20) + "…";

    var btnText = (qty > 0 ? "🛒 [" + qty + "] " : "📦 ") + short + " — " + price + " 🪙";
    kb.push([{ text: btnText, callback_data: "shop_add_" + (i + 2) }]);
    totalCartPrice += qty * price;
    totalItems     += qty;
  }
  if (totalItems > 0) {
    kb.push([{ text: L.shop_btn_pay(totalCartPrice), callback_data: "shop_checkout" }]);
    kb.push([{ text: L.shop_btn_clear, callback_data: "shop_clear" }]);
  }
  kb.push([{ text: L.btn_back_hub, callback_data: "hub_main" }]);

  var stats = getRealTimeStats(chatId);
  var header =
    L.shop_title + "\n━━━━━━━━━━━━━━━\n" +
    L.shop_balance(stats.gold) + "\n" +
    (totalItems > 0 ? L.shop_cart_summary(totalItems, totalCartPrice) : "") +
    "━━━━━━━━━━━━━━━\n" + L.shop_tap_to_add;

  renderMenu(chatId, messageId, header, { inline_keyboard: kb });
}

function addToShopCart(chatId, data, callback) {
  var cache = CacheService.getScriptCache();
  var row = parseInt(data.substring("shop_add_".length));
  var cart = cache.get("shop_cart_" + chatId) ? JSON.parse(cache.get("shop_cart_" + chatId)) : {};
  cart[row] = (cart[row] || 0) + 1;
  cache.put("shop_cart_" + chatId, JSON.stringify(cart), 3600);

  // Re-render the catalogue so the counter updates inline.
  callback.data = "hub_shop";
  handleCallback(callback);
}

function clearShopCart(chatId, callback) {
  CacheService.getScriptCache().remove("shop_cart_" + chatId);
  callback.data = "hub_shop";
  handleCallback(callback);
}

function checkoutShop(chatId, messageId, callback) {
  var cache = CacheService.getScriptCache();
  var cart = cache.get("shop_cart_" + chatId) ? JSON.parse(cache.get("shop_cart_" + chatId)) : {};

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SHOP);
  var stats = getRealTimeStats(chatId);
  var curGold = stats.gold;

  var totalPrice = 0, receipt = "", itemsToGive = [];
  for (var r in cart) {
    var itemData = sheet.getRange(parseInt(r), 1, 1, 2).getValues()[0];
    var name  = itemData[0];
    var price = parseInt(itemData[1]);
    var qty   = cart[r];
    totalPrice += price * qty;
    receipt    += "• " + name + " x" + qty + "\n";
    itemsToGive.push({ n: name, q: qty, p: price * qty });
  }

  if (curGold < totalPrice) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.shop_insufficient(totalPrice),
      show_alert: true,
    });
    return;
  }
  for (var i = 0; i < itemsToGive.length; i++) {
    logPurchase(chatId, itemsToGive[i].n + " (x" + itemsToGive[i].q + ")", itemsToGive[i].p);
    addInventoryItem(chatId, itemsToGive[i].n, itemsToGive[i].q);
  }
  cache.remove("shop_cart_" + chatId);

  var msg =
    L.shop_success_title + "\n━━━━━━━━━━━━━━━\n" +
    receipt +
    "━━━━━━━━━━━━━━━\n" +
    L.shop_success_spent(totalPrice) + "\n" +
    L.shop_success_inv;

  renderMenu(chatId, messageId, msg, {
    inline_keyboard: [[{ text: L.shop_back_to_catalog, callback_data: "hub_shop" }]],
  });
}

// Record a purchase. gold_delta is stored as a negative so getRealTimeStats
// can naive-sum column C without special casing.
function logPurchase(chatId, itemName, price) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(getSh(SH_SHOP_HISTORY, chatId));
  if (!sh) {
    setupShopHistorySheet(chatId);
    sh = ss.getSheetByName(getSh(SH_SHOP_HISTORY, chatId));
  }
  sh.appendRow([getCurrentDateStr() + " " + getCurrentTimeStr(), itemName, -price]);
}
