import { useEffect, useRef, useState } from 'react';
import { validateDeck, type CollectionSource, type Deck } from './domain';
import { parseSharePath } from './share-links';
import { cacheShelf, cachedShelf, shelfFromFolders, shelfId, type LoadedShelf } from './shelves';
import type { SharedFolder } from './collection';

export function readSharedLocation() {
  try { return { source: parseSharePath(location.pathname, location.search), error: '' }; }
  catch { return { source: null, error: 'This collection link is invalid or uses an unsupported format or selection.' }; }
}

// A shelf already loaded in this tab (or a kept snapshot from `lookup`) opens at once.
export function useSharedCollection(route: ReturnType<typeof readSharedLocation>, { lookup, onLoad }: {
  lookup?: (id: string) => LoadedShelf | undefined; onLoad?: (shelf: LoadedShelf) => void;
} = {}) {
  const callbacks = useRef({ lookup, onLoad });
  callbacks.current = { lookup, onLoad };
  const [result, setResult] = useState<{ source: CollectionSource | null; decks: Deck[]; folders?: SharedFolder[]; error: string; loading: boolean }>({ source: null, decks: [], error: '', loading: false });
  useEffect(() => {
    const controller = new AbortController();
    const hit = route.source && (cachedShelf(shelfId(route.source)) || callbacks.current.lookup?.(shelfId(route.source)));
    if (hit) {
      cacheShelf(hit);
      setResult({ ...hit, error: '', loading: false });
      callbacks.current.onLoad?.(hit);
      return;
    }
    setResult({ source: null, decks: [], error: route.error, loading: !!route.source });
    if (!route.source) return;
    const requested = route.source;
    async function read(path: string) {
      const response = await fetch(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'This public collection is unavailable.');
      return data;
    }
    void (async () => {
      try {
        const { source, folders } = shelfFromFolders(requested, await read(`/api/source-folders?${new URLSearchParams({ ...requested, formats: 'all' })}`));
        const decks: Deck[] = [];
        // Bound requests rather than starting up to 1,000 fetches at once.
        for (let i = 0; i < source.entries.length; i += 4) {
          const batch = await Promise.all(source.entries.slice(i, i + 4).map(async entry => {
            const deck = await read(`/api/decks/${entry.id}`);
            if (!validateDeck(deck) || deck.id !== entry.id) throw new Error('A deck in this collection is unavailable or private.');
            return deck;
          }));
          decks.push(...batch);
        }
        if (controller.signal.aborted) return;
        cacheShelf({ source, decks, folders });
        setResult({ source, decks, folders, error: '', loading: false });
        callbacks.current.onLoad?.({ source, decks, folders });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ source: null, decks: [], error: error instanceof Error ? error.message : 'This public collection is unavailable.', loading: false });
      }
    })();
    return () => controller.abort();
  }, [route]);
  return result;
}
