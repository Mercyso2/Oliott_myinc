const { app } = require('electron');

function isAutoStartEnabled() {
  if (!app.getLoginItemSettings) return false;
  return Boolean(app.getLoginItemSettings().openAtLogin);
}

function enableAutoStart(enabled = true) {
  if (!app.setLoginItemSettings) return;
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: [],
  });
}

module.exports = { enableAutoStart, isAutoStartEnabled };
