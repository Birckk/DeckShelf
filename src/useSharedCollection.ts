import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollectionSource, Deck } from './domain';
import { parseSharePath, type SharedSource } from './share-links';
import { cacheShelf, cachedShelf, shelfFromFolders, shelfId, type LoadedShelf } from './shelves';
import { listingDeck, mergeSnapshot, type SharedFolder } from './collection';
import { DeckLoadError, fillDecks, loadFullDeck } from './deckFill';
import { apiJson } from './api';
import { fetchAllDecks } from './fetchMode';

export function readSharedLocation() {
  try { return { source: parseSharePath(location.pathname, location.search), error: '' }; }
  catch { return { source: null, error: 'This collection link is invalid or uses an unsupported format or selection.' }; }
}

type SharedResult = {
  source: CollectionSource | null; decks: Deck[]; folders?: SharedFolder[]; error: string; loading: boolean;
  // Decks still showing listing data while their details load, and decks that could not load.
  filling: number; failed: number;
};

// A shelf's public listing, with each deck as its listing name, art and colours.
export async function fetchShelfListing(requested: SharedSource, signal: AbortSignal) {
  const data = await apiJson(`/api/source-folders?${new URLSearchParams({ ...requested, formats: 'all' })}`,
    { signal, fallback: 'This public collection is unavailable.' });
  return shelfFromFolders(requested, data);
}

// A shelf already loaded in this tab (or a kept snapshot from `lookup`) opens at once.
// Otherwise the folder listing opens it, with each deck's listing name, art, colours and tags.
// On the website that is the whole shelf: a deck's full details load when it is opened
// (`upgrade`). The Windows app fills every deck's details in behind it (src/fetchMode.ts).
export function useSharedCollection(route: ReturnType<typeof readSharedLocation>, { lookup, onLoad, fetchAll = fetchAllDecks }: {
  lookup?: (id: string) => LoadedShelf | undefined; onLoad?: (shelf: LoadedShelf) => void; fetchAll?: boolean;
} = {}) {
  const callbacks = useRef({ lookup, onLoad });
  callbacks.current = { lookup, onLoad };
  // A link starts out loading, so the first paint never says the shelf is empty.
  // Each result remembers the address it belongs to. On the first render after the address changes
  // the effect hasn't run yet, so the new shelf's starting state is worked out here instead of
  // showing the previous shelf, or an empty one, for a frame.
  const [state, setState] = useState(() => ({ route, result: startOf(route, callbacks.current.lookup, fetchAll) }));
  const setResult = (result: SharedResult) => setState({ route, result });
  useEffect(() => {
    const controller = new AbortController();
    const start = startOf(route, callbacks.current.lookup, fetchAll);
    setResult(start);
    if (start.source) {
      cacheShelf({ source: start.source, decks: start.decks, folders: start.folders });
      callbacks.current.onLoad?.({ source: start.source, decks: start.decks, folders: start.folders });
      return;
    }
    if (!route.source) return;
    const requested = route.source;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const { source, folders } = await fetchShelfListing(requested, controller.signal);
        if (controller.signal.aborted) return;
        const decks = new Map(source.entries.map(entry => [entry.id, listingDeck(entry)]));
        const lost = new Set<string>();
        let passing = false;
        const show = () => {
          flushTimer = undefined;
          if (controller.signal.aborted) return;
          const list = [...decks.values()];
          setResult({ source, decks: list, folders, error: '', loading: false,
            filling: fetchAll ? list.filter(deck => deck.partial).length : 0, failed: lost.size });
        };
        // Arriving details are shown a few at a time, not one render per deck.
        const showSoon = () => { flushTimer ??= setTimeout(show, 150); };
        show();
        callbacks.current.onLoad?.({ source, decks: [...decks.values()], folders });
        if (!fetchAll) { cacheShelf({ source, decks: [...decks.values()], folders }); return; }
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
  }, [route, fetchAll]);
  const result = state.route === route ? state.result : startOf(route, lookup, fetchAll);
  // A deck opened on the website brings its full details into the shelf, for this tab.
  // Only a deck still on listing data changes, so a newer copy is never replaced.
  const upgrade = useCallback((deck: Deck) => setState(current => {
    const { source, decks, folders } = current.result;
    if (!source || !decks.some(item => item.id === deck.id && item.partial)) return current;
    const next = decks.map(item => item.id === deck.id ? mergeSnapshot(item, deck) : item);
    cacheShelf({ source, decks: next, folders });
    return { ...current, result: { ...current.result, decks: next } };
  }), []);
  return { ...result, upgrade };
}

// A shelf already loaded in this tab, or a kept snapshot, opens at once; anything else starts loading.
// On the website a listing is a complete shelf. In the Windows app a bookmark made before its
// details finished loads again until it has them.
function startOf(route: ReturnType<typeof readSharedLocation>, lookup: ((id: string) => LoadedShelf | undefined) | undefined, fetchAll: boolean): SharedResult {
  const hit = route.source && (cachedShelf(shelfId(route.source)) || lookup?.(shelfId(route.source)));
  if (hit && (!fetchAll || !hit.decks.some(deck => deck.partial))) return { ...hit, error: '', loading: false, filling: 0, failed: 0 };
  return { source: null, decks: [], error: route.error, loading: !!route.source, filling: 0, failed: 0 };
}
