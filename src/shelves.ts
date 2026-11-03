import { coverOf, imageUrl, validateDeck, validateSource, type CollectionSource, type Deck } from './domain.ts';
import type { SharedSource } from './share-links.ts';
import type { SharedFolder } from './collection.ts';

// Shared shelves the visitor has looked at, kept apart from the v1 collection.
// Nothing here is read or written by backups, Save to my collection or restore.
export type LoadedShelf = { source: CollectionSource; decks: Deck[]; folders?: SharedFolder[] };
export type ShelfRef = SharedSource & { name: string; count: number; art: string[]; at: string };
export type KeptShelf = LoadedShelf & { keptAt: string };
type ShelfStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export const RECENT_KEY = 'deckshelf.recent-shelves.v1';
export const KEPT_KEY = 'deckshelf.kept-shelves.v1';
export const RECENT_LIMIT = 8;
export const KEPT_LIMIT = 12;

export const shelfId = (source: SharedSource) => `${source.kind}:${source.value.toLowerCase()}`;

// Loaded shelves stay in memory for this tab, so returning never refetches.
const memory = new Map<string, LoadedShelf>();
export const cachedShelf = (id: string) => memory.get(id);
export function cacheShelf(shelf: LoadedShelf) { memory.set(shelfId(shelf.source), shelf); }

const validFolder = (value: unknown): value is SharedFolder => {
  const folder = value as SharedFolder;
  return !!folder && typeof folder === 'object' && validateSource(folder.source) &&
    typeof folder.path === 'string' && folder.path.length <= 2000 && typeof folder.root === 'boolean';
};

// A shared link shows the account's or folder's whole public tree, in every format: the
// same listing Add decks reads. The shelf's own source is the union of its folders.
export function shelfFromFolders(requested: SharedSource, found: unknown): { source: CollectionSource; folders: SharedFolder[] } {
  const data = found as { name?: unknown; folders?: unknown[] } | null;
  const folders = data?.folders;
  if (typeof data?.name !== 'string' || !Array.isArray(folders) || !folders.length || folders.length > 80 ||
      !folders.every(validFolder) || folders.filter(folder => folder.root).length !== 1)
    throw new Error('The source returned incomplete folder information.');
  const root = folders.find(folder => folder.root)!;
  if (requested.kind === 'folder' && root.source.key !== `folder:${requested.value}`)
    throw new Error('The source returned a different folder.');
  const entries = [...new Map(folders.flatMap(folder => folder.source.entries).map(entry => [entry.id, entry])).values()];
  if (entries.length > 1000) throw new Error('This collection has more than 1,000 decks.');
  const base = requested.kind === 'account'
    ? { key: `account:${requested.value.toLowerCase()}`, kind: 'account' as const, value: requested.value, name: data.name,
      url: `https://archidekt.com/u/${encodeURIComponent(requested.value)}`, checkedAt: root.source.checkedAt }
    : root.source;
  const source: CollectionSource = { ...base, formatScope: 'all', entries, knownIds: entries.map(entry => entry.id) };
  if (!validateSource(source)) throw new Error('The source returned incomplete collection information.');
  return { source, folders: folders.map(({ source, path, root }) => ({ source, path, root })) };
}

export function shelfRef({ source, decks }: LoadedShelf, at = new Date().toISOString()): ShelfRef {
  const art = [...new Set(decks.map(deck => coverOf(deck).art).filter(Boolean))].slice(0, 3);
  return { kind: source.kind, value: source.value, name: source.name, count: decks.length, art, at };
}

export function addRecent(list: ShelfRef[], ref: ShelfRef, limit = RECENT_LIMIT): ShelfRef[] {
  return [ref, ...list.filter(item => shelfId(item) !== shelfId(ref))].slice(0, limit);
}

export function keepShelf(list: KeptShelf[], shelf: LoadedShelf, keptAt = new Date().toISOString()): KeptShelf[] {
  const id = shelfId(shelf.source);
  const existing = list.find(item => shelfId(item.source) === id);
  // Keeping again refreshes the snapshot but keeps the shelf's place in the switcher.
  if (existing) return list.map(item => item === existing ? { ...shelf, keptAt: existing.keptAt } : item);
  return [...list, { ...shelf, keptAt }].slice(-KEPT_LIMIT);
}

const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

function validRef(value: unknown): value is ShelfRef {
  const ref = value as ShelfRef;
  return !!ref && typeof ref === 'object' && ['account', 'folder'].includes(ref.kind) &&
    typeof ref.value === 'string' && (ref.kind === 'folder' ? /^\d{1,12}$/.test(ref.value) : /^[\p{L}\p{N}_.@+ -]{1,100}$/u.test(ref.value)) &&
    typeof ref.name === 'string' && ref.name.length <= 200 && Number.isInteger(ref.count) && ref.count >= 0 &&
    Array.isArray(ref.art) && ref.art.length <= 3 && ref.art.every(imageUrl) && date(ref.at);
}

function validKept(value: unknown): value is KeptShelf {
  const shelf = value as KeptShelf;
  return !!shelf && typeof shelf === 'object' && validateSource(shelf.source) && date(shelf.keptAt) &&
    (shelf.folders === undefined || (Array.isArray(shelf.folders) && shelf.folders.length <= 80 && shelf.folders.every(validFolder))) &&
    Array.isArray(shelf.decks) && shelf.decks.length <= 1000 && shelf.decks.every(validateDeck);
}

// Damaged entries are dropped one by one; a damaged list never blocks the app.
function readList<T>(storage: ShelfStorage | undefined, key: string, valid: (value: unknown) => value is T, limit: number): T[] {
  try {
    const value = JSON.parse(storage?.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(valid).slice(0, limit) : [];
  } catch { return []; }
}
function writeList(storage: ShelfStorage | undefined, key: string, list: unknown[]) {
  if (!storage) return false;
  try { storage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
}

export const readRecent = (storage?: ShelfStorage) => readList(storage, RECENT_KEY, validRef, RECENT_LIMIT);
export const writeRecent = (storage: ShelfStorage | undefined, list: ShelfRef[]) => writeList(storage, RECENT_KEY, list);
export const readKept = (storage?: ShelfStorage) => readList(storage, KEPT_KEY, validKept, KEPT_LIMIT);
export const writeKept = (storage: ShelfStorage | undefined, list: KeptShelf[]) => writeList(storage, KEPT_KEY, list);
