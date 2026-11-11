// How many requests a shelf may make to Archidekt. The hosted website proxies every visitor
// through one server and one IP (about 80 deck or folder reads a minute), so it draws shelves
// from folder listings and loads a deck's full details only when someone opens it. The Windows
// app runs the same API in-process from the visitor's own IP, so it still loads every deck.
// The app's preload script says so; nothing else sets it, so one build serves both.
export const fetchAllDecks = !!(globalThis as { deckshelfDesktop?: { fetchAllDecks?: boolean } }).deckshelfDesktop?.fetchAllDecks;
