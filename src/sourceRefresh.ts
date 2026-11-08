import { useEffect, useRef, useState } from 'react';
import { parseCollection, validateDeck, validateSource, type Collection, type CollectionSource, type Deck } from './domain.ts';
import { apiJson } from './api.ts';
import { refreshSourceMembership, sourceDue, sourceMembership, sourceRefreshFailure } from './collection.ts';

const read = (path: string, signal: AbortSignal) => apiJson(path, { signal, fallback: 'Could not check Archidekt.' });

export type RefresherOptions = {
  collection: () => Collection;
  update: (update: (c: Collection) => Collection) => void;
  /** The key being checked, or '' when idle. */
  checking: (key: string) => void;
  /** Follow is on, storage is writable and the browser is online. */
  allowed: () => boolean;
  visible: () => boolean;
  read?: (path: string, signal: AbortSignal) => Promise<any>;
  pause?: (ms: number) => Promise<void>;
};

// One check at a time. `invalidate` drops whatever is in flight: restores, mode changes
// and the hook's cleanup all use it, so a dropped check can never leave the queue busy.
// `prototype=1` asks the server for its cached listing.
export function sourceRefresher(options: RefresherOptions) {
  const { collection, update, checking, allowed, visible, read: request = read, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = options;
  let generation = 0;
  let running = false;
  let abort: AbortController | null = null;
  function invalidate() {
    generation++;
    abort?.abort();
    running = false;
    checking('');
  }
  async function refresh(key: string, manual = false) {
    const source = collection().sources?.find(s => s.key === key);
    if (!source || running || !allowed() || Date.now() < Date.parse(source.refresh?.retryAt || '1970-01-01')) return;
    const epoch = generation;
    running = true;
    checking(key);
    const controller = new AbortController();
    abort = controller;
    const current = () => !controller.signal.aborted && epoch === generation;
    try {
      const found: CollectionSource = await request(`/api/sources?${new URLSearchParams({ kind: source.kind, value: source.value, prototype: '1', ...(manual ? { refresh: '1' } : {}), formats: source.formatScope || 'commander' })}`, controller.signal);
      if (!validateSource(found) || found.key !== key) throw new Error('Incomplete source listing. Saved decks are unchanged.');
      const loaded: Deck[] = [];
      const pending = source.pendingIds || [];
      const ids = sourceMembership(source) === 'follow' ? found.entries
        .filter(e => (!source.knownIds.includes(e.id) || pending.includes(e.id)) && !source.excludedIds?.includes(e.id))
        .filter(e => !collection().added.some(d => d.id === e.id)).slice(0, 10).map(e => e.id) : [];
      for (const id of ids) {
        const deck = await request(`/api/decks/${id}`, controller.signal);
        if (!validateDeck(deck) || deck.id !== id) throw new Error('Incomplete deck snapshot. Saved decks are unchanged.');
        loaded.push(deck);
        await pause(300);
      }
      if (!current()) return;
      const completedAt = Date.now();
      update(c => {
        if (!current()) return c;
        try { return parseCollection(JSON.stringify(refreshSourceMembership(c, found, loaded))); }
        catch (error) { return sourceRefreshFailure(c, key, (error as Error).message, completedAt); }
      });
    } catch (error) {
      if (current()) update(c => current() ? sourceRefreshFailure(c, key, (error as Error).message) : c);
    } finally {
      if (epoch === generation) { running = false; checking(''); }
    }
  }
  /** Checks up to four due sources, oldest first, until the page is hidden or the queue is invalidated. */
  async function revisit() {
    const epoch = generation;
    await Promise.resolve();
    if (running || epoch !== generation) return;
    const due = (collection().sources || []).filter(s => sourceDue(s))
      .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt)).slice(0, 4);
    for (const source of due) {
      if (epoch !== generation || !visible()) break;
      await refresh(source.key);
    }
  }
  return { refresh, revisit, invalidate, get running() { return running; } };
}

// Checks run only while the app is open; there is no background sync.
export function useSourceRefresh(collection: Collection, setCollection: (update: (c: Collection) => Collection) => void, locked: boolean, enabled: boolean) {
  const latest = useRef({ collection, locked, enabled });
  latest.current = { collection, locked, enabled };
  const [checking, setChecking] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const [refresher] = useState(() => sourceRefresher({
    collection: () => latest.current.collection,
    update: setCollection,
    checking: setChecking,
    allowed: () => latest.current.enabled && !latest.current.locked && navigator.onLine,
    visible: () => document.visibilityState !== 'hidden',
  }));
  useEffect(() => {
    const next = Math.min(...(collection.sources || []).map(s => Date.parse(s.refresh?.retryAt || '')).filter(time => time > Date.now()));
    if (!enabled || !Number.isFinite(next)) return;
    const timer = setTimeout(() => setRetryTick(tick => tick + 1), next - Date.now() + 10);
    return () => clearTimeout(timer);
  }, [collection.sources, retryTick, enabled]);
  useEffect(() => {
    if (locked || !enabled) return;
    void refresher.revisit();
    const visible = () => { if (document.visibilityState === 'visible') void refresher.revisit(); };
    document.addEventListener('visibilitychange', visible);
    return () => { refresher.invalidate(); document.removeEventListener('visibilitychange', visible); };
  }, [locked, enabled, refresher]);
  return { checking, refresh: refresher.refresh, invalidate: refresher.invalidate };
}
