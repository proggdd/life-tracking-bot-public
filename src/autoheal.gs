// ============================================================================
// autoheal.gs — one-shot spreadsheet repair utilities
//
// These are intended to be invoked manually from the Apps Script editor
// (Run menu) when the spreadsheet drifts out of shape. Real-world ledgers
// degrade for many small reasons: checkboxes get pasted into the wrong
// column, dropdown validation rules go missing after a bulk edit, a date
// column starts storing booleans. Rather than making every runtime path
// defensive against every weird state, we keep the repair logic in one
// place and document the failure mode alongside the fix.
//
// None of the functions here are wired up to triggers; they are dev-only.
// ============================================================================

// Strips leftover checkbox validation from the deadline column of each
// user's quest sheet and replaces stale "FALSE" strings in that column with
// empty strings. Also re-establishes the header row formatting.
function FIX_QUEST_HEADERS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getAllowedUsers().forEach(function (chatId) {
    var sh = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sh) return;

    sh.getRange("F2:G").clearDataValidations();

    var lastRow = sh.getLastRow();
    if (lastRow > 1) {
      var fData = sh.getRange(2, 6, lastRow - 1, 1).getValues();
      for (var i = 0; i < fData.length; i++) {
        if (fData[i][0] === false || String(fData[i][0]).toUpperCase() === "FALSE") {
          fData[i][0] = "";
        }
      }
      sh.getRange(2, 6, lastRow - 1, 1).setValues(fData);
    }

    sh.getRange("A1:G1")
      .setValues([["Type", "Title", "XP", "Gold", "Status", "Deadline", "Notes"]])
      .setFontWeight("bold").setBackground("#4c1130").setFontColor("white");
  });
  SpreadsheetApp.getActiveSpreadsheet().toast("Quest headers repaired.");
}

// Coerces the Status column into real booleans (strings "TRUE"/"FALSE" are
// common after copy-paste) and restores the checkbox validation. Called
// "REFORMER" historically because it also back-fills monthly quest slots
// when a user's sheet is missing them entirely.
function GLOBAL_REFORMER() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getAllowedUsers().forEach(function (chatId) {
    var sh = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sh) return;

    var lastRow = sh.getLastRow();
    if (lastRow > 1) {
      var statusRange = sh.getRange(2, 5, lastRow - 1, 1);
      var statusValues = statusRange.getValues();
      for (var i = 0; i < statusValues.length; i++) {
        var val = String(statusValues[i][0]).toUpperCase().trim();
        if (val === "FALSE" || val === "") statusValues[i][0] = false;
        if (val === "TRUE") statusValues[i][0] = true;
      }
      statusRange.clearDataValidations();
      statusRange.setValues(statusValues);
      statusRange.insertCheckboxes();
    }

    var data = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    var hasMonthlies = false;
    for (var j = 0; j < data.length; j++) {
      if (data[j][0] === "monthly") { hasMonthlies = true; break; }
    }

    if (!hasMonthlies) {
      // Generic monthly quest set. Customise in your own fork if needed;
      // the shipped defaults are budget-and-home oriented.
      var fresh = [
        ["monthly", "Pay rent / utilities",      150, 50, false, "", ""],
        ["monthly", "Pay subscriptions",         100, 30, false, "", ""],
        ["monthly", "Monthly budget review",     150, 50, false, "", ""],
      ];
      sh.getRange(lastRow + 1, 1, fresh.length, 7).setValues(fresh);
      sh.getRange(lastRow + 1, 5, fresh.length, 1).insertCheckboxes();
    }
  });
  SpreadsheetApp.getActiveSpreadsheet().toast("Reformer done.");
}

// Historical issue: a Status checkbox occasionally ended up pasted into the
// Deadline column (F). This nukes any boolean-shaped value from F and, for
// any monthly without a deadline, fills in the last day of the current
// month so the reminder module treats it consistently.
function FIX_DEADLINES() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  getAllowedUsers().forEach(function (chatId) {
    var sh = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sh) return;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    var deadlineRange = sh.getRange(2, 6, lastRow - 1, 1);
    deadlineRange.clearDataValidations();
    deadlineRange.setNumberFormat("@");

    var fullData = sh.getRange(2, 1, lastRow - 1, 7).getValues();
    var changed = false;

    var today = new Date();
    var endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    var endOfMonthStr = Utilities.formatDate(endOfMonth, getTimezone(), "dd.MM.yyyy");

    for (var i = 0; i < fullData.length; i++) {
      var type = String(fullData[i][0]).trim();
      var currentVal = String(fullData[i][5]).toUpperCase().trim();

      if (currentVal === "FALSE" || currentVal === "TRUE") {
        fullData[i][5] = "";
        changed = true;
      }
      if (type === "monthly" && fullData[i][5] === "") {
        fullData[i][5] = endOfMonthStr;
        changed = true;
      }
    }

    if (changed) sh.getRange(2, 1, lastRow - 1, 7).setValues(fullData);

    sh.getRange(2, 5, lastRow - 1, 1).insertCheckboxes();
  });

  SpreadsheetApp.getActiveSpreadsheet().toast("Deadlines repaired.");
}

// Installs / refreshes the dropdown validation on the quest "Type" column
// (A). Necessary whenever the enum list is extended — the rule embeds the
// list literally, so existing sheets need to be re-stamped.
function FIX_DROPDOWNS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var questTypes = ["daily", "weekly", "monthly", "raid", "epic", "personal"];
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(questTypes, true).build();

  getAllowedUsers().forEach(function (chatId) {
    var sh = ss.getSheetByName(getSh(SH_QUEST, chatId));
    if (!sh) return;
    sh.getRange("A2:A").setDataValidation(rule);
  });

  SpreadsheetApp.getActiveSpreadsheet().toast("Quest dropdowns refreshed.");
}

// Ensures the two "system" categories (savings and FX exchange) exist in
// both columns of the shared categories sheet. These labels are read by
// analytics.gs to split savings/FX out of the spend-and-earn view, so they
// must be available as selectable categories.
function ADD_MISSING_CATEGORIES() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SH_SETTINGS);
  if (!sh) return;

  function addIfMissing(col, catName) {
    var lastRow = Math.max(2, sh.getLastRow());
    var data = sh.getRange(2, col, lastRow, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === catName) return;
    }
    var row = 2;
    while (sh.getRange(row, col).getValue() !== "") row++;
    sh.getRange(row, col).setValue(catName);
  }

  addIfMissing(1, L.savings_category_label);
  addIfMissing(1, L.fx_category_label);
  addIfMissing(2, L.savings_category_label);
  addIfMissing(2, L.fx_category_label);

  ss.toast("System categories are present.");
}
