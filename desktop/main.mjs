import { app, BrowserWindow, dialog, ipcMain, Menu, protocol, session, shell } from 'electron';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, writeFileSync } from 'node:fs';
import { APP_URL, desktopResponse, isAppUrl, isExternalUrl } from './request.mjs';
import { migrateLegacyProfile, profilePaths } from './profile.mjs';

app.setName('DeckShelf');
if (process.platform === 'win32') app.setAppUserModelId('dk.bircck.deckshelf');
// Keep this name and origin stable across versions and extraction directories.
const testing = process.argv.includes('--smoke-test');
if (testing && (!process.env.CA_TEST_PROFILE || !isAbsolute(process.env.CA_TEST_PROFILE))) {
  throw new Error('Smoke tests require an isolated absolute CA_TEST_PROFILE.');
}
const paths = testing ? { profile: process.env.CA_TEST_PROFILE, legacy: process.env.CA_TEST_LEGACY_PROFILE } : profilePaths(app.getPath('appData'));
const migration = migrateLegacyProfile(paths.legacy, paths.profile);
app.setPath('userData', paths.profile);
protocol.registerSchemesAsPrivileged([{ scheme: 'archive', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const root = fileURLToPath(new URL('../dist/', import.meta.url));
let window;
function logStartup(message) {
  try { appendFileSync(join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
function startupFailed(error) {
  logStartup(error.stack || error.message);
  // Automated checks must never leave native error dialogs on the user's desktop.
  if (!testing) dialog.showErrorBox('DeckShelf could not start', `${error.message}\n\nExtract the complete ZIP into a normal folder before starting the app.\nStartup details: ${join(app.getPath('userData'), 'startup.log')}`);
  app.exit(1);
}

async function openExternal(url) {
  if (isExternalUrl(url)) await shell.openExternal(url).catch(() => {});
}

function createWindow() {
  window = new BrowserWindow({
    title: 'DeckShelf', width: 1440, height: 960, minWidth: 640, minHeight: 480,
    backgroundColor: '#161a18', show: false,
    // A slim window bar replaces the title bar and menu bar: Windows draws only its window buttons,
    // and the bar's menu button opens the app menu (src/WindowBar.tsx).
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#0e0f11', symbolColor: '#c9c7c2', height: 34 },
    webPreferences: { preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged || (testing && !process.argv.includes('--production-window')) },
  });
  window.webContents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); void openExternal(url); }
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.once('ready-to-show', () => { if (!testing) window.show(); });
  window.on('closed', () => { window = undefined; });
  void window.loadURL(APP_URL).then(() => logStartup('Loaded application window')).catch(startupFailed);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    try { writeFileSync(join(app.getPath('userData'), 'startup.log'), ''); } catch {}
    logStartup(`Profile: ${migration}`);
    protocol.handle('archive', async request => {
      try { return await desktopResponse(request, root); }
      catch (error) { logStartup(`Protocol failure: ${error.stack || error}`); throw error; }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    // Only actions that mean something in DeckShelf. Text fields keep their own copy and paste shortcuts.
    const send = command => () => window?.webContents.send('menu-command', command);
    const menu = Menu.buildFromTemplate([
      { label: 'File', submenu: [
        { label: 'Export backup', accelerator: 'CmdOrCtrl+S', click: send('backup') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ] },
      { label: 'View', submenu: [
        { role: 'resetZoom', label: 'Actual size' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'reload', visible: false },
      ] },
      { label: 'Go', submenu: [
        { label: 'Collection', accelerator: 'CmdOrCtrl+1', click: send('grid') },
        { label: 'Cards', accelerator: 'CmdOrCtrl+2', click: send('cards') },
        { label: 'Pick a deck', accelerator: 'CmdOrCtrl+3', click: send('picker') },
        { type: 'separator' },
        { label: 'Search decks', accelerator: 'CmdOrCtrl+F', click: send('search') },
        { label: 'Library', accelerator: 'CmdOrCtrl+4', click: send('collection') },
      ] },
      { label: 'Help', submenu: [
        { label: 'DeckShelf Help', accelerator: 'F1', click: send('help') },
        { type: 'separator' },
        { label: 'About DeckShelf', click: () => { void dialog.showMessageBox(window, { title: 'DeckShelf', message: `DeckShelf ${app.getVersion()}`, detail: 'A personal Commander collection viewer and picker.\n\nDeckShelf is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.\n\nYour collection is saved on this device. Use Library to export a backup.' }); } },
      ] },
    ]);
    // Hidden with the title bar, the menu still provides the keyboard shortcuts.
    Menu.setApplicationMenu(menu);
    ipcMain.on('window-menu', event => {
      if (window && event.sender === window.webContents) menu.popup({ window, x: 4, y: 34 });
    });
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  }).catch(startupFailed);
  app.on('window-all-closed', () => app.quit());
}
