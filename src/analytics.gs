// ============================================================================
// analytics.gs — on-demand reporting
//
// generateAdvancedReport(cat, period, d1, d2, chatId) is the heavy-read path
// in the app: 7 report kinds ("expense", "income", "gold", "quests", "mood",
// "weight", "general") × 5 periods (day, week, month, year, custom). Each
// call reads up to 5 sheets fully and bucket-sorts rows by currency and
// category. Runs in <=1s for a year of data on our current scale but is the
// first function to hit the 6-minute execution ceiling as volume grows —
// that cost motivated the Python/Postgres migration plan.
//
// Savings and FX transfers live on the same expense/income sheets as regular
// transactions, so they are disambiguated with substring matches against
// locale keywords (L.savings_keywords, L.fx_keyword) and routed to their own
// sub-tables so they don't pollute the "spend" and "earn" totals.
// ============================================================================

function sendStatMainMenu(chatId, messageId) {
  var c = L.stats_categories;
  var kb = [
    [{ text: c.expense, callback_data: "stat_cat_expense" },
     { text: c.income,  callback_data: "stat_cat_income"  }],
    [{ text: c.gold,    callback_data: "stat_cat_gold"    },
     { text: c.quests,  callback_data: "stat_cat_quests"  }],
    [{ text: c.mood,    callback_data: "stat_cat_mood"    },
     { text: c.weight,  callback_data: "stat_cat_weight"  }],
    [{ text: c.general, callback_data: "stat_cat_general" }],
    [{ text: L.btn_back_hub, callback_data: "hub_main" }],
  ];
  renderMenu(chatId, messageId, L.stats_title, { inline_keyboard: kb });
}

function sendStatPeriodMenu(chatId, cat, messageId) {
  var p = L.stats_periods;
  var kb = [
    [{ text: p.day,   callback_data: "stat_run_" + cat + "_day"   },
     { text: p.week,  callback_data: "stat_run_" + cat + "_week"  }],
    [{ text: p.month, callback_data: "stat_run_" + cat + "_month" },
     { text: p.year,  callback_data: "stat_run_" + cat + "_year"  }],
    [{ text: p.custom, callback_data: "stat_run_" + cat + "_custom" }],
    [{ text: L.btn_back, callback_data: "hub_stats" }],
  ];
  renderMenu(chatId, messageId, L.stats_period_prompt(L.stats_categories[cat]), {
    inline_keyboard: kb,
  });
}

function runStatReport(chatId, messageId, data) {
  var rest = data.substring("stat_run_".length);
  // rest is like "expense_week" or "general_custom" — category id never has
  // underscores, period is a single trailing token.
  var idx = rest.lastIndexOf("_");
  var cat = rest.substring(0, idx);
  var period = rest.substring(idx + 1);

  if (period === "custom") {
    var cache = CacheService.getScriptCache();
    cache.put("stat_cat_" + chatId, cat, 600);
    cache.put("state_" + chatId, "wait_stat_dates", 600);
    cache.put("prompt_msg_id_" + chatId, String(messageId), 600);
    renderMenu(chatId, messageId, L.stats_custom_prompt, {
      inline_keyboard: [[{ text: L.btn_back, callback_data: "stat_cat_" + cat }]],
    });
    return;
  }

  var report = generateAdvancedReport(cat, period, "", "", chatId);
  renderMenu(chatId, messageId, report, {
    inline_keyboard: [
      [{ text: L.btn_back, callback_data: "stat_cat_" + cat }],
      [{ text: L.btn_back_hub, callback_data: "hub_main" }],
    ],
  });
}

