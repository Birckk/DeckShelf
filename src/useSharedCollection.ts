import { useEffect, useRef, useState } from 'react';
import type { CollectionSource, Deck } from './domain';
import { parseSharePath } from './share-links';
import { cacheShelf, cachedShelf, shelfFromFolders, shelfId, type LoadedShelf } from './shelves';
import { listingDeck, type SharedFolder } from './collection';
import { DeckLoadError, fillDecks, loadFullDeck } from './deckFill';

export function readSharedLocation() {
  try { return { source: parseSharePath(location.pathname, location.search), error: '' }; }
  catch { return { source: null, error: 'This collection link is invalid or uses an unsupported format or selection.' }; }
}

type SharedResult = {
  source: CollectionSource | null; decks: Deck[]; folders?: SharedFolder[]; error: string; loading: boolean;
  // Decks still showing listing data while their details load, and decks that could not load.
  filling: number; failed: number;
};

// A shelf already loaded in this tab (or a kept snapshot from `lookup`) opens at once.
// Otherwise the folder listing opens it, with each deck's listing name, art and colours,
// and full details fill in behind it as they arrive.
export function useSharedCollection(route: ReturnType<typeof readSharedLocation>, { lookup, onLoad }: {
  lookup?: (id: string) => LoadedShelf | undefined; onLoad?: (shelf: LoadedShelf) => void;
} = {}) {
  const callbacks = useRef({ lookup, onLoad });
  callbacks.current = { lookup, onLoad };
  // A link starts out loading, so the first paint never says the shelf is empty.
  const [result, setResult] = useState<SharedResult>({ source: null, decks: [], error: route.error, loading: !!route.source, filling: 0, failed: 0 });
  useEffect(() => {
    const controller = new AbortController();
    const hit = route.source && (cachedShelf(shelfId(route.source)) || callbacks.current.lookup?.(shelfId(route.source)));
    if (hit) {
      cacheShelf(hit);
      setResult({ ...hit, error: '', loading: false, filling: 0, failed: 0 });
      callbacks.current.onLoad?.(hit);
      return;
    }
    setResult({ source: null, decks: [], error: route.error, loading: !!route.source, filling: 0, failed: 0 });
    if (!route.source) return;
    const requested = route.source;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const response = await fetch(`/api/source-folders?${new URLSearchParams({ ...requested, formats: 'all' })}`,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
        // A proxy's or static host's own error page is not JSON and has no message for people.
        const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
        if (!response.ok || !data) throw new Error(data?.error || 'This public collection is unavailable.');
        const { source, folders } = shelfFromFolders(requested, data);
        if (controller.signal.aborted) return;
        const decks = new Map(source.entries.map(entry => [entry.id, listingDeck(entry)]));
        const lost = new Set<string>();
        let passing = false;
        const show = () => {
          flushTimer = undefined;
          if (controller.signal.aborted) return;
          const list = [...decks.values()];
          setResult({ source, decks: list, folders, error: '', loading: false,
            filling: list.filter(deck => deck.partial).length, failed: lost.size });
        };
        // Arriving details are shown a few at a time, not one render per deck.
        const showSoon = () => { flushTimer ??= setTimeout(show, 150); };
        show();
        callbacks.current.onLoad?.({ source, decks: [...decks.values()], folders });
        await fillDecks(source.entries.map(entry => entry.id), loadFullDeck, {
          signal: controller.signal,
          onDeck: deck => { decks.set(deck.id, deck); showSoon(); },
          // A deck that cannot load leaves the shelf; the bar says how many.
          onError: (id, error) => {
            decks.delete(id); lost.add(id);
            if (!(error instanceof DeckLoadError) || error.retry) passing = true;
            showSoon();
          },
        });
        if (controller.signal.aborted) return;
        clearTimeout(flushTimer);
        if (lost.size && !decks.size) throw new Error('The decks in this collection are unavailable or private.');
        show();
        // A shelf that lost decks to a passing failure loads again on the next visit.
        if (!passing) cacheShelf({ source, decks: [...decks.values()], folders });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ source: null, decks: [], error: error instanceof Error ? error.message : 'This public collection is unavailable.', loading: false, filling: 0, failed: 0 });
      }
    })();
    return () => { controller.abort(); clearTimeout(flushTimer); };
  }, [route]);
  return result;
}
