import { saveSharedShelf, type SharedFolder } from './collection.ts';
import { parseCollection, type Collection, type CollectionSource, type Deck } from './domain.ts';

type CollectionStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

// Shared tabs are read-only until Save. Re-read at the explicit write boundary;
// another tab may have changed or removed the visitor's personal collection.
export function saveSharedCollectionToStorage(storage: CollectionStorage, key: string, source: CollectionSource, decks: Deck[], initial: () => Collection, folders?: SharedFolder[]): Collection {
  const raw = storage.getItem(key);
  const current = raw === null ? initial() : parseCollection(raw);
  const next = saveSharedShelf(current, source, decks, folders);
  storage.setItem(key, JSON.stringify(next));
  return next;
}

// Web Locks serialize shared Saves across tabs on this origin. Older browsers
// without Web Locks retain the uncoordinated read/merge/write fallback.
export async function saveSharedCollectionWithLock(storage: CollectionStorage, key: string, source: CollectionSource, decks: Deck[], initial: () => Collection, locks: Pick<LockManager, 'request'> | undefined = globalThis.navigator?.locks, folders?: SharedFolder[]): Promise<Collection> {
  const save = () => saveSharedCollectionToStorage(storage, key, source, decks, initial, folders);
  return locks ? locks.request('deckshelf-collection', save) : save();
}