// ---------------------------------------------------------------------------
// The actual aggregator. Organised as:
//   1) resolve [bStart, bEnd] for the requested period
//   2) scan expense + income sheets once, routing rows into
//      finStats / excStats / savingsStats / catBreakdown
//   3) scan quest_history for XP/gold, shop_history for gold spent
//   4) scan diary for mood/energy/anxiety averages and passive XP
//   5) scan weight for start / end / delta
//   6) render report blocks in a fixed order, guarded by `cat`
// ---------------------------------------------------------------------------
function generateAdvancedReport(cat, period, d1Str, d2Str, chatId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var bStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var bEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (period === "week") {
    bStart.setDate(bStart.getDate() - 6);
  } else if (period === "month") {
    bStart.setDate(1);
    bEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === "year") {
    bStart = new Date(now.getFullYear(), 0, 1);
    bEnd   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else if (period === "custom") {
    var parseDDMMYY = function (s) {
      return new Date(
        2000 + parseInt(s.substring(4, 6)),
        parseInt(s.substring(2, 4)) - 1,
        parseInt(s.substring(0, 2))
      );
    };
    bStart = parseDDMMYY(d1Str);
    bEnd   = parseDDMMYY(d2Str);
    bEnd.setHours(23, 59, 59);
  }

  var tz = getTimezone();
  var rep =
    L.rep_period(
      Utilities.formatDate(bStart, tz, "dd.MM.yyyy"),
      Utilities.formatDate(bEnd,   tz, "dd.MM.yyyy")
    ) + "\n━━━━━━━━━━━━━━━\n";

  function inRange(dStr) {
    var d = parseSheetDate(dStr);
    return d >= bStart && d <= bEnd;
  }

  // Pre-seeded with the standard currencies so iteration order is stable;
  // unknown currencies get added lazily on first use.
  var finStats = {};
  var excStats = {};
  for (var ci = 0; ci < L.currencies.length; ci++) {
    finStats[L.currencies[ci]] = { in: 0, out: 0 };
    excStats[L.currencies[ci]] = { in: 0, out: 0 };
  }
  var savingsStats = {};
  var catBreakdown = { expense: {}, income: {} };
  var qStats = {
    daily: 0, weekly: 0, monthly: 0, raid: 0, epic: 0, personal: 0,
    bonus: 0, skip: 0, penalty: 0,
  };
  var goldEarned = 0, xpEarned = 0, goldSpent = 0;
  var moodSum = 0, nrgSum = 0, anxSum = 0, diaryCount = 0;

  function addCatStat(type, curr, category, amount) {
    if (!catBreakdown[type][curr]) catBreakdown[type][curr] = {};
    if (!catBreakdown[type][curr][category]) catBreakdown[type][curr][category] = 0;
    catBreakdown[type][curr][category] += amount;
  }

  // Shared classifier for expense/income rows. Returns whether the row
  // should also be counted as a regular spend/earn line (false for pure
  // FX or savings transfers that have no other category tag).
  function classifyLedgerRow(kind, curr, amt, origCat) {
    var cName = String(origCat || "").toLowerCase();

    if (cName.indexOf(L.fx_keyword) !== -1) {
      if (!excStats[curr]) excStats[curr] = { in: 0, out: 0 };
      if (kind === "expense") excStats[curr].out += amt;
      else excStats[curr].in += amt;
      return { keep: false, cat: origCat };
    }

    var isSav = false;
    for (var k = 0; k < L.savings_keywords.length; k++) {
      if (cName.indexOf(L.savings_keywords[k]) !== -1) { isSav = true; break; }
    }
    if (isSav) {
      if (!savingsStats[curr]) savingsStats[curr] = 0;
      savingsStats[curr] += (kind === "expense" ? -amt : amt);

      // A pure "money to savings" row (no combined category) is invisible
      // from the spend view; a mixed "Groceries + Savings" row stays visible
      // but gets the savings token stripped for readability.
      if (String(origCat).indexOf("+") === -1 && String(origCat).length < 25) {
        return { keep: false, cat: origCat };
      }
      var stripped = String(origCat)
        .replace(new RegExp(L.savings_category_label + "\\s*\\+\\s*", "i"), "")
        .replace(new RegExp("\\+\\s*" + L.savings_category_label, "i"), "")
        .trim();
      return {
        keep: true,
        cat: stripped + (kind === "expense" ? " (from pot)" : " (to pot)"),
      };
    }

    return { keep: true, cat: origCat };
  }

  // ---- expenses / incomes ------------------------------------------------
  if (cat === "expense" || cat === "income" || cat === "general") {
    if (cat === "expense" || cat === "general") {
      var exSh = ss.getSheetByName(SH_EXPENSE);
      if (exSh && exSh.getLastRow() > 1) {
        var exData = exSh.getRange(2, 1, exSh.getLastRow() - 1, 5).getValues();
        for (var i = 0; i < exData.length; i++) {
          if (!inRange(exData[i][0])) continue;
          var curr = exData[i][2];
          var amt  = parseFloat(exData[i][3]) || 0;
          var c = classifyLedgerRow("expense", curr, amt, exData[i][4] || "Uncategorised");
          if (!c.keep) continue;
          if (!finStats[curr]) finStats[curr] = { in: 0, out: 0 };
          finStats[curr].out += amt;
          addCatStat("expense", curr, c.cat, amt);
        }
      }
    }
    if (cat === "income" || cat === "general") {
      var inSh = ss.getSheetByName(SH_INCOME);
      if (inSh && inSh.getLastRow() > 1) {
        var inData = inSh.getRange(2, 1, inSh.getLastRow() - 1, 5).getValues();
        for (var j = 0; j < inData.length; j++) {
          if (!inRange(inData[j][0])) continue;
          var curI = inData[j][2];
          var amtI = parseFloat(inData[j][3]) || 0;
          var cI = classifyLedgerRow("income", curI, amtI, inData[j][4] || "Uncategorised");
          if (!cI.keep) continue;
          if (!finStats[curI]) finStats[curI] = { in: 0, out: 0 };
          finStats[curI].in += amtI;
          addCatStat("income", curI, cI.cat, amtI);
        }
      }
    }
  }

  // ---- quest history / shop spend ---------------------------------------
  if (cat === "gold" || cat === "quests" || cat === "general") {
    var hSh = ss.getSheetByName(getSh(SH_HISTORY, chatId));
    if (hSh && hSh.getLastRow() > 1) {
      var hData = hSh.getRange(2, 1, hSh.getLastRow() - 1, 6).getValues();
      for (var h = 0; h < hData.length; h++) {
        if (!inRange(hData[h][0])) continue;
        var t = hData[h][2];
        if (qStats[t] !== undefined) qStats[t]++;
        xpEarned   += parseInt(hData[h][4]) || 0;
        goldEarned += parseInt(hData[h][5]) || 0;
      }
    }
    var spSh = ss.getSheetByName(getSh(SH_SHOP_HISTORY, chatId));
    if (spSh && spSh.getLastRow() > 1) {
      var sData = spSh.getRange(2, 1, spSh.getLastRow() - 1, 3).getValues();
      for (var s = 0; s < sData.length; s++) {
        if (!inRange(sData[s][0])) continue;
        goldSpent += Math.abs(parseInt(sData[s][2]) || 0);
      }
    }
  }

  // ---- diary (mood/energy/anxiety + passive XP) -------------------------
  if (cat === "mood" || cat === "general" || cat === "gold") {
    var dSh = ss.getSheetByName(getSh(SH_DIARY, chatId));
    if (dSh && dSh.getLastRow() > 1) {
      var dData = dSh.getRange(2, 1, dSh.getLastRow() - 1, 8).getValues();
      for (var d = 0; d < dData.length; d++) {
        if (!inRange(dData[d][0])) continue;
        if (cat === "mood" || cat === "general") {
          moodSum += parseInt(dData[d][2]) || 0;
          nrgSum  += parseInt(dData[d][3]) || 0;
          anxSum  += parseInt(dData[d][4]) || 0;
          diaryCount++;
        }
        if (cat === "gold" || cat === "general") {
          xpEarned   += parseInt(dData[d][6]) || 0;
          goldEarned += parseInt(dData[d][7]) || 0;
        }
      }
    }
    if (cat === "mood" || cat === "general") {
      rep += L.rep_mental + "\n";
      if (diaryCount > 0) {
        rep += L.rep_mental_line(
          (moodSum / diaryCount).toFixed(1),
          (nrgSum  / diaryCount).toFixed(1),
          (anxSum  / diaryCount).toFixed(1)
        ) + "\n\n";
      } else {
        rep += L.rep_no_diary + "\n\n";
      }
    }
  }

  // ---- weight delta -----------------------------------------------------
  if (cat === "weight" || cat === "general") {
    var wSh = ss.getSheetByName(getSh(SH_WEIGHT, chatId));
    var wArr = [];
    if (wSh && wSh.getLastRow() > 1) {
      var wData = wSh.getRange(2, 1, wSh.getLastRow() - 1, 3).getValues();
      for (var w = 0; w < wData.length; w++) {
        if (inRange(wData[w][0])) wArr.push(parseFloat(wData[w][2]));
      }
    }
    rep += L.rep_weight + "\n";
    if (wArr.length > 0) {
      var wS = wArr[0], wE = wArr[wArr.length - 1], diff = wE - wS;
      rep += "Start: " + wS + " kg | End: " + wE + " kg\n" +
             "Delta: <b>" + (diff > 0 ? "+" : "") + diff.toFixed(1) + " kg</b>\n\n";
    } else {
      rep += L.rep_weight_no_data + "\n\n";
    }
  }

  // ---- FX breakdown -----------------------------------------------------
  if (cat === "expense" || cat === "income" || cat === "general") {
    var hasExc = false;
    var excStr = L.rep_fx + "\n";
    for (var cX in excStats) {
      if (excStats[cX].out > 0) { excStr += L.rep_fx_out(excStats[cX].out.toFixed(0), cX) + "\n"; hasExc = true; }
      if (excStats[cX].in  > 0) { excStr += L.rep_fx_in (excStats[cX].in .toFixed(0), cX) + "\n"; hasExc = true; }
    }
    if (hasExc) rep += excStr + "\n";
  }

  // ---- savings delta ----------------------------------------------------
  if (cat === "expense" || cat === "income" || cat === "general") {
    rep += L.rep_savings + "\n";
    var hasSav = false;
    for (var cS in savingsStats) {
      if (savingsStats[cS] !== 0) {
        rep += (savingsStats[cS] > 0 ? "↗️ +" : "↘️ ") + savingsStats[cS].toFixed(0) + " " + cS + "\n";
        hasSav = true;
      }
    }
    if (!hasSav) rep += L.rep_savings_empty + "\n\n";
    else rep += "\n";
  }

  // ---- expense detail ---------------------------------------------------
  if (cat === "expense" || cat === "general") {
    rep += L.rep_expense + "\n";
    var hasExp = false;
    for (var cE in finStats) {
      if (finStats[cE].out > 0) {
        rep += "➖ <b>" + finStats[cE].out.toFixed(0) + " " + cE + "</b>\n";
        if (cat !== "general" && catBreakdown.expense[cE]) {
          var keys = Object.keys(catBreakdown.expense[cE]).sort(function (a, b) {
            return catBreakdown.expense[cE][b] - catBreakdown.expense[cE][a];
          });
          for (var k = 0; k < keys.length; k++) {
            rep += "   ├ " + keys[k] + ": " + catBreakdown.expense[cE][keys[k]].toFixed(0) + "\n";
          }
        }
        hasExp = true;
      }
    }
    if (!hasExp) rep += L.rep_expense_empty + "\n";
    rep += "\n";
  }

  // ---- income detail ----------------------------------------------------
  if (cat === "income" || cat === "general") {
    rep += L.rep_income + "\n";
    var hasInc = false;
    for (var cI2 in finStats) {
      if (finStats[cI2].in > 0) {
        rep += "➕ <b>" + finStats[cI2].in.toFixed(0) + " " + cI2 + "</b>\n";
        if (cat !== "general" && catBreakdown.income[cI2]) {
          var keysI = Object.keys(catBreakdown.income[cI2]).sort(function (a, b) {
            return catBreakdown.income[cI2][b] - catBreakdown.income[cI2][a];
          });
          for (var ki = 0; ki < keysI.length; ki++) {
            rep += "   ├ " + keysI[ki] + ": " + catBreakdown.income[cI2][keysI[ki]].toFixed(0) + "\n";
          }
        }
        hasInc = true;
      }
    }
    if (!hasInc) rep += L.rep_income_empty + "\n";
    rep += "\n";
  }

  // ---- completed quests --------------------------------------------------
  if (cat === "quests" || cat === "general") {
    rep += L.rep_quests + "\n";
    var hasQ = false;
    var ordered = ["daily", "weekly", "monthly", "raid", "epic", "personal", "bonus"];
    for (var oi = 0; oi < ordered.length; oi++) {
      var qt = ordered[oi];
      if (qStats[qt] > 0) {
        var label = (L.quest_type_labels && L.quest_type_labels[qt]) || qt;
        rep += L.rep_quest_line(label, qStats[qt]) + "\n";
        hasQ = true;
      }
    }
    if (qStats.skip > 0) { rep += L.rep_quest_skipped(qStats.skip) + "\n"; hasQ = true; }
    if (!hasQ) rep += L.rep_quests_empty + "\n";
    rep += "\n";
  }

  // ---- net balance (general only) ---------------------------------------
  if (cat === "general") {
    rep += L.rep_balance + "\n";
    var hasBal = false;
    for (var cB in finStats) {
      var net = finStats[cB].in - finStats[cB].out;
      if (net !== 0) {
        rep += (net > 0 ? "🟢 +" : "🔴 ") + net.toFixed(0) + " " + cB + "\n";
        hasBal = true;
      }
    }
    if (!hasBal) rep += L.rep_balance_zero + "\n\n";
    else rep += "\n";
  }

  // ---- economy snapshot -------------------------------------------------
  if (cat === "gold" || cat === "general") {
    var st = getRealTimeStats(chatId);
    rep += L.rep_economy + "\n" +
           L.rep_economy_level(st.lvl) + "\n" +
           L.rep_economy_progress(st.curXp, st.nextGoal) + "\n" +
           L.rep_economy_earned(xpEarned, goldEarned) + "\n" +
           L.rep_economy_spent(goldSpent) + "\n";
  }

  return rep;
}

// Format accepted on the date column: either a real Date object or a
// "dd.mm.yyyy" string. Anything else falls back to the epoch so it never
// matches a real range.
function parseSheetDate(str) {
  if (!str || String(str).toLowerCase() === "false") return new Date(0);
  if (str instanceof Date) return str;
  var m = String(str).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(m[3], m[2] - 1, m[1]);
  return new Date(str);
}
