// Lets the window bar's menu button open the app menu and the menu send its commands. Nothing else reaches the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deckshelfDesktop', {
  openMenu: () => ipcRenderer.send('window-menu'),
  onCommand: listener => {
    const forward = (_event, command) => { if (typeof command === 'string') listener(command); };
    ipcRenderer.on('menu-command', forward);
    return () => ipcRenderer.removeListener('menu-command', forward);
  },
});
