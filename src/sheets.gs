// ============================================================================
// sheets.gs — schema initialisation + auto-dashboard
//
// Lazy-creates every sheet on first touch. Shared sheets (ledger, categories,
// shop catalogue) are created once; per-user sheets carry a `_{chatId}`
// suffix to enforce row-level isolation.
// ============================================================================

function initUserSheets(chatId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(SH_EXPENSE)) {
    ss.insertSheet(SH_EXPENSE).appendRow([
      "date", "time", "currency", "amount", "category", "comment",
    ]);
    ss.insertSheet(SH_INCOME).appendRow([
      "date", "time", "currency", "amount", "category", "comment",
    ]);
    setupSettingsSheet();
    setupShopSheet();
  }

  if (!ss.getSheetByName(getSh(SH_DIARY, chatId))) setupDiarySheet(chatId);
  if (!ss.getSheetByName(getSh(SH_WEIGHT, chatId))) setupWeightSheet(chatId);
  if (!ss.getSheetByName(getSh(SH_SHOP_HISTORY, chatId))) setupShopHistorySheet(chatId);
  if (!ss.getSheetByName(getSh(SH_HISTORY, chatId))) setupQuestHistorySheet(chatId);
  if (!ss.getSheetByName(getSh(SH_INVENTORY, chatId))) setupInventorySheet(chatId);
  if (!ss.getSheetByName(getSh(SH_QUEST, chatId))) setupQuestSheet(chatId);
  if (!ss.getSheetByName(getSh(SH_CHAR, chatId))) buildDashboard(chatId, ss);
}

function setupSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.insertSheet(SH_SETTINGS);
  sh.getRange("A1:B1").setValues([["Expense categories", "Income categories"]]);
  sh.getRange(2, 1, L.cat_expense_defaults.length, 1).setValues(L.cat_expense_defaults);
  sh.getRange(2, 2, L.cat_income_defaults.length, 1).setValues(L.cat_income_defaults);
  return sh;
}

function setupShopSheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SH_SHOP);
  sh.getRange("A1:B1").setValues([["Reward name", "Price (gold)"]]);
  sh.getRange(2, 1, L.shop_defaults.length, 2).setValues(L.shop_defaults);
}

function setupInventorySheet(chatId) {
  SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(getSh(SH_INVENTORY, chatId))
    .getRange("A1:D1")
    .setValues([["item", "qty", "total_received", "total_used"]]);
}

function setupQuestSheet(chatId) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(getSh(SH_QUEST, chatId));
  sh.getRange("A1:G1")
    .setValues([["type", "title", "xp", "gold", "is_done", "deadline", "notes"]])
    .setFontWeight("bold")
    .setBackground("#4c1130")
    .setFontColor("white");
  sh.getRange(2, 1, L.quest_defaults.length, 7).setValues(L.quest_defaults);
  sh.getRange(2, 5, L.quest_defaults.length, 1).insertCheckboxes();
  sh.autoResizeColumns(1, 7);
}

function setupWeightSheet(chatId) {
  SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(getSh(SH_WEIGHT, chatId))
    .getRange("A1:C1")
    .setValues([["date", "time", "weight_kg"]]);
}

function setupDiarySheet(chatId) {
  SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(getSh(SH_DIARY, chatId))
    .getRange("A1:H1")
    .setValues([["date", "time", "mood_1_10", "energy_1_10", "anxiety_1_10", "text", "xp", "gold"]]);
}

function setupShopHistorySheet(chatId) {
  SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(getSh(SH_SHOP_HISTORY, chatId))
    .getRange("A1:C1")
    .setValues([["date", "item", "gold_delta"]]);
}

function setupQuestHistorySheet(chatId) {
  SpreadsheetApp.getActiveSpreadsheet()
    .insertSheet(getSh(SH_HISTORY, chatId))
    .getRange("A1:F1")
    .setValues([["date", "time", "type", "title", "xp_delta", "gold_delta"]]);
}

// Tolerant date parser: accepts Date, "dd.MM.yyyy", empty/"false" fallback.
function parseSheetDate(str) {
  if (!str || String(str).toLowerCase() === "false") return new Date(0);
  if (str instanceof Date) return str;
  var m = String(str).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(m[3], m[2] - 1, m[1]);
  return new Date(str);
}

