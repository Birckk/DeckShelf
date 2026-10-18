import { useEffect, useRef, useState } from 'react';
import { parseCollection, validateDeck, validateSource, type Collection, type CollectionSource, type Deck } from './domain';
import { refreshSourceMembership, sourceDue, sourceMembership, sourceRefreshFailure } from './collection';

async function read(path: string, signal: AbortSignal) {
  const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not check Archidekt.');
  return data;
}

// Foreground prototype only. Restores and mode changes invalidate the whole queue.
export function useSourceRefresh(collection: Collection, setCollection: (update: (c: Collection) => Collection) => void, locked: boolean, enabled: boolean, catalog: Deck[]) {
  const latest = useRef(collection);
  latest.current = collection;
  const generation = useRef(0);
  const running = useRef(false);
  const [checking, setChecking] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const abort = useRef<AbortController | null>(null);
  function invalidate() {
    generation.current++;
    abort.current?.abort();
    running.current = false;
    setChecking('');
  }
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);
  useEffect(() => {
    const next = Math.min(...(collection.sources || []).map(s => Date.parse(s.refresh?.retryAt || '')).filter(time => time > Date.now()));
    if (!enabled || !Number.isFinite(next)) return;
    const timer = setTimeout(() => setRetryTick(tick => tick + 1), next - Date.now() + 10);
    return () => clearTimeout(timer);
  }, [collection.sources, retryTick, enabled]);

  async function refresh(key: string, manual = false) {
    const source = latest.current.sources?.find(s => s.key === key);
    if (!enabled || !source || running.current || locked || !navigator.onLine ||
      Date.now() < Date.parse(source.refresh?.retryAt || '1970-01-01')) return;
    const epoch = generation.current;
    running.current = true;
    setChecking(key);
    const controller = new AbortController();
    abort.current = controller;
    const current = () => !controller.signal.aborted && epoch === generation.current;
    try {
      const found: CollectionSource = await read(`/api/sources?${new URLSearchParams({ kind: source.kind, value: source.value, prototype: '1', ...(manual ? { refresh: '1' } : {}), formats: source.formatScope || 'commander' })}`, controller.signal);
      if (!validateSource(found) || found.key !== key) throw new Error('Incomplete source listing. Saved decks are unchanged.');
      const loaded: Deck[] = [];
      const pending = source.pendingIds || [];
      const ids = sourceMembership(source) === 'follow' ? found.entries
        .filter(e => (!source.knownIds.includes(e.id) || pending.includes(e.id)) && !source.excludedIds?.includes(e.id))
        .filter(e => !latest.current.added.some(d => d.id === e.id)).slice(0, 10).map(e => e.id) : [];
      for (const id of ids) {
        const deck = await read(`/api/decks/${id}`, controller.signal);
        if (!validateDeck(deck) || deck.id !== id) throw new Error('Incomplete deck snapshot. Saved decks are unchanged.');
        loaded.push(deck);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      if (!current()) return;
      const completedAt = Date.now();
      setCollection(c => {
        if (!current()) return c;
        try { return parseCollection(JSON.stringify(refreshSourceMembership(c, found, loaded, catalog))); }
        catch (error) { return sourceRefreshFailure(c, key, (error as Error).message, completedAt); }
      });
    } catch (error) {
      if (current()) setCollection(c => current() ? sourceRefreshFailure(c, key, (error as Error).message) : c);
    } finally {
      if (epoch === generation.current) { running.current = false; setChecking(''); }
    }
  }
  useEffect(() => {
    if (locked || !enabled) return;
    let cancelled = false;
    async function revisit() {
      const epoch = generation.current;
      await Promise.resolve();
      if (cancelled || running.current || epoch !== generation.current) return;
      const due = (latest.current.sources || []).filter(s => sourceDue(s))
        .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt)).slice(0, 4);
      for (const source of due) {
        if (cancelled || epoch !== generation.current || document.visibilityState === 'hidden') break;
        await refresh(source.key);
      }
    }
    void revisit();
    const visible = () => { if (document.visibilityState === 'visible') void revisit(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; generation.current++; abort.current?.abort(); document.removeEventListener('visibilitychange', visible); };
  }, [locked, enabled]);
  return { checking, refresh, invalidate };
}
