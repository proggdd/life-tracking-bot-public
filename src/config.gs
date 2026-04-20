// ============================================================================
// config.gs — configuration surface
//
// All secrets and environment-specific values live in Google Apps Script
// Properties (File → Project properties → Script properties in the legacy
// editor, or the "Project Settings" panel in the new editor).
//
// Required keys:
//   BOT_TOKEN          Telegram Bot token issued by @BotFather
//   ALLOWED_USERS_CSV  Comma-separated list of Telegram chat IDs allowed to
//                      use this deployment, e.g. "11111111,22222222"
// Optional keys:
//   TIMEZONE           IANA tz name used for all dates and cron triggers.
//                      Defaults to "UTC" when missing.
//   DEPLOYMENT_URL     Public Web App URL (the /exec endpoint) — used only by
//                      updateWebhook(). Read from properties so nothing leaks
//                      into source control.
//
// See .env.example for the expected layout and setup instructions.
// ============================================================================

var SH_EXPENSE         = "ledger_expense";
var SH_INCOME          = "ledger_income";
var SH_SETTINGS        = "ledger_categories";
var SH_SHOP            = "shop_catalog";

var SH_DIARY           = "diary";
var SH_CHAR            = "character";
var SH_QUEST           = "questlog";
var SH_HISTORY         = "quest_history";
var SH_SHOP_HISTORY    = "shop_history";
var SH_INVENTORY       = "inventory";
var SH_WEIGHT          = "weight";

function getBotToken() {
  var t = PropertiesService.getScriptProperties().getProperty("BOT_TOKEN");
  if (!t) throw new Error("BOT_TOKEN is not set in Script Properties");
  return t;
}

function getAllowedUsers() {
  var raw = PropertiesService.getScriptProperties().getProperty("ALLOWED_USERS_CSV");
  if (!raw) return [];
  return raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function getTimezone() {
  return PropertiesService.getScriptProperties().getProperty("TIMEZONE") || "UTC";
}

function getDeploymentUrl() {
  return PropertiesService.getScriptProperties().getProperty("DEPLOYMENT_URL") || "";
}

function getCurrentDateStr() {
  return Utilities.formatDate(new Date(), getTimezone(), "dd.MM.yyyy");
}

function getCurrentTimeStr() {
  return Utilities.formatDate(new Date(), getTimezone(), "HH:mm");
}

// Scope per-user sheet names with a chat_id suffix. Acts as the primary
// tenancy boundary: every read or write for a user hits a sheet named
// `{base}_{chatId}`, so it is not possible to accidentally mix two users'
// personal progression.
function getSh(baseName, chatId) {
  return baseName + "_" + chatId;
}
