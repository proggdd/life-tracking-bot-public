// ============================================================================
// lootbox.gs — level-up reward boxes (5 rarity tiers + guaranteed gold)
//
// When the user ticks quests and levels up, a "box pending" badge appears in
// the hub. Each box is opened one at a time. Opening award two things:
//
//   1. Guaranteed level reward: targetLvl * 100 gold.
//   2. Random roll across 5 rarity tiers. Some tiers yield gold, others drop
//      an inventory item instead.
//
// We persist `looted_lvl_{chatId}` in Script Properties so a reload or a
// rogue tap in the hub can't double-claim.
// ============================================================================

// Rarity table. Tune rates here.
var LOOT_TIERS = [
  { name: "common",    chance: 0.50 },
  { name: "uncommon",  chance: 0.30 },
  { name: "rare",      chance: 0.15 },
  { name: "epic",      chance: 0.04 },
  { name: "legendary", chance: 0.01 },
];

// Prize pool per tier. `gold > 0` means coins, otherwise it's an inventory
// item identified by `name`.
var LOOT_PRIZES = {
  common: [
    { name: "Handful of coins",      gold: 100 },
    { name: "Small copper purse",    gold: 150 },
    { name: "🍫 Small snack (item)", gold: 0 },
  ],
  uncommon: [
    { name: "Silver chest",              gold: 350 },
    { name: "🍿 Tasty treat (item)",     gold: 0 },
    { name: "🎟 Movie-night ticket (item)", gold: 0 },
  ],
  rare: [
    { name: "📜 Daily indulgence (item)", gold: 0 },
    { name: "🥩 Gourmet elixir (item)",   gold: 0 },
    { name: "🪓 Barbarian fury (item)",   gold: 0 },
    { name: "💰 Heavy bag of gold",       gold: 800 },
  ],
  epic: [
    { name: "👑 Royal treasury",          gold: 2000 },
    { name: "⏳ Lord of time (item)",     gold: 0 },
  ],
  legendary: [
    { name: "🦄 Gift of the gods",        gold: 5000 },
  ],
};

function rollRarity() {
  var r = Math.random();
  var acc = 0;
  for (var i = 0; i < LOOT_TIERS.length; i++) {
    acc += LOOT_TIERS[i].chance;
    if (r < acc) return LOOT_TIERS[i].name;
  }
  return LOOT_TIERS[LOOT_TIERS.length - 1].name;
}

function rollPrize(tier) {
  var pool = LOOT_PRIZES[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function openLootbox(chatId, messageId, callback) {
  var stats = getRealTimeStats(chatId);
  var props = PropertiesService.getScriptProperties();
  var lastLooted = parseInt(props.getProperty("looted_lvl_" + chatId)) || 1;

  if (lastLooted >= stats.lvl) {
    callTelegram("answerCallbackQuery", {
      callback_query_id: String(callback.id),
      text: L.loot_no_box,
      show_alert: true,
    });
    return;
  }

  var targetLvl    = lastLooted + 1;
  var levelUpGold  = targetLvl * 100;
  var tier         = rollRarity();
  var prize        = rollPrize(tier);
  var prizeName    = prize.name;
  var prizeGold    = prize.gold;
  var isItem       = prize.gold === 0;

  if (isItem) addInventoryItem(chatId, prizeName, 1);

  var totalGoldGained = levelUpGold + prizeGold;
  logQuestToHistory(chatId, "lootbox",
    "Level " + targetLvl + " + " + prizeName,
    0, totalGoldGained);

  props.setProperty("looted_lvl_" + chatId, String(targetLvl));

  var boxesLeft = stats.lvl - targetLvl;
  var msg =
    L.loot_title(targetLvl) + "\n━━━━━━━━━━━━━━━\n" +
    L.loot_guaranteed(levelUpGold) + "\n" +
    L.loot_random(prizeName) + "\n";
  if (prizeGold > 0) msg += L.loot_from_box(prizeGold) + "\n";
  else if (isItem)   msg += L.loot_item_to_inv + "\n";
  msg += "━━━━━━━━━━━━━━━\n" + L.loot_total(totalGoldGained) + "\n\n";

  var kb = { inline_keyboard: [] };
  if (boxesLeft > 0) {
    msg += L.loot_remaining(boxesLeft);
    kb.inline_keyboard.push([{ text: L.loot_btn_next(targetLvl + 1), callback_data: "open_lootbox" }]);
  } else {
    msg += L.loot_keep_going;
  }
  kb.inline_keyboard.push([{ text: L.btn_back_hub, callback_data: "hub_main" }]);

  renderMenu(chatId, messageId, msg, kb);
}
