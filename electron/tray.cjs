const { Menu, Tray, app, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { enableAutoStart, isAutoStartEnabled } = require('./autostart.cjs');

let tray = null;

const FALLBACK_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIklEQVR4AWP4//8/AyUYTFhZWTEwMDAwqGJgYGBgqAAAMbQCB4Yp6S8AAAAASUVORK5CYII=';

function trayImage(baseDir) {
  const candidates = [
    path.join(baseDir || '', 'assets', 'icon.ico'),
    path.join(baseDir || '', 'assets', 'tray.png'),
    path.join(baseDir || '', 'engine-tray', 'assets', 'myinc-engine-icon.png'),
    path.join(baseDir || '', 'engine-tray', 'assets', 'myinc-engine.ico'),
    path.join(baseDir || '', 'src', 'assets', 'myinc-logo-dark.png'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'assets', 'icon.ico'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'assets', 'tray.png'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'engine-tray', 'assets', 'myinc-engine-icon.png'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'engine-tray', 'assets', 'myinc-engine.ico'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'assets', 'myinc-logo-dark.png'),
    path.join(__dirname, '..', 'assets', 'tray.png'),
  ];
  for (const iconPath of candidates) {
    if (!iconPath || !fs.existsSync(iconPath)) continue;
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image.resize({ width: 16, height: 16 });
  }
  return nativeImage.createFromDataURL(FALLBACK_ICON);
}

function statusPath(baseDir) {
  const cwd = typeof engineCwdSafe === 'function' ? engineCwdSafe(baseDir) : process.cwd();
  const candidates = [
    path.join(cwd, '.myinc-engine', 'status.json'),
    path.join(process.cwd(), '.myinc-engine', 'status.json'),
    path.join(baseDir || '', '.myinc-engine', 'status.json'),
  ];
  return candidates.find((item) => fs.existsSync(item)) || candidates[0];
}

let engineCwdSafe = null;

function createTray(mainWindow, engine, baseDir) {
  engineCwdSafe = engine.engineCwd;
  tray = new Tray(trayImage(baseDir));
  const refreshMenu = () => {
    const running = engine.isRunning?.() ? 'rodando' : 'pausado';
    const menu = Menu.buildFromTemplate([
      { label: `MYINC Motor Local: ${running}`, enabled: false },
      { type: 'separator' },
      { label: 'Abrir painel local', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: 'Abrir status do motor', click: () => shell.openPath(statusPath(baseDir)) },
      { label: 'Abrir pasta do app', click: () => shell.openPath(process.cwd()) },
      {
        label: 'Iniciar com Windows',
        type: 'checkbox',
        checked: isAutoStartEnabled(),
        click: (item) => {
          enableAutoStart(item.checked);
          refreshMenu();
        },
      },
      { type: 'separator' },
      { label: 'Pausar processamento', click: () => { engine.stopEngine(); refreshMenu(); } },
      { label: 'Retomar processamento', click: () => { engine.startEngine(baseDir); refreshMenu(); } },
      { type: 'separator' },
      { label: 'Sair', click: () => { engine.stopEngine(); app.isQuiting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
  };
  tray.setToolTip('MYINC Local Engine V7');
  refreshMenu();
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  return tray;
}

module.exports = { createTray };
