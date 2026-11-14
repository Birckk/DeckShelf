// Lets the window bar's menu button open the app menu and the menu send its commands. Nothing else reaches the page.
// fetchAllDecks tells the page it reads Archidekt from this computer's own address, so shelves
// load every deck's details instead of the website's listing-only shelves (src/fetchMode.ts).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deckshelfDesktop', {
  fetchAllDecks: true,
  openMenu: () => ipcRenderer.send('window-menu'),
  onCommand: listener => {
    const forward = (_event, command) => { if (typeof command === 'string') listener(command); };
    ipcRenderer.on('menu-command', forward);
    return () => ipcRenderer.removeListener('menu-command', forward);
  },
});
