// ============================================================================
// locales/en.gs — UI strings for the English deployment.
//
// Quest type identifiers in storage are ASCII enums: "daily", "weekly",
// "monthly", "raid", "epic", "personal". The labels below are display-only.
// ============================================================================

var L = {
  // --- system
  initialized: "🔄 <i>Systems initialized.</i>",
  sys_bottom_hub: "⬅️ Hub",
  sys_bottom_help: "ℹ️ Help",
  help_title: "🛠 <b>Reference:</b>",
  help_body:
    "💸 <b>Finance:</b> household budget.\n" +
    "📜 <b>Quests:</b> personal tasks.\n" +
    "🧠 <b>Diary:</b> mental state log.\n" +
    "🏋️ <b>Shape:</b> weight tracker.\n" +
    "🛒 <b>Shop:</b> reward catalogue.\n" +
    "🎒 <b>Inventory:</b> owned items.",
  btn_close: "🗑 Close",
  btn_cancel: "❌ Cancel",
  btn_back_hub: "⬅️ Hub",
  btn_back: "⬅️ Back",

  // --- hub
  hub_title: "🏰 <b>SYSTEM HUB</b>",
  hub_level: "LEVEL",
  hub_xp: "XP",
  hub_gold: "GOLD",
  hub_name_default: "Wanderer",
  hub_class_default: "Classless",
  hub_prompt: "Where to?",
  btn_expense: "💸 Expense",
  btn_exchange: "🔄 Exchange",
  btn_income: "💰 Income",
  btn_quests: "📜 Quests",
  btn_diary: "🧠 Diary",
  btn_stats: "📊 Stats",
  btn_inventory: "🎒 Inventory",
  btn_shop: "🛒 Shop",
  btn_shape: "🏋️ Shape",
  btn_profile: "🎭 Profile",
  btn_party: "👥 Party",
  btn_open_boxes: function (n) { return "🎁 OPEN LOOT BOXES (" + n + ")"; },

  // --- profile
  profile_edit_title: "🎭 <b>Character setup</b>\n\nType your hero's name:",
  profile_pick_class: "Pick a class:",
  profile_class_set: function (c) { return "Class selected: " + c; },
  classes: [
    "Fighter", "Paladin", "Ranger", "Rogue", "Bard", "Monk",
    "Wizard", "Sorcerer", "Warlock", "Cleric", "Druid", "Barbarian",
  ],
  class_icons: [
    "🛡", "⚔️", "🏹", "🗡", "🪕", "👊",
    "🧙‍♂️", "🔮", "👁", "⚕️", "🐻", "🪓",
  ],

  // --- shape
  shape_title: "🏋️ <b>Your physical shape</b>",
  shape_last: "Last measurement",
  shape_date: "Measured on",
  shape_none: "unknown",
  shape_none_date: "-",
  shape_button: "⚖️ Weigh in",
  shape_prompt: "⚖️ Type your current weight in kg (e.g. 82.5):",
  shape_saved: function (w) { return "⚖️ Weight <b>" + w + " kg</b> saved!"; },
  shape_back: "⬅️ Back to Shape",

  // --- party
  party_title: "👥 <b>PARTY (partner profile)</b>",
  party_empty: "No one in party!",
  party_no_profile: "Partner has not created a profile yet!",

  // --- finance
  fin_pick_currency: "Pick currency:",
  fin_enter_amount: "Type amount and comment:",
  fin_err_number: "❌ Not a number. Type amount and a comment:",
  fin_pick_categories: "Pick one or more categories:",
  fin_btn_confirm_pick: "📥 Confirm selection",
  fin_btn_add_cat: "➕ Add",
  fin_btn_cart_add: "✅ Add to cart",
  fin_btn_cart_more: "➕ One more",
  fin_btn_cart_save: "💾 Save to ledger",
  fin_cart_count: function (n) { return "📥 In cart: <b>" + n + " items</b>"; },
  fin_saved: "💾 <b>Saved to ledger!</b>",
  fin_new_cat_prompt: "Type the new category name:",

  // --- exchange
  exc_step1: "🔄 <b>STEP 1:</b> Which currency do you <b>GIVE</b>?",
  exc_step2: "🔄 <b>STEP 2:</b> Which currency do you <b>RECEIVE</b>?",
  exc_step3:
    "🔄 <b>STEP 3: FEE</b>\nType the fee <b>AMOUNT</b> (number).\n" +
    "Or tap below if there is none:",
  exc_step4_prefix: "🔄 <b>STEP 4: FEE CURRENCY</b>\nPick the currency the fee is charged in (",
  exc_amt1_prompt: function (cur) { return "🔄 Giving: <b>" + cur + "</b>\nType the amount you give (number):"; },
  exc_amt2_prompt: function (cur) { return "🔄 Receiving: <b>" + cur + "</b>\nType the net amount you receive (number):"; },
  exc_no_fee: "✅ No fee (or baked into rate)",
  exc_err_number: "❌ Type a number:",
  exc_err_number_fee: "❌ Type a number (e.g. 150):",
  exc_done_title: "💱 <b>EXCHANGE DONE</b>",
  exc_done_given: function (a, c) { return "➖ Given: <b>" + a + " " + c + "</b>"; },
  exc_done_received: function (a, c) { return "➕ Received: <b>" + a + " " + c + "</b>"; },
  exc_done_fee: function (a, c) { return "🩸 Fee: <b>" + a + " " + c + "</b>"; },
  exc_done_no_fee: "✅ <i>No extra fee</i>",

  // --- quests
  quest_folders_title: "🗂 Pick a folder:",
  quest_dayoff_active: "🏖 Day off ACTIVE",
  quest_dayoff_take: function (left) { return "🏖 Take day off (" + left + "/2)"; },
  quest_dayoff_used_today: "Day off already taken today. Rest 🧘",
  quest_dayoff_no_left: "Day-off limit for this week is used up!",
  quest_dayoff_ok: "🏖 Day off activated. No penalties today.",
  quest_type_labels: {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    raid: "Raid",
    epic: "Epic",
    personal: "Personal",
  },
  quest_type_icons: {
    daily: "🔹", weekly: "🔶", monthly: "📆", raid: "🔥", epic: "👑", personal: "🎯",
  },
  quest_list_title: function (type, n) { return "📂 <b>" + type + "</b> (active: " + n + ")\n<i>Tap to select:</i>"; },
  quest_btn_submit: function (n) { return "📥 Submit selected (" + n + ")"; },
  quest_btn_close_all_dailies: "✅ Close all dailies",
  quest_btn_add: function (type) { return "➕ Add " + type; },
  quest_add_prompt: function (type) { return "✍️ Title (" + type + "):"; },
  quest_added: function (title, xp, gold) {
    return "✅ Quest <b>" + title + "</b> added!\nReward: " + xp + " XP, " + gold + " 🪙";
  },
  quest_submit_title: function (type) { return "📥 <b>Submit (" + type + ")</b>"; },
  quest_submit_confirm: "Confirm?",
  quest_submit_total: function (xp, gold) { return "Total: <b>+" + xp + " XP | +" + gold + " 🪙</b>"; },
  quest_submit_done_title: "🎉 <b>QUESTS SUBMITTED</b>",
  quest_submit_done_gain: function (xp, gold) { return "Received: <b>+" + xp + " XP | +" + gold + " 🪙</b>\n\nKeep going!"; },
  quest_close_all_prompt:
    "📥 <b>Batch close (Dailies)</b>\n━━━━━━━━━━━━━━━\n" +
    "Close <b>all</b> active dailies?\n\n<i>Streak bonus is applied.</i>",
  quest_close_all_done:
    "🎉 <b>ALL DAILIES CLOSED</b>\n━━━━━━━━━━━━━━━\nXP, gold and streak bonus credited.\nWell done!",
  quest_btn_submit_done_more: function (type) { return "📂 Back to " + type; },
  quest_btn_submit_hub: "🏰 Hub",

  // --- level up
  levelup_title: function (lvl) { return "🎊 <b>LEVEL UP! LEVEL " + lvl + "!</b> 🎊"; },
  levelup_unlocked: "🎁 New reward box is available!",
  levelup_btn_open: function (lvl) { return "🎁 OPEN BOX FOR LVL " + lvl; },

  // --- loot box
  loot_no_box: "No boxes yet. Farm XP!",
  loot_title: function (lvl) { return "🎉 <b>YOU OPENED THE BOX FOR LVL " + lvl + "!</b>"; },
  loot_guaranteed: function (g) { return "📈 <b>Level reward:</b> +" + g + " 🪙"; },
  loot_random: function (name) { return "🎁 <b>Random loot:</b> <i>" + name + "</i>"; },
  loot_from_box: function (g) { return "🪙 <b>Gold from the box:</b> +" + g + " 🪙"; },
  loot_item_to_inv: "🎒 <b>Item added to Inventory!</b>",
  loot_total: function (g) { return "Total gold gained: <b>+" + g + " 🪙</b>"; },
  loot_remaining: function (n) { return "📦 <b>Unopened boxes: " + n + "</b>"; },
  loot_btn_next: function (lvl) { return "🎁 OPEN NEXT (LVL " + lvl + ")"; },
  loot_keep_going: "<i>Keep it up!</i>",

  // --- inventory
  inv_title_empty: "🎒 <b>Your inventory is empty.</b>",
  inv_title_full: "🎒 <b>Your stash:</b>\nTap an item to activate.",
  inv_use_confirm: function (name) { return "❓ Use item: <b>" + name + "</b>?"; },
  inv_use_btn: "✅ Use",
  inv_used: function (name) { return "✨ <b>Activated:</b> " + name; },
  inv_err_missing: "Error: not in inventory!",
  inv_back: "⬅️ Back to inventory",
  inv_indulgence_prompt: "📜 <b>Indulgence!</b> Pick a quest:",
  inv_indulgence_none: "⚠️ <b>No active quests!</b>\nItem returned.",
  inv_indulgence_refund_btn: "❌ Back (return item)",
  inv_indulgence_skipped: function (title) { return "✅ Quest <b>" + title + "</b> skipped!"; },

  // --- shop
  shop_title: "🛍 <b>RPG MARKETPLACE</b>",
  shop_balance: function (g) { return "💳 Your balance: <b>" + g + " 🪙</b>"; },
  shop_cart_summary: function (n, sum) {
    return "🛒 In cart: <b>" + n + " items</b> for <b>" + sum + " 🪙</b>\n";
  },
  shop_tap_to_add: "<i>Tap to add:</i>",
  shop_btn_pay: function (sum) { return "💳 PAY (" + sum + " 🪙)"; },
  shop_btn_clear: "🗑 Clear cart",
  shop_insufficient: function (sum) { return "⚠️ Not enough gold. Need " + sum; },
  shop_success_title: "🛍 <b>Purchase successful!</b>",
  shop_success_spent: function (sum) { return "Spent: <b>" + sum + " 🪙</b>"; },
  shop_success_inv: "All added to <b>🎒 Inventory</b>.",
  shop_back_to_catalog: "⬅️ Back to catalog",

  // --- diary
  diary_title: "🧠 <b>Diary entry</b>",
  diary_mood: "🧠 <b>Mood (1-10):</b>",
  diary_energy: "⚡️ <b>Energy (1-10):</b>",
  diary_anxiety: "🌪 <b>Anxiety (1-10):</b>",
  diary_labels: { m: "🧠 Mood", e: "⚡️ Energy", a: "🌪 Anxiety" },
  diary_confirm_stats: "📊 All correct?",
  diary_btn_approve: "✅ Confirm",
  diary_prompt_text: "📝 Write a note or skip.",
  diary_btn_skip: "⏩ Skip note",
  diary_preview: function (text) {
    return "📖 <b>Diary note:</b>\n<i>" + text + "</i>\n\nConfirm?";
  },
  diary_btn_save: "✅ Save entry",
  diary_saved: "🔥 <b>Diary saved!</b> ✨ +10 XP | 🪙 +5 gold",

  // --- analytics
  stats_title: "📊 <b>Analytics</b>",
  stats_categories: {
    expense: "💸 Expenses",
    income: "💰 Income",
    gold: "🪙 Gold",
    quests: "⚔️ Quests",
    mood: "🧠 Mood",
    weight: "⚖️ Weight",
    general: "📊 Overview",
  },
  stats_period_prompt: function (label) { return "📂 Category: " + label + "\nPick period:"; },
  stats_periods: {
    day: "📅 Day",
    week: "🗓 Week",
    month: "🌙 Month",
    year: "🌍 Year",
    custom: "⚙️ Custom",
  },
  stats_custom_prompt: "Type dates: <b>DDMMYY DDMMYY</b>",
  stats_err_dates: "❌ Bad format. Type: DDMMYY DDMMYY",

  // --- currencies
  currencies: ["USD", "EUR", "RUB", "CNY"],
  currency_icons: { USD: "💵", EUR: "💶", RUB: "🇷🇺", CNY: "🇨🇳" },

  // --- default shop catalogue
  shop_defaults: [
    ["🍫 Small snack", 50],
    ["🎮 1h of gaming", 100],
    ["⏳ Scrolling session", 80],
    ["🛌 Lazy morning", 150],
    ["🍔 Fast food", 250],
    ["🎮 Gaming evening", 400],
    ["🥩 Fancy dinner", 600],
    ["🎮 Indie game", 800],
    ["🦥 Couch day", 1000],
  ],

  // --- default starter quests (generic)
  quest_defaults: [
    ["daily",   "Morning stretch 10 min",         10, 5,  false, "", ""],
    ["daily",   "Drink 2L of water",              10, 5,  false, "", ""],
    ["daily",   "Evening walk 30 min",            10, 5,  false, "", ""],
    ["weekly",  "Deep-work session 4h",           50, 20, false, "", ""],
    ["weekly",  "Clean home / laundry",           50, 20, false, "", ""],
    ["weekly",  "Workout: gym session",           50, 30, false, "", ""],
    ["monthly", "Pay rent and utilities",        150, 50, false, "", ""],
    ["monthly", "Budget review",                 150, 50, false, "", ""],
    ["raid",    "Finish an online course module", 200, 100, false, "", ""],
    ["epic",    "Ship portfolio project",        1000, 500, false, "", ""],
  ],

  // --- category defaults
  cat_expense_defaults: [
    ["🛒 Groceries"], ["🍕 Café / Food"], ["🚕 Transport"], ["🏠 Housing"], ["❓ Misc"],
  ],
  cat_income_defaults: [
    ["💼 Salary"], ["👨‍💻 Freelance"], ["❓ Misc"],
  ],

  // --- reminders / newspaper
  rem_title: "🔔 <b>TASK DIGEST:</b>",
  rem_deadlines: "🔥 <b>DEADLINES:</b>",
  rem_dailies: "📅 <b>Today (dailies):</b>",
  rem_weeklies: "🗓 <b>This week (weeklies):</b>",
  rem_monthlies: "📆 <b>Monthly routine:</b>",
  rem_diary_missing: "🧠 <b>Diary:</b>\n🔸 Not filled today yet!",
  rem_footer: "💰 <i>Log today's income and expenses.</i>\n<i>Time to act, hero! ⚔️</i>",
  rem_deadline_today: function (t) { return "🚨 TODAY: " + t; },
  rem_deadline_tomorrow: function (t) { return "⏳ TOMORROW: " + t; },

  news_title: "📰 <b>WEEK IN REVIEW:</b>",
  news_dailies_done: function (n) { return "⚔️ Dailies completed: <b>" + n + "</b>"; },
  news_weeklies_done: function (n) { return "🏆 Weeklies completed: <b>" + n + "</b>"; },
  news_dayoffs: function (used) { return "🏖 Days off used: <b>" + used + " / 2</b>"; },
  news_bonuses: function (xp, g) { return "🎁 <b>All bonuses (streak + resilience):</b> +" + xp + " XP | +" + g + " 🪙"; },
  news_skipped: function (n) { return "❌ <b>Missed tasks:</b> " + n; },
  news_penalties: function (xp, g) { return "🩸 <b>Penalties for laziness:</b> " + xp + " XP | " + g + " 🪙"; },
  news_net: function (xp, g) {
    var sign = function (n) { return n > 0 ? "+" : ""; };
    return "📈 <b>Net gain this week:</b> " + sign(xp) + xp + " XP | " + sign(g) + g + " 🪙";
  },
  news_footer: "<i>New week! Day-off limit restored (2/2).</i>",

  // --- report blocks
  rep_period: function (from, to) { return "📅 <b>Period:</b> " + from + " - " + to; },
  rep_mental: "🧠 <b>MENTAL STATE:</b>",
  rep_mental_line: function (m, e, a) {
    return "Mood: " + m + " | Energy: " + e + " | Anxiety: " + a;
  },
  rep_no_diary: "<i>Diary not filled.</i>",
  rep_weight: "⚖️ <b>WEIGHT:</b>",
  rep_weight_no_data: "<i>No measurements.</i>",
  rep_fx: "💱 <b>FX EXCHANGE (period):</b>",
  rep_fx_out: function (a, c) { return "➖ Given: " + a + " " + c; },
  rep_fx_in: function (a, c) { return "➕ Received: " + a + " " + c; },
  rep_savings: "🏦 <b>SAVINGS (delta):</b>",
  rep_savings_empty: "<i>No change.</i>",
  rep_expense: "💸 <b>EXPENSES:</b>",
  rep_expense_empty: "<i>No expenses.</i>",
  rep_income: "💰 <b>INCOME:</b>",
  rep_income_empty: "<i>No income.</i>",
  rep_quests: "⚔️ <b>COMPLETED TASKS:</b>",
  rep_quests_empty: "<i>Nothing completed.</i>",
  rep_quest_line: function (type, n) { return "🔸 " + type + ": " + n; },
  rep_quest_skipped: function (n) { return "⏭ Skipped: " + n; },
  rep_balance: "⚖️ <b>FINANCIAL BALANCE:</b>",
  rep_balance_zero: "<i>Net zero.</i>",
  rep_economy: "🏆 <b>ECONOMY:</b>",
  rep_economy_level: function (l) { return "👤 Current level: <b>" + l + "</b>"; },
  rep_economy_progress: function (cur, goal) {
    return "✨ Level progress: " + cur + " / " + goal + " XP";
  },
  rep_economy_earned: function (xp, g) { return "📈 Earned this period: " + xp + " XP | " + g + " 🪙"; },
  rep_economy_spent: function (g) { return "🛍 Spent this period: " + g + " 🪙"; },

  // --- savings detection keywords (LOWER-CASE substring match on category)
  savings_keywords: ["savings", "deposit"],
  fx_keyword: "fx exchange",
  fx_category_label: "🔄 FX exchange",
  fx_fee_label: "📉 FX fee",
  savings_category_label: "💰 Savings",
};
