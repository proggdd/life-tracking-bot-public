// ============================================================================
// locales/ru.gs — Russian UI strings (same key surface as locales/en.gs).
//
// Apps Script loads every file in alphabetical order and the last definition
// of `L` wins. `ru.gs` sorts after `en.gs`, so the Russian build is active
// by default. To deploy the English build instead, delete this file from
// the project (or rename it so it loads before `en.gs`). Both files expose
// the same schema so swapping them requires no code changes elsewhere.
//
// Quest type identifiers in storage remain the ASCII enums ("daily",
// "weekly", "monthly", "raid", "epic", "personal") — the Russian labels
// below are display-only.
// ============================================================================

var L = {
  // --- system
  initialized: "🔄 <i>Системы активированы.</i>",
  sys_bottom_hub: "⬅️ Хаб",
  sys_bottom_help: "ℹ️ Помощь",
  help_title: "🛠 <b>Справка:</b>",
  help_body:
    "💸 <b>Финансы:</b> семейный бюджет.\n" +
    "📜 <b>Квесты:</b> личные задачи.\n" +
    "🧠 <b>Дневник:</b> лог состояния.\n" +
    "🏋️ <b>Форма:</b> учёт веса.\n" +
    "🛒 <b>Магазин:</b> каталог наград.\n" +
    "🎒 <b>Инвентарь:</b> купленное.",
  btn_close: "🗑 Закрыть",
  btn_cancel: "❌ Отмена",
  btn_back_hub: "⬅️ В Хаб",
  btn_back: "⬅️ Назад",

  // --- hub
  hub_title: "🏰 <b>ГЛАВНЫЙ ХАБ</b>",
  hub_level: "УРОВЕНЬ",
  hub_xp: "Опыт",
  hub_gold: "Золото",
  hub_name_default: "Странник",
  hub_class_default: "Без класса",
  hub_prompt: "Куда идём?",
  btn_expense: "💸 Расход",
  btn_exchange: "🔄 Обмен",
  btn_income: "💰 Доход",
  btn_quests: "📜 Квесты",
  btn_diary: "🧠 Дневник",
  btn_stats: "📊 Статы",
  btn_inventory: "🎒 Инвентарь",
  btn_shop: "🛒 Магазин",
  btn_shape: "🏋️ Форма",
  btn_profile: "🎭 Профиль",
  btn_party: "👥 Пати",
  btn_open_boxes: function (n) { return "🎁 ОТКРЫТЬ КОРОБКИ (" + n + ")"; },

  // --- profile
  profile_edit_title: "🎭 <b>Настройка персонажа</b>\n\nВведи имя героя:",
  profile_pick_class: "Выбери класс:",
  profile_class_set: function (c) { return "Класс выбран: " + c; },
  classes: [
    "Воин", "Паладин", "Следопыт", "Плут", "Бард", "Монах",
    "Волшебник", "Чародей", "Колдун", "Жрец", "Друид", "Варвар",
  ],
  class_icons: [
    "🛡", "⚔️", "🏹", "🗡", "🪕", "👊",
    "🧙‍♂️", "🔮", "👁", "⚕️", "🐻", "🪓",
  ],

  // --- shape
  shape_title: "🏋️ <b>Твоя физическая форма</b>",
  shape_last: "Последний замер",
  shape_date: "Дата замера",
  shape_none: "нет данных",
  shape_none_date: "-",
  shape_button: "⚖️ Взвеситься",
  shape_prompt: "⚖️ Введи текущий вес в кг (например 82.5):",
  shape_saved: function (w) { return "⚖️ Вес <b>" + w + " кг</b> сохранён!"; },
  shape_back: "⬅️ Назад к Форме",

  // --- party
  party_title: "👥 <b>ПАТИ (профиль партнёра)</b>",
  party_empty: "В пати никого!",
  party_no_profile: "Партнёр ещё не создал профиль!",

  // --- finance
  fin_pick_currency: "Выбери валюту:",
  fin_enter_amount: "Введи сумму и комментарий:",
  fin_err_number: "❌ Это не число. Введи сумму и комментарий:",
  fin_pick_categories: "Выбери одну или несколько категорий:",
  fin_btn_confirm_pick: "📥 Подтвердить выбор",
  fin_btn_add_cat: "➕ Добавить",
  fin_btn_cart_add: "✅ В корзину",
  fin_btn_cart_more: "➕ Ещё одна",
  fin_btn_cart_save: "💾 Сохранить в журнал",
  fin_cart_count: function (n) { return "📥 В корзине: <b>" + n + " записей</b>"; },
  fin_saved: "💾 <b>Сохранено в журнал!</b>",
  fin_new_cat_prompt: "Введи название новой категории:",

  // --- exchange
  exc_step1: "🔄 <b>ШАГ 1:</b> Какую валюту <b>ОТДАЁМ</b>?",
  exc_step2: "🔄 <b>ШАГ 2:</b> Какую валюту <b>ПОЛУЧАЕМ</b>?",
  exc_step3:
    "🔄 <b>ШАГ 3: КОМИССИЯ</b>\nВведи <b>СУММУ</b> комиссии (число).\n" +
    "Или нажми ниже, если комиссии нет:",
  exc_step4_prefix: "🔄 <b>ШАГ 4: ВАЛЮТА КОМИССИИ</b>\nВыбери валюту комиссии (",
  exc_amt1_prompt: function (cur) { return "🔄 Отдаём: <b>" + cur + "</b>\nВведи сумму, которую отдаём:"; },
  exc_amt2_prompt: function (cur) { return "🔄 Получаем: <b>" + cur + "</b>\nВведи сумму, которую получаем:"; },
  exc_no_fee: "✅ Без комиссии (или уже в курсе)",
  exc_err_number: "❌ Введи число:",
  exc_err_number_fee: "❌ Введи число (например 150):",
  exc_done_title: "💱 <b>ОБМЕН ЗАВЕРШЁН</b>",
  exc_done_given: function (a, c) { return "➖ Отдано: <b>" + a + " " + c + "</b>"; },
  exc_done_received: function (a, c) { return "➕ Получено: <b>" + a + " " + c + "</b>"; },
  exc_done_fee: function (a, c) { return "🩸 Комиссия: <b>" + a + " " + c + "</b>"; },
  exc_done_no_fee: "✅ <i>Без доп. комиссии</i>",

  // --- quests
  quest_folders_title: "🗂 Выбери папку:",
  quest_dayoff_active: "🏖 Выходной активен",
  quest_dayoff_take: function (left) { return "🏖 Взять выходной (" + left + "/2)"; },
  quest_dayoff_used_today: "Выходной уже взят сегодня. Отдыхай 🧘",
  quest_dayoff_no_left: "Лимит выходных на эту неделю исчерпан!",
  quest_dayoff_ok: "🏖 Выходной активирован. Сегодня без штрафов.",
  quest_type_labels: {
    daily: "Дейлик",
    weekly: "Виклик",
    monthly: "Ежемесячный",
    raid: "Рейд",
    epic: "Эпик",
    personal: "Личный",
  },
  quest_type_icons: {
    daily: "🔹", weekly: "🔶", monthly: "📆", raid: "🔥", epic: "👑", personal: "🎯",
  },
  quest_list_title: function (type, n) {
    return "📂 <b>" + type + "</b> (активных: " + n + ")\n<i>Нажми, чтобы отметить:</i>";
  },
  quest_btn_submit: function (n) { return "📥 Сдать выбранное (" + n + ")"; },
  quest_btn_close_all_dailies: "✅ Закрыть все дейлики",
  quest_btn_add: function (type) { return "➕ Добавить " + type; },
  quest_add_prompt: function (type) { return "✍️ Название (" + type + "):"; },
  quest_added: function (title, xp, gold) {
    return "✅ Квест <b>" + title + "</b> добавлен!\nНаграда: " + xp + " XP, " + gold + " 🪙";
  },
  quest_submit_title: function (type) { return "📥 <b>Сдача (" + type + ")</b>"; },
  quest_submit_confirm: "Подтверждаем?",
  quest_submit_total: function (xp, gold) { return "Итого: <b>+" + xp + " XP | +" + gold + " 🪙</b>"; },
  quest_submit_done_title: "🎉 <b>КВЕСТЫ СДАНЫ</b>",
  quest_submit_done_gain: function (xp, gold) {
    return "Получено: <b>+" + xp + " XP | +" + gold + " 🪙</b>\n\nПродолжай в том же духе!";
  },
  quest_close_all_prompt:
    "📥 <b>Массовая сдача (Дейлики)</b>\n━━━━━━━━━━━━━━━\n" +
    "Закрыть <b>все</b> активные дейлики?\n\n<i>Бонус за стрик будет начислен.</i>",
  quest_close_all_done:
    "🎉 <b>ВСЕ ДЕЙЛИКИ ЗАКРЫТЫ</b>\n━━━━━━━━━━━━━━━\nXP, золото и стрик-бонус начислены.\nТак держать!",
  quest_btn_submit_done_more: function (type) { return "📂 Назад к " + type; },
  quest_btn_submit_hub: "🏰 В Хаб",

  // --- level up
  levelup_title: function (lvl) { return "🎊 <b>ЛЕВЕЛ-АП! УРОВЕНЬ " + lvl + "!</b> 🎊"; },
  levelup_unlocked: "🎁 Открыта новая коробка с наградой!",
  levelup_btn_open: function (lvl) { return "🎁 ОТКРЫТЬ КОРОБКУ LVL " + lvl; },

  // --- loot box
  loot_no_box: "Коробок пока нет. Фарми XP!",
  loot_title: function (lvl) { return "🎉 <b>ТЫ ОТКРЫЛ КОРОБКУ LVL " + lvl + "!</b>"; },
  loot_guaranteed: function (g) { return "📈 <b>Награда за уровень:</b> +" + g + " 🪙"; },
  loot_random: function (name) { return "🎁 <b>Случайный лут:</b> <i>" + name + "</i>"; },
  loot_from_box: function (g) { return "🪙 <b>Золото из коробки:</b> +" + g + " 🪙"; },
  loot_item_to_inv: "🎒 <b>Предмет добавлен в инвентарь!</b>",
  loot_total: function (g) { return "Всего получено: <b>+" + g + " 🪙</b>"; },
  loot_remaining: function (n) { return "📦 <b>Коробок осталось: " + n + "</b>"; },
  loot_btn_next: function (lvl) { return "🎁 ОТКРЫТЬ СЛЕДУЮЩУЮ (LVL " + lvl + ")"; },
  loot_keep_going: "<i>Так держать!</i>",

  // --- inventory
  inv_title_empty: "🎒 <b>Инвентарь пуст.</b>",
  inv_title_full: "🎒 <b>Твоё снаряжение:</b>\nНажми на предмет для активации.",
  inv_use_confirm: function (name) { return "❓ Использовать: <b>" + name + "</b>?"; },
  inv_use_btn: "✅ Использовать",
  inv_used: function (name) { return "✨ <b>Активировано:</b> " + name; },
  inv_err_missing: "Ошибка: нет в инвентаре!",
  inv_back: "⬅️ В инвентарь",
  inv_indulgence_prompt: "📜 <b>Индульгенция!</b> Выбери квест:",
  inv_indulgence_none: "⚠️ <b>Нет активных квестов!</b>\nПредмет возвращён.",
  inv_indulgence_refund_btn: "❌ Назад (вернуть)",
  inv_indulgence_skipped: function (title) { return "✅ Квест <b>" + title + "</b> скипнут!"; },

  // --- shop
  shop_title: "🛍 <b>РПГ-МАРКЕТ</b>",
  shop_balance: function (g) { return "💳 Баланс: <b>" + g + " 🪙</b>"; },
  shop_cart_summary: function (n, sum) {
    return "🛒 В корзине: <b>" + n + " предметов</b> на <b>" + sum + " 🪙</b>\n";
  },
  shop_tap_to_add: "<i>Нажми, чтобы добавить:</i>",
  shop_btn_pay: function (sum) { return "💳 ОПЛАТИТЬ (" + sum + " 🪙)"; },
  shop_btn_clear: "🗑 Очистить корзину",
  shop_insufficient: function (sum) { return "⚠️ Не хватает золота. Нужно " + sum; },
  shop_success_title: "🛍 <b>Покупка оформлена!</b>",
  shop_success_spent: function (sum) { return "Списано: <b>" + sum + " 🪙</b>"; },
  shop_success_inv: "Всё отправилось в <b>🎒 Инвентарь</b>.",
  shop_back_to_catalog: "⬅️ В каталог",

  // --- diary
  diary_title: "🧠 <b>Запись в дневник</b>",
  diary_mood: "🧠 <b>Настроение (1-10):</b>",
  diary_energy: "⚡️ <b>Энергия (1-10):</b>",
  diary_anxiety: "🌪 <b>Тревога (1-10):</b>",
  diary_labels: { m: "🧠 Настроение", e: "⚡️ Энергия", a: "🌪 Тревога" },
  diary_confirm_stats: "📊 Всё верно?",
  diary_btn_approve: "✅ Подтвердить",
  diary_prompt_text: "📝 Напиши заметку или пропусти.",
  diary_btn_skip: "⏩ Пропустить заметку",
  diary_preview: function (text) {
    return "📖 <b>Запись дневника:</b>\n<i>" + text + "</i>\n\nПодтверждаем?";
  },
  diary_btn_save: "✅ Сохранить запись",
  diary_saved: "🔥 <b>Дневник сохранён!</b> ✨ +10 XP | 🪙 +5 золота",

  // --- analytics
  stats_title: "📊 <b>Аналитический центр</b>",
  stats_categories: {
    expense: "💸 Траты",
    income: "💰 Доходы",
    gold: "🪙 Золото",
    quests: "⚔️ Квесты",
    mood: "🧠 Настроение",
    weight: "⚖️ Вес",
    general: "📊 Общая сводка",
  },
  stats_period_prompt: function (label) { return "📂 Категория: " + label + "\nВыбери период:"; },
  stats_periods: {
    day: "📅 День",
    week: "🗓 Неделя",
    month: "🌙 Месяц",
    year: "🌍 Год",
    custom: "⚙️ Свой период",
  },
  stats_custom_prompt: "Введи диапазон: <b>ДДММГГ ДДММГГ</b>",
  stats_err_dates: "❌ Неверный формат. Введи: ДДММГГ ДДММГГ",

  // --- currencies
  currencies: ["USD", "EUR", "RUB", "CNY"],
  currency_icons: { USD: "💵", EUR: "💶", RUB: "🇷🇺", CNY: "🇨🇳" },

  // --- default shop catalogue
  shop_defaults: [
    ["🍫 Мелкий снэк", 50],
    ["🎮 Час игры", 100],
    ["⏳ Залипание (YT/мемы)", 80],
    ["🛌 Ленивое утро", 150],
    ["🍔 Фастфуд", 250],
    ["🎮 Плотный вечер ПК", 400],
    ["🥩 Шикарный ужин", 600],
    ["🎮 Инди-игра", 800],
    ["🦥 День тюленя", 1000],
  ],

  // --- default starter quests (generic)
  quest_defaults: [
    ["daily",   "Утренняя растяжка 10 мин",       10, 5,  false, "", ""],
    ["daily",   "Норма воды (2 литра)",            10, 5,  false, "", ""],
    ["daily",   "Вечерняя прогулка 30 мин",        10, 5,  false, "", ""],
    ["weekly",  "Deep-work сессия 4 часа",         50, 20, false, "", ""],
    ["weekly",  "Уборка / стирка",                 50, 20, false, "", ""],
    ["weekly",  "Тренировка в зале",               50, 30, false, "", ""],
    ["monthly", "Оплата аренды и счетов",         150, 50, false, "", ""],
    ["monthly", "Сверка бюджета",                 150, 50, false, "", ""],
    ["raid",    "Пройти модуль курса",            200, 100, false, "", ""],
    ["epic",    "Закрыть портфолио-проект",      1000, 500, false, "", ""],
  ],

  // --- category defaults
  cat_expense_defaults: [
    ["🛒 Продукты"], ["🍕 Кафе/Еда"], ["🚕 Транспорт"], ["🏠 Жильё"], ["❓ Разное"],
  ],
  cat_income_defaults: [
    ["💼 Зарплата"], ["👨‍💻 Фриланс"], ["❓ Разное"],
  ],

  // --- reminders / newspaper
  rem_title: "🔔 <b>СВОДКА ЗАДАЧ:</b>",
  rem_deadlines: "🔥 <b>ГОРЯТ ДЕДЛАЙНЫ:</b>",
  rem_dailies: "📅 <b>Сегодня (дейлики):</b>",
  rem_weeklies: "🗓 <b>На этой неделе (виклики):</b>",
  rem_monthlies: "📆 <b>Рутина месяца:</b>",
  rem_diary_missing: "🧠 <b>Дневник:</b>\n🔸 Сегодня ещё не заполнен!",
  rem_footer:
    "💰 <i>Не забудь внести сегодняшние доходы и траты.</i>\n" +
    "<i>Пора действовать, герой! ⚔️</i>",
  rem_deadline_today: function (t) { return "🚨 СЕГОДНЯ: " + t; },
  rem_deadline_tomorrow: function (t) { return "⏳ ЗАВТРА: " + t; },

  news_title: "📰 <b>ИТОГИ НЕДЕЛИ:</b>",
  news_dailies_done: function (n) { return "⚔️ Закрыто дейликов: <b>" + n + "</b>"; },
  news_weeklies_done: function (n) { return "🏆 Закрыто викликов: <b>" + n + "</b>"; },
  news_dayoffs: function (used) { return "🏖 Взято выходных: <b>" + used + " / 2</b>"; },
  news_bonuses: function (xp, g) {
    return "🎁 <b>Все бонусы (стрики + стойкость):</b> +" + xp + " XP | +" + g + " 🪙";
  },
  news_skipped: function (n) { return "❌ <b>Пропущено заданий:</b> " + n; },
  news_penalties: function (xp, g) { return "🩸 <b>Штрафы за лень:</b> " + xp + " XP | " + g + " 🪙"; },
  news_net: function (xp, g) {
    var sign = function (n) { return n > 0 ? "+" : ""; };
    return "📈 <b>Чистый прирост:</b> " + sign(xp) + xp + " XP | " + sign(g) + g + " 🪙";
  },
  news_footer: "<i>С новой неделей! Лимит выходных восстановлен (2/2).</i>",

  // --- report blocks
  rep_period: function (from, to) { return "📅 <b>Период:</b> " + from + " - " + to; },
  rep_mental: "🧠 <b>МЕНТАЛОЧКА:</b>",
  rep_mental_line: function (m, e, a) {
    return "Настроение: " + m + " | Энергия: " + e + " | Тревога: " + a;
  },
  rep_no_diary: "<i>Дневник не заполнялся.</i>",
  rep_weight: "⚖️ <b>ВЕС:</b>",
  rep_weight_no_data: "<i>Замеров не было.</i>",
  rep_fx: "💱 <b>ОБМЕН ВАЛЮТ (за период):</b>",
  rep_fx_out: function (a, c) { return "➖ Отдано: " + a + " " + c; },
  rep_fx_in: function (a, c) { return "➕ Получено: " + a + " " + c; },
  rep_savings: "🏦 <b>НАКОПЛЕНИЯ (дельта):</b>",
  rep_savings_empty: "<i>Без изменений.</i>",
  rep_expense: "💸 <b>РАСХОДЫ:</b>",
  rep_expense_empty: "<i>Трат не было.</i>",
  rep_income: "💰 <b>ДОХОДЫ:</b>",
  rep_income_empty: "<i>Пополнений не было.</i>",
  rep_quests: "⚔️ <b>ВЫПОЛНЕННЫЕ ЗАДАЧИ:</b>",
  rep_quests_empty: "<i>Ничего не выполнено.</i>",
  rep_quest_line: function (type, n) { return "🔸 " + type + ": " + n; },
  rep_quest_skipped: function (n) { return "⏭ Скипнуто: " + n; },
  rep_balance: "⚖️ <b>ФИНАНСОВЫЙ БАЛАНС:</b>",
  rep_balance_zero: "<i>По нулям.</i>",
  rep_economy: "🏆 <b>ЭКОНОМИКА:</b>",
  rep_economy_level: function (l) { return "👤 Текущий уровень: <b>" + l + "</b>"; },
  rep_economy_progress: function (cur, goal) {
    return "✨ Прогресс уровня: " + cur + " / " + goal + " XP";
  },
  rep_economy_earned: function (xp, g) {
    return "📈 Добыто за период: " + xp + " XP | " + g + " 🪙";
  },
  rep_economy_spent: function (g) { return "🛍 Потрачено за период: " + g + " 🪙"; },

  // --- savings detection keywords (LOWER-CASE substring match on category)
  savings_keywords: ["накопления", "вклад", "savings", "deposit"],
  fx_keyword: "обмен валют",
  fx_category_label: "🔄 Обмен валют",
  fx_fee_label: "📉 Комиссия за обмен",
  savings_category_label: "💰 Накопления",
};
