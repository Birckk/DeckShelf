import { app, BrowserWindow, dialog, Menu, protocol, session, shell } from 'electron';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync, writeFileSync } from 'node:fs';
import { APP_URL, desktopResponse, isAppUrl, isExternalUrl } from './request.mjs';

app.setName('Commander Archive');
if (process.platform === 'win32') app.setAppUserModelId('dk.bircck.commanderarchive');
// Keep this name and origin stable across versions and extraction directories.
const testing = process.argv.includes('--smoke-test');
if (testing && (!process.env.CA_TEST_PROFILE || !isAbsolute(process.env.CA_TEST_PROFILE))) {
  throw new Error('Smoke tests require an isolated absolute CA_TEST_PROFILE.');
}
app.setPath('userData', testing ? process.env.CA_TEST_PROFILE : join(app.getPath('appData'), 'Commander Archive'));
protocol.registerSchemesAsPrivileged([{ scheme: 'archive', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const root = fileURLToPath(new URL('../dist/', import.meta.url));
let window;
function logStartup(message) {
  try { appendFileSync(join(app.getPath('userData'), 'startup.log'), `${new Date().toISOString()} ${message}\n`); } catch {}
}
function startupFailed(error) {
  logStartup(error.stack || error.message);
  // Automated checks must never leave native error dialogs on the user's desktop.
  if (!testing) dialog.showErrorBox('Commander Archive could not start', `${error.message}\n\nExtract the complete ZIP into a normal folder before starting the app.\nStartup details: ${join(app.getPath('userData'), 'startup.log')}`);
  app.exit(1);
}

async function openExternal(url) {
  if (isExternalUrl(url)) await shell.openExternal(url).catch(() => {});
}

function createWindow() {
  window = new BrowserWindow({
    title: 'Commander Archive', width: 1440, height: 960, minWidth: 640, minHeight: 480,
    backgroundColor: '#161a18', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged || (testing && !process.argv.includes('--production-window')) },
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
    protocol.handle('archive', async request => {
      try { return await desktopResponse(request, root); }
      catch (error) { logStartup(`Protocol failure: ${error.stack || error}`); throw error; }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [{ role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      { label: 'Help', submenu: [
        { label: 'Desktop guide', click: () => { void shell.openPath(join(process.resourcesPath, 'DESKTOP.md')); } },
        { label: 'Third-party notices', click: () => { void shell.openPath(join(process.resourcesPath, 'THIRD_PARTY_NOTICES.md')); } },
        { label: 'About Commander Archive', click: () => { void dialog.showMessageBox(window, { title: 'Commander Archive', message: `Commander Archive ${app.getVersion()}`, detail: 'A personal Commander collection viewer and picker.\n\nDeckShelf is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.\n\nYour collection is saved on this device. Use My collection to export a backup.' }); } },
      ] },
    ]));
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  }).catch(startupFailed);
  app.on('window-all-closed', () => app.quit());
}
