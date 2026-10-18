// The MCP server's deck cache, kept on disk so a new agent session doesn't re-read a whole
// library. A deck read from a listing stays valid until Archidekt shows a later edit.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const VERSION = 1; // Bump when normalizeDeck's output changes shape.
const LIMIT = 3000;
const TTL = 3600000; // For decks read without a listing, such as a single deck link.

export function defaultCacheFile() {
  if (process.env.DECKSHELF_MCP_CACHE) return process.env.DECKSHELF_MCP_CACHE;
  const base = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    : process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'DeckShelf', 'mcp-cache.json');
}

// Without a file the cache lives in memory only.
export function createDeckCache(file) {
  const decks = new Map();
  if (file) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      if (data?.version === VERSION)
        for (const [id, entry] of Object.entries(data.decks || {}))
          if (Number.isFinite(entry?.time) && (entry.deck?.id === id && Array.isArray(entry.deck.commanders) ||
              typeof entry.failed === 'string' && typeof entry.updatedAt === 'string')) decks.set(id, entry);
    } catch { /* A missing or damaged cache only means a cold start. */ }
  }
  let dirty = false;
  const remember = (id, value, updatedAt) => {
    decks.delete(id);
    decks.set(id, { time: Date.now(), ...(updatedAt ? { updatedAt } : {}), ...value });
    while (decks.size > LIMIT) decks.delete(decks.keys().next().value);
    dirty = true;
  };
  return {
    size: () => decks.size,
    // Returns the deck, { failed: reason } for a deck that could not be read, or undefined.
    get(id, updatedAt) {
      const entry = decks.get(id);
      // A remembered failure needs the listing to prove the deck is still unedited.
      if (!entry || (entry.failed && !updatedAt)) return undefined;
      const fresh = updatedAt
        ? entry.updatedAt ? entry.updatedAt === updatedAt : entry.time > Date.parse(updatedAt)
        : Date.now() - entry.time < TTL;
      if (!fresh) return undefined;
      return entry.failed ? { failed: entry.failed } : entry.deck;
    },
    put(id, deck, updatedAt) { remember(id, { deck }, updatedAt); },
    // Only for failures that last until the deck is edited, such as a missing commander.
    fail(id, reason, updatedAt) { remember(id, { failed: reason }, updatedAt); },
    save() {
      if (!file || !dirty) return;
      dirty = false;
      try {
        mkdirSync(dirname(file), { recursive: true });
        const temporary = `${file}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify({ version: VERSION, decks: Object.fromEntries(decks) }));
        renameSync(temporary, file);
      } catch { dirty = true; }
    },
  };
}