// ---------------------------------------------------------------------------
// buildDashboard — auto-generates a `character_{chatId}` tab with formulas
// that read live from the diary / quest / shop history sheets. Gives the
// user a native Sheets-side view of their progression without any code.
// ---------------------------------------------------------------------------
function buildDashboard(chatId, ss) {
  var sheetName = getSh(SH_CHAR, chatId);
  var oldSheet = ss.getSheetByName(sheetName);

  var cName = L.hub_name_default, cClass = L.hub_class_default;
  if (oldSheet && oldSheet.getLastRow() >= 3) {
    cName = oldSheet.getRange("B2").getValue() || L.hub_name_default;
    cClass = oldSheet.getRange("B3").getValue() || L.hub_class_default;
  }
  if (oldSheet) ss.deleteSheet(oldSheet);

  var sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setBackground("#222222").setFontColor("white")
    .setFontFamily("Verdana").setFontSize(10);
  sheet.setHiddenGridlines(true);

  sheet.getRange("A1:C1").merge().setValue("🏆 CHARACTER")
    .setFontSize(14).setFontWeight("bold").setBackground("#4c1130")
    .setHorizontalAlignment("center");
  sheet.getRange("A2").setValue("Name:").setFontWeight("bold");
  sheet.getRange("B2").setValue(cName);
  sheet.getRange("A3").setValue("Class:").setFontWeight("bold");
  sheet.getRange("B3").setValue(cClass);

  var diaryName   = "'" + getSh(SH_DIARY, chatId) + "'";
  var historyName = "'" + getSh(SH_HISTORY, chatId) + "'";
  var shopHist    = "'" + getSh(SH_SHOP_HISTORY, chatId) + "'";

  sheet.getRange("A5").setValue("LEVEL").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("B5").setValue("XP").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C5").setValue("GOLD").setFontWeight("bold").setHorizontalAlignment("center");

  sheet.getRange("B6")
    .setValue("=SUM(" + diaryName + "!G:G) + SUM(" + historyName + "!E:E)")
    .setFontSize(24).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C6")
    .setValue("=SUM(" + diaryName + "!H:H) + SUM(" + historyName + "!F:F) + SUM(" + shopHist + "!C:C)")
    .setFontSize(24).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("A6")
    .setValue("=INT(B6 / 1000) + 1")
    .setFontSize(24).setFontWeight("bold").setHorizontalAlignment("center");

  var barFormula = '=REPT("🟦"; INT(MOD(B6; 1000)/100)) & REPT("⬜"; 10 - INT(MOD(B6; 1000)/100)) & " " & ROUND(MOD(B6; 1000)/10; 1) & "%"';
  sheet.getRange("B7").setValue(barFormula).setHorizontalAlignment("center");

  sheet.getRange("E1:H1").merge().setValue("🏦 BUDGET").setFontSize(12)
    .setFontWeight("bold").setBackground("#4c1130").setHorizontalAlignment("center");
  sheet.getRange("E2:H2")
    .setValues([["Currency", "Income", "Expense", "Balance"]])
    .setFontWeight("bold");

  var skipExc = '"<>*' + L.fx_category_label + '*"';
  var skipSav = '"<>*' + L.savings_category_label + '*"';

  for (var i = 0; i < L.currencies.length; i++) {
    var row = 3 + i;
    var cur = L.currencies[i];
    sheet.getRange("E" + row).setValue(cur);
    sheet.getRange("F" + row).setValue(
      "=SUMIFS('" + SH_INCOME + "'!D:D; '" + SH_INCOME + "'!C:C; \"" + cur +
      "\"; '" + SH_INCOME + "'!E:E; " + skipExc + "; '" + SH_INCOME + "'!E:E; " + skipSav + ")"
    );
    sheet.getRange("G" + row).setValue(
      "=SUMIFS('" + SH_EXPENSE + "'!D:D; '" + SH_EXPENSE + "'!C:C; \"" + cur +
      "\"; '" + SH_EXPENSE + "'!E:E; " + skipExc + "; '" + SH_EXPENSE + "'!E:E; " + skipSav + ")"
    );
    sheet.getRange("H" + row).setValue("=F" + row + " - G" + row);
  }

  sheet.getRange("J1:K1").merge().setValue("📈 PLAYER STATS").setFontSize(14)
    .setFontWeight("bold").setBackground("#4c1130").setHorizontalAlignment("center");
  sheet.getRange("J2:J6").setValues([
    ["Quests completed:"], ["Rewards bought:"], ["Gold spent:"],
    ["Diary days:"], ["Avg mood:"],
  ]).setFontWeight("bold");
  sheet.getRange("K2").setValue("=COUNTA(" + historyName + "!A:A) - 1");
  sheet.getRange("K3").setValue("=COUNTA(" + shopHist + "!A:A) - 1");
  sheet.getRange("K4").setValue("=SUM(" + shopHist + "!C:C)");
  sheet.getRange("K5").setValue("=COUNTA(" + diaryName + "!A:A) - 1");
  sheet.getRange("K6").setValue("=IFERROR(AVERAGE(" + diaryName + "!C:C); 0)");

  sheet.autoResizeColumns(1, 11);
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(4, 30);
  sheet.setColumnWidth(9, 30);
}
