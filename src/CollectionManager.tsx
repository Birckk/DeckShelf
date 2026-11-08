import { coverOf, formatOf } from './domain';
import CollectionMenu, { type MenuItem } from './CollectionMenu';
import CollectionDeckTile, { DeckLink, ShownCheckbox } from "./CollectionDeckTile";
import { DeckTable, tableDeck, tableEntry } from "./DeckTable";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Power,
  PowerOff,
  Focus,
  Eye,
  EyeOff,
  FolderTree,
  Trash2,
  Check,
  Download,
  ExternalLink,
  Library,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Upload,
  X,
} from "lucide-react";

import {
  parseCollection,
  validateDeck,
  validateSource,
  type Collection,
  type CollectionSource,
  type Deck,
  type SourceEntry,
} from "./domain";
import { clearResults, type Notify } from "./Notices";
import { parseShelfInput, type SharedSource } from "./share-links";
import {
  parseSourceInput,
  sourceMembership,
  rememberSource,
  collectionDecks,
  saveSnapshots,
  setShown,
  setDeckSelection,
  setSourceSelection,
  setPendingSourceSelection,
  showcaseGroups,
  deckCollections,
  showcaseDecks,
  hideGroups,
  isHidden,
  switchOn,
  groupActive,
  enableGroup,
  enableGroups,
  onlyGroup,
  sourceDeckIds,
  removeSources,
  removeStarter,
  addDemo,
  updateDemo,
  importFolderSelection,
  listingDeck,
} from "./collection";
import precons from "./data/precons.json";
import CollectionNavigator from "./CollectionNavigator";
import CollectionViewControls, { collectionPhoneColumns, collectionTileSize, sortCollectionDecks, useCollectionDisplay } from "./CollectionViewControls";
import "./collection-workspace.css";
import CollectionOverview from "./CollectionOverview";
import SourceSetup, { type FolderDiscovery } from "./SourceSetup";
import FormatSelect from './FormatSelect';
import "./collection.css";

type Props = {
  sourceRefresh: { checking: string; refresh: (key: string, manual?: boolean) => Promise<void> };
  followEnabled: boolean;
  decks: Deck[];
  catalog: Deck[];
  collection: Collection;
  setCollection: (update: Collection | ((c: Collection) => Collection)) => void;
  onClose: () => void;
  backup: () => void;
  notify: Notify;
  undoTo: (before: Collection, after: Collection) => () => void;
  onShare: () => void;
  overviewExtra?: ReactNode;
  onBrowse?: (source: SharedSource) => void;
  /** A shared shelf shown read-only: its folders and decks, with the shelf's own actions. */
  readOnly?: { name: string; actions: ReactNode };
  startPersonal?: boolean;
  initialSection?: string;
  initialScope?: { name: string; keys: string[] } | null;
  onLocationChange: (section: string, scope: { name: string; keys: string[] } | null) => void;
  onRestore: (collection: Collection) => void;
};
async function jsonRequest(path: string, signal: AbortSignal) {
  if (!navigator.onLine)
    throw new Error("You're offline. Connect to the internet to read Archidekt.");
  const response = await fetch(path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Connecting sources needs the local app server. Start the app with npm start or npm run dev.",
    );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not read the source.");
  return data;
}
async function loadSource(
  kind: string,
  value: string,
  signal: AbortSignal,
  formatScope = 'commander',
): Promise<CollectionSource> {
  const data = await jsonRequest(
    `/api/sources?${new URLSearchParams({ kind, value, formats: formatScope })}`,
    signal,
  );
  if (!validateSource(data))
    throw new Error("The source returned incomplete collection information.");
  return data;
}
async function loadDeck(
  id: string,
  signal: AbortSignal,
  refresh = false,
): Promise<Deck> {
  const data = await jsonRequest(
    `/api/decks/${id}${refresh ? "?refresh=1" : ""}`,
    signal,
  );
  if (!validateDeck(data) || data.id !== id)
    throw new Error("The source returned incomplete deck information.");
  return data;
}
async function loadFolders(kind: string, value: string, signal: AbortSignal, formatScope: 'commander' | 'all'): Promise<FolderDiscovery> {
  const found = await jsonRequest(`/api/source-folders?${new URLSearchParams({ kind, value, formats: formatScope })}`, signal);
  if (typeof found.name !== 'string' || !Array.isArray(found.folders) || found.folders.length > 80 ||
    !found.folders.every((f: FolderDiscovery['folders'][number]) => f && validateSource(f.source) && typeof f.path === 'string' && typeof f.root === 'boolean'))
    throw new Error('The source returned incomplete folder information.');
  return found;
}

export default function CollectionManager({
  sourceRefresh,
  followEnabled,
  decks,
  catalog,
  collection,
  setCollection,
  onClose,
  backup,
  notify,
  onShare,
  overviewExtra,
  onBrowse,
  readOnly,
  undoTo,
  startPersonal = false,
  initialSection = "overview",
  initialScope = null,
  onLocationChange,
  onRestore,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [display, setDisplay] = useCollectionDisplay("commander-archive.manager-display.v1", "grid");
  const { layout, size } = display;
  const [sort, setSort] = useState("collection");
  const [scope, setScope] = useState<{ name: string; keys: string[] } | null>(initialScope);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  const [section, setSection] = useState(initialSection);
  useEffect(() => { onLocationChange(section, scope); }, [section, scope]);
  const [connecting, setConnecting] = useState(startPersonal);
  const [discovery, setDiscovery] = useState<FolderDiscovery | null>(null);
  const [discoveryScope, setDiscoveryScope] = useState<'commander' | 'all'>('commander');
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [formatScope, setFormatScope] = useState('commander');
  const [browseFormat, setBrowseFormat] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [restorePreview, setRestorePreview] = useState<Collection | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const restoreRequest = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const restoreRegion = useRef<HTMLDivElement>(null);
  const failuresRegion = useRef<HTMLDetailsElement>(null);
  // The confirmation opens below the footer; on phones that is off-screen.
  useEffect(() => {
    restoreRegion.current?.scrollIntoView({ block: "nearest" });
    restoreRegion.current?.focus({ preventScroll: true });
  }, [restorePreview]);
  useEffect(() => {
    if (restoreError) restoreRegion.current?.scrollIntoView({ block: "nearest" });
  }, [restoreError]);
  const controller = useRef<AbortController | null>(null);
  const importedFolderKeys = useRef(new Set<string>());
  useEffect(() => () => controller.current?.abort(), []);
  const sources = collection.sources || [];
  const source = sources.find((s) => s.key === section);
  const newDeckCount = source ? sourceMembership(source) === 'selected'
    ? (source.pendingIds || []).filter(id => !(source.ownedIds || source.selectedIds || []).includes(id)).length
    : source.lastChange?.added.length || 0 : 0;
  const scopedSources = scope ? sources.filter(s => scope.keys.includes(s.key)) : source ? [source] : [];
  const scopedKeys = scopedSources.map(s => s.key);
  const saved = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);
  const groups = showcaseGroups(collection, catalog, decks);
  const collectionNames = deckCollections(groups);
  const activeGroup = groups.find((g) => g.key === section);
  const onDisplayIds = new Set(
    showcaseDecks(collection, catalog, decks).map((d) => d.id),
  );
  const onDisplay = onDisplayIds.size;
  const manual = decks.filter((d) =>
    groups.find((g) => g.key === "manual")!.ids.includes(d.id),
  );
  const enabledScopeIds = new Set(scopedSources.filter(s => groupActive(collection, s.key)).flatMap(s => sourceDeckIds(s, decks)));
  const displayedHere = (id: string) => onDisplayIds.has(id) && (scopedSources.length ? enabledScopeIds.has(id) : !activeGroup || activeGroup.enabled);
  const sourceIds = new Set(scopedSources.flatMap(s => sourceDeckIds(s, decks)));
  const isSavedHere = (id: string) =>
    saved.has(id) && (!scopedSources.length || scopedSources.some(s => s.knownIds.includes(id)));
  const rows: SourceEntry[] = scopedSources.length
    ? [...new Map([
        ...scopedSources.flatMap(s => s.entries),
        ...decks
          .filter(
            (d) =>
              scopedSources.some(s => s.knownIds.includes(d.id)) && !scopedSources.some(s => s.entries.some((e) => e.id === d.id)),
          )
          .map(toEntry),
      ].map(row => [row.id, row])).values()]
    : (section === "starter"
        ? catalog.map((d) => saved.get(d.id) || d)
        : section === "demo"
          ? collection.demo?.decks || []
        : section === "manual"
          ? manual
          : decks
      ).map(toEntry);
  const shown = sortCollectionDecks(sort, rows.filter((row) => {
    const deck = saved.get(row.id);
    const text = [row.name, ...(deck?.commanders.map((c) => c.name) || [])]
      .join(" ")
      .toLowerCase();
    const display = isSavedHere(row.id) && (!scopedSources.length || sourceIds.has(row.id)) && displayedHere(row.id);
  return (
      text.includes(search.toLowerCase()) &&
      (browseFormat === 'all' || formatOf(deck || row).id === browseFormat) &&
      (status === "all" ||
        (status === "shown" && display) ||
        (status === "hidden" && isSavedHere(row.id) && !display) ||
        (status === "new" && !isSavedHere(row.id)))
    );
  }), row => ({ ...(saved.get(row.id) || row), collections: collectionNames.get(row.id) }));
  const rowChecked = (id: string) => isSavedHere(id)
    ? !collection.hidden.includes(id) && (!scopedSources.length || sourceIds.has(id))
    : selected.includes(id);
  const checkedCount = shown.filter(row => rowChecked(row.id)).length;
  const allChecked = !!shown.length && checkedCount === shown.length;
  const selectAllBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllBox.current) selectAllBox.current.indeterminate = checkedCount > 0 && !allChecked;
  });
  function selectAll(select: boolean) {
    if (scopedSources.length) {
      const ids = shown.filter(row => isSavedHere(row.id)).map(row => row.id);
      const pending = shown.filter(row => !isSavedHere(row.id)).map(row => row.id);
      setCollection(c => {
        const next = setSourceSelection(c, scopedKeys, ids, select, decks);
        return followEnabled ? setPendingSourceSelection(next, scopedKeys, pending, select) : next;
      });
      setSelected(current => select ? [...new Set([...current, ...pending])] : current.filter(id => !pending.includes(id)));
      return;
    }
    const next = setDeckSelection(
      collection,
      selected,
      shown.map((row) => ({ id: row.id, saved: isSavedHere(row.id) })),
      select,
    );
    setCollection(next.collection);
    setSelected(next.pending);
  }
  function navigate(next: string) {
    setDiscovery(null);
    setScope(null);
    setMobileNav(false);
    setSection(next);
    setSearch("");
    setStatus("all");
    setSelected([]);
    setError("");
    setFailures([]);
    setConnecting(false);
  }
  function begin(message: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(message);
    setError("");
    setFailures([]);
    return c.signal;
  }
  // Errors from the Add decks form stay beside it; the rest can finish far from
  // where they started, so they become notices that stay until dismissed.
  function report(error: unknown, inline = false) {
    if ((error as Error).name === "AbortError") return;
    const message = (error as Error).message === "Failed to fetch"
      ? "Could not reach Archidekt. Your saved decks are still available."
      : (error as Error).message;
    if (inline) setError(message);
    else notify(message, { tone: "problem" });
  }
  // The failures list below keeps the detail; the notice points to it.
  function finish(message: string, errors: string[]) {
    setFailures(errors);
    if (!errors.length) return notify(message);
    notify(`${message} ${errors.length} ${errors.length === 1 ? "deck" : "decks"} could not be loaded.`, {
      tone: "problem",
      action: { label: "Show", run: () => { failuresRegion.current?.scrollIntoView({ block: "nearest" }); failuresRegion.current?.querySelector("summary")?.focus(); } },
    });
  }
  // Adding never switches a collection on by itself unless Settings says so (#94).
  // Otherwise the notice says it is off and offers Turn on.
  const turnsOn = !!collection.addTurnsOn;
  function notifyAdded(message: string, off: boolean, key: string, errors: string[] = []) {
    if (!off) return finish(`${message}.`, errors);
    if (turnsOn || errors.length) return finish(`${message}, ${turnsOn ? "now switched on" : "which is off"}.`, errors);
    notify(`${message}, which is off.`, { action: { label: "Turn on", run: () => setCollection(c => switchOn(c, key)) } });
  }
  function commitAsync(update: (c: Collection) => Collection, signal: AbortSignal) {
    setCollection(c => {
      if (signal.aborted) return c;
      try { return parseCollection(JSON.stringify(update(c))); }
      catch (error) { queueMicrotask(() => { if (!signal.aborted) report(error); }); return c; }
    });
  }
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const signal = begin("Finding decks…");
    try {
      const parsed = parseSourceInput(value);
      if (parsed.kind === "deck") {
        if (
          collection.added.length >= 1000 &&
          !collection.added.some((d) => d.id === parsed.value)
        )
          throw new Error(
            "A local collection can hold up to 1,000 imported decks.",
          );
        const deck = await loadDeck(parsed.value, signal);
        signal.throwIfAborted();
        const off = groups.find(g => g.key === "manual")?.enabled === false;
        commitAsync(c => {
          const next = { ...saveSnapshots(c, [deck], true), manualIds: [...new Set([...(c.manualIds || []), deck.id])] };
          return off && turnsOn ? switchOn(next, "manual") : next;
        }, signal);
        navigate("manual");
        notifyAdded(`${deck.name} added to Individual decks`, off, "manual");
      } else {
        // Discovery starts with Commander; the folder step fetches the rest when widened.
        const found = await loadFolders(parsed.kind, parsed.value, signal, 'commander');
        signal.throwIfAborted();
        setDiscovery(found);
        setDiscoveryScope('commander');
        setFormatScope('commander');
        setSelected([]);
        importedFolderKeys.current.clear();
      }
    } catch (e) {
      report(e, true);
    } finally {
      setBusy("");
    }
  }
  async function changeFormatScope(format: string) {
    if (!discovery || format === 'commander' || discoveryScope === 'all') {
      setFormatScope(format);
      return;
    }
    const signal = begin('Finding decks…');
    try {
      const parsed = parseSourceInput(value);
      const found = await loadFolders(parsed.kind, parsed.value, signal, 'all');
      signal.throwIfAborted();
      setDiscovery(found);
      setDiscoveryScope('all');
      setFormatScope(format);
    } catch (e) { report(e, true); }
    finally { setBusy(''); }
  }
  function resetSourceForm() {
    setDiscovery(null);
    setDiscoveryScope('commander');
    setFormatScope('commander');
    setSelected([]);
    setError('');
    setFailures([]);
  }
  async function addFolders(onlyFolders: boolean) {
    if (!discovery) return;
    const signal = begin('Adding selected decks…');
    try {
      const parsed = parseSourceInput(value);
      const allFormats = formatScope !== 'commander' || discovery.folders.some(f => f.source.entries.some(e => selected.includes(e.id) && formatOf(e).id !== 'commander'));
      const chosen = discovery.folders.map(f => {
        const entries = f.source.entries.filter(e => allFormats || formatOf(e).id === 'commander');
        return { ...f.source, membership: entries.every(e => selected.includes(e.id)) ? "follow" as const : "selected" as const, entries, knownIds: entries.map(e => e.id), formatScope: allFormats ? 'all' as const : 'commander' as const, folderPath: f.path, connectionKey: parsed.key, connectionName: discovery.name };
      }).filter(s => s.entries.some(e => selected.includes(e.id)));
      if (new Set([...sources.map(s => s.key), ...chosen.map(s => s.key)]).size > 50)
        throw new Error('Choose fewer folders. A collection can link up to 50 sources.');
      if (collection.added.length + selected.filter(id => !collection.added.some(d => d.id === id)).length > 1000)
        throw new Error('A local collection can hold up to 1,000 imported decks. Choose fewer decks.');
      // New decks join from the listing at once; App fills in their details in the background.
      const listed = new Map(discovery.folders.flatMap(f => f.source.entries).map(e => [e.id, e]));
      const accepted = selected.flatMap(id => saved.get(id) || (listed.has(id) ? [listingDeck(listed.get(id)!)] : []));
      // Merge into the latest state: a background check may have saved since this render.
      const importedKeys = new Set(importedFolderKeys.current);
      commitAsync(c => importFolderSelection(c, chosen, accepted, collectionDecks(c, catalog),
        onlyFolders ? showcaseGroups(c, catalog, collectionDecks(c, catalog)).map(g => g.key).filter(key => !importedKeys.has(key)) : [], selected, catalog), signal);
      chosen.filter(s => s.entries.some(e => accepted.some(d => d.id === e.id))).forEach(s => importedFolderKeys.current.add(s.key));
      finish(`${accepted.length} ${accepted.length === 1 ? 'deck' : 'decks'} added to your collection.`, []);
      navigate("overview");
    } catch (e) { report(e); }
    finally { setBusy(''); }
  }
  async function fetchDecks(
    ids: string[],
    signal: AbortSignal,
    refresh: boolean,
  ) {
    const loaded: Deck[] = [];
    const errors: string[] = [];
    for (let index = 0; index < ids.length; index += 2) {
      signal.throwIfAborted();
      setBusy(
        `${refresh ? "Refreshing" : "Adding"} decks ${index + 1}–${Math.min(index + 2, ids.length)} of ${ids.length}…`,
      );
      await Promise.all(
        ids.slice(index, index + 2).map(async (id) => {
          try {
            loaded.push(await loadDeck(id, signal, refresh));
          } catch (e) {
            if (signal.aborted) throw e;
            errors.push(
              `${saved.get(id)?.name || discovery?.folders.flatMap(f => f.source.entries).find(e => e.id === id)?.name || rows.find((r) => r.id === id)?.name || id}: ${(e as Error).message}`,
            );
          }
        }),
      );
    }
    signal.throwIfAborted();
    return {
      loaded: loaded.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)),
      errors,
    };
  }
  async function addSelected() {
    const signal = begin("Adding selected decks…");
    try {
      if (
        collection.added.length +
          selected.filter((id) => !saved.has(id)).length >
        1000
      )
        throw new Error(
          "A local collection can hold up to 1,000 imported decks. Choose fewer decks.",
        );
      // Source listings add at once; other sections still load the full deck first.
      const listed = new Map(scopedSources.flatMap(s => s.entries).map(e => [e.id, e]));
      const fresh = selected.filter((id) => !saved.has(id));
      const { loaded, errors } = await fetchDecks(
        fresh.filter((id) => !listed.has(id)),
        signal,
        false,
      );
      const accepted = [
        ...fresh.filter((id) => listed.has(id)).map((id) => listingDeck(listed.get(id)!)),
        ...loaded,
        ...selected.filter((id) => saved.has(id)).map((id) => saved.get(id)!),
      ];
      const offGroup = accepted.length && activeGroup?.enabled === false ? activeGroup : undefined;
      commitAsync(c => {
        let next = saveSnapshots(c, accepted, true);
        if (scopedSources.length) next = setSourceSelection(next, scopedKeys, accepted.map(d => d.id), true, collectionDecks(next, catalog));
        return offGroup && turnsOn ? switchOn(next, offGroup.key) : next;
      }, signal);
      setSelected((ids) =>
        ids.filter((id) => !accepted.some((d) => d.id === id)),
      );
      notifyAdded(`${accepted.length} ${accepted.length === 1 ? "deck" : "decks"} selected${offGroup ? ` in ${offGroup.name}` : ""}`, !!offGroup, offGroup?.key || "", errors);
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  async function refreshSource() {
    if (!source) return;
    if (followEnabled) {
      // Update saved decks as Refresh always has, without touching the listing,
      // then let the check add new decks and record what changed.
      const signal = begin('Updating saved decks\u2026');
      try {
        const { loaded, errors } = await fetchDecks(source.entries.filter(e => sourceIds.has(e.id)).map(e => e.id), signal, true);
        commitAsync(c => c.sources?.some(s => s.key === source.key) ? saveSnapshots(c, loaded) : c, signal);
        finish(`Checked. ${loaded.length} saved ${loaded.length === 1 ? 'deck' : 'decks'} updated.`, errors);
      } catch (error) { report(error); }
      finally { if (controller.current?.signal === signal) setBusy(''); }
      if (signal.aborted) return;
      await sourceRefresh.refresh(source.key, true);
      return;
    }
    const signal = begin('Checking source\u2026');
    try {
      const found = await loadSource(source.kind, source.value, signal, source.formatScope || 'commander');
      const { loaded, errors } = await fetchDecks(
        found.entries.filter((e) => sourceIds.has(e.id)).map((e) => e.id),
        signal,
        true,
      );
      commitAsync(c => c.sources?.some(s => s.key === source.key) ? saveSnapshots(rememberSource(c, found), loaded) : c, signal);
      setSelected([]);
      finish(
        `Source checked. ${loaded.length} saved decks refreshed; new decks are ready to review.`,
        errors,
      );
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const request = ++restoreRequest.current;
    setRestorePreview(null);
    setRestoreError("");
    event.target.value = "";
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose a backup smaller than 5 MB.");
      const parsed = parseCollection(await file.text());
      if (request !== restoreRequest.current) return;
      setRestorePreview(parsed);
      // A recent export notice can cover the confirmation actions on a phone.
      clearResults();
      setError("");
    } catch (e) {
      if (request === restoreRequest.current) report(e);
    }
  }
  function hide(keys: string[]) {
    setCollection(c => hideGroups(c, keys, true));
  }
  // Remove acts at once and offers Undo instead of asking first (#57).
  function remove(keys: string[], name: string, count: number) {
    const after = keys.includes("starter") ? removeStarter(collection) : removeSources(collection, keys, catalog);
    setCollection(after);
    navigate("overview");
    notify(`Removed ${name}${count ? ` and its ${count} saved ${count === 1 ? "deck" : "decks"}` : ""}.`, { action: { label: "Undo", run: undoTo(collection, after) } });
  }
  async function updatePrecons() {
    const signal = begin("Checking Archidekt for new precons…");
    try {
      const found = await loadSource("account", "Archidekt_Precons", signal);
      const known = new Set(collection.demo?.decks.map(d => d.id) || []);
      const { loaded, errors } = await fetchDecks(found.entries.map(e => e.id).filter(id => !known.has(id)), signal, false);
      commitAsync(c => updateDemo(c, loaded, found.checkedAt), signal);
      finish(loaded.length ? `${loaded.length} new ${loaded.length === 1 ? "precon" : "precons"} added.` : "Precons are up to date.", errors);
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  function addPrecons() {
    setCollection(c => addDemo(c, precons as { snapshotAt: string; decks: Deck[] }));
    navigate("demo");
  }
  const headerKeys = scope ? scopedKeys : activeGroup || section === "demo" ? [section] : [];
  const headerName = scope?.name || activeGroup?.name || "Official Commander precons";
  const headerHidden = headerKeys.length > 0 && headerKeys.every(key => isHidden(collection, key));
  const scopePartial = scopedKeys.some(key => groupActive(collection, key)) && scopedKeys.some(key => !groupActive(collection, key));
  const menuItems: MenuItem[] = [
    ...(scope && !headerHidden ? [
      { label: "All folders on", icon: <Power size={14} />, run: () => setCollection(c => enableGroups(c, scopedKeys, true, true)) },
      { label: "All folders off", icon: <PowerOff size={14} />, run: () => setCollection(c => enableGroups(c, scopedKeys, false, true)) },
    ] : []),
    ...(!headerHidden && headerKeys.length ? [{ label: section === "demo" ? "Hide precons" : "Hide", icon: <EyeOff size={14} />, run: () => hide(headerKeys) }] : []),
    ...(scopedSources.length && !readOnly ? [{ label: "Remove", icon: <Trash2 size={14} />, run: () => remove(scopedKeys, headerName, sourceIds.size) }] : []),
    ...(section === "starter" ? [{ label: "Remove", icon: <Trash2 size={14} />, run: () => remove(["starter"], headerName, 0) }] : []),
  ];
  const deckRows = shown.map((row) => {
    const deck = saved.get(row.id);
    const member = isSavedHere(row.id);
    const checked = rowChecked(row.id);
    const missing =
      !!source &&
      !!deck &&
      !source.entries.some((e) => e.id === row.id);
    const toggle = (on: boolean) => {
      if (member) return setCollection(c => scopedSources.length ? setSourceSelection(c, scopedKeys, [row.id], on, decks) : setShown(c, [row.id], on));
      // A deck still waiting to download keeps its choice across the next check.
      if (followEnabled) setCollection(c => setPendingSourceSelection(c, scopedKeys, [row.id], on));
      setSelected(ids => on ? [...new Set([...ids, row.id])] : ids.filter(id => id !== row.id));
    };
    const status = missing ? 'No longer listed · saved copy kept' : !member ? 'Not added' : !displayedHere(row.id) && checked ? (headerHidden ? 'Hidden · selection kept' : 'Collection off · selection kept') : '';
    return { row, deck, member, checked, toggle, status, busy: !!busy, selectable: true };
  });
  const deckViews = layout === "list" && deckRows.length
    ? <DeckTable label="Decks in this collection" sort={sort} onSort={setSort} size={size} lead="Shown" trail="Archidekt"
        rows={deckRows.map(item => ({
          deck: item.deck ? tableDeck(item.deck, collectionNames.get(item.row.id)) : tableEntry(item.row),
          className: `workspace-tile ${item.checked ? "" : "is-hidden"}`,
          onActivate: () => { if (!busy) item.toggle(!item.checked); },
          title: <h4>{item.deck?.name || item.row.name}</h4>,
          note: item.status || undefined,
          lead: <ShownCheckbox {...item} />,
          trail: <span className="workspace-tile-controls"><DeckLink {...item} /></span>,
        }))} />
    : deckRows.map(item => <CollectionDeckTile key={item.row.id} layout={layout} {...item} />);
  const backTarget = readOnly ? readOnly.name : "collection";
  return (
    <main className={`collection-workspace ${readOnly ? "is-read-only" : ""}`} aria-label={readOnly ? `${readOnly.name} library` : "Library"}>
      {/* One heading for your collection and a friend's: title, then the way back and the actions as one group. */}
      <header className="workspace-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>{readOnly ? readOnly.name : "Library"}</h1>
          <p>{readOnly ? `${decks.length} public ${decks.length === 1 ? "deck" : "decks"} · Read-only` : `${onDisplay} on display`}</p>
        </div>
        <div className="workspace-actions">
          <button className="text-button workspace-back" aria-label={`Back to ${backTarget}`} title={`Back to ${backTarget}`} onClick={onClose}><ArrowLeft size={15} /><span>Back<span className="workspace-back-target"> to {backTarget}</span></span></button>
          {readOnly ? readOnly.actions : <>
            <button className="button button-outline" onClick={onShare}><Share2 size={15} /> Share</button>
            <button className="button button-gold" disabled={!!busy} onClick={() => { setConnecting(true); resetSourceForm(); }}><Plus size={15} /> Add decks</button>
          </>}
        </div>
      </header>
      <div className="collection-manager">
        <div className="manager-body">
          <button className="workspace-mobile-toggle button button-outline" aria-expanded={mobileNav} onClick={() => setMobileNav(v => !v)}><FolderTree size={15} />{readOnly ? "Folders" : "Sources and folders"}</button>
          <div className={mobileNav ? 'workspace-navigation is-open' : 'workspace-navigation'}>
            <CollectionNavigator readOnly={!!readOnly} collection={collection} decks={decks} groups={groups} section={connecting ? '' : section} busy={!!busy} navigate={navigate}
              openScope={(key, name, keys) => { navigate(key); setScope({ name, keys }); }}
              toggle={(keys, enabled, all) => setCollection(c => enableGroups(c, keys, enabled, all))}
              show={keys => setCollection(c => hideGroups(c, keys, false))} />
          </div>
          <section
            className="manager-content"
            aria-label="Manage collection decks"
          >
            {busy && (
              <div className="manager-progress" role="status">
                <RefreshCw size={14} />
                {busy}
                <button
                  className="text-button"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel
                </button>
              </div>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {!!failures.length && (
              <details ref={failuresRegion} className="manager-failures" open>
                <summary>
                  {failures.length} decks could not be loaded. Existing copies
                  were kept.
                </summary>
                <ul>
                  {failures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
            {connecting ? (
              <SourceSetup followEnabled={followEnabled} value={value} setValue={setValue} discovery={discovery}
                formatScope={formatScope} setFormatScope={changeFormatScope}
                selected={selected} setSelected={setSelected} busy={!!busy}
                back={() => { if (!discovery) setConnecting(false); resetSourceForm(); }}
                connect={connect} save={addFolders}
                browse={onBrowse && (() => { try { onBrowse(parseShelfInput(value)); } catch (problem) { setError((problem as Error).message); } })} />
            ) : (
              <>
              {section === "overview" && (
              <CollectionOverview
                readOnly={!!readOnly}
                groups={groups}
                collection={collection}
                decks={decks}
                busy={!!busy}
                navigate={navigate}
                openScope={(key, name, keys) => { navigate(key); setScope({ name, keys }); }}
                onlyMany={keys => setCollection(c => ({ ...c, pausedGroups: [], disabledGroups: groups.filter(g => !keys.includes(g.key)).map(g => g.key) }))}
                toggle={(keys, enabled, all) =>
                  setCollection((c) => enableGroups(c, keys, enabled, all))
                }
                only={(key) => setCollection((c) => onlyGroup(c, key, groups))}
                enableAll={() =>
                  setCollection((c) => ({ ...c, pausedGroups: [], disabledGroups: [] }))
                }
                addDemo={addPrecons}
                hide={hide}
                remove={remove}
              />
              )}
              {section === "overview" && overviewExtra}
              {section !== "overview" && <>
                <div className="manager-section-heading">
                  <div>
                    <h3>
                      {scope?.name || activeGroup?.name ||
                        (section === "starter"
                          ? "Included precons"
                          : section === "manual"
                            ? "Individual decks"
                            : readOnly ? "All decks" : "All saved decks")}
                    </h3>
                    {(source || scope || section === "demo") && <p className="workspace-scope-note">
                      {source ? source.folderPath ? source.folderPath + ' · Direct decks' : 'Archidekt source'
                        : scope ? 'Includes connected subfolders' : 'Curated by Archidekt'}
                    </p>}
                  </div>
                  {(source || section === "demo") && (
                    <a
                      className="icon-button"
                      href={source?.url || "https://archidekt.com/commander-precons"}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open source on Archidekt"
                    >
                      <ExternalLink size={17} />
                    </a>
                  )}
                </div>
                {headerKeys.length > 0 && <div className="manager-toolbar">
                  {headerHidden
                    ? <div className="collection-hidden-state"><EyeOff size={14} /><span>Hidden</span>
                        <button className="text-button" disabled={!!busy} onClick={() => setCollection(c => hideGroups(c, headerKeys, false))}><Eye size={14} />Show</button></div>
                    : <div className="manager-group-control">
                        {scope
                          ? <label className={`overview-switch ${scopePartial ? "is-partial" : ""}`}><input type="checkbox" role="switch" aria-label={`Enable ${scope.name} folders`} aria-description={scopePartial ? "Some folders enabled" : undefined} disabled={!!busy}
                              checked={scopedKeys.some(key => groupActive(collection, key))}
                              title="Click to pause/resume. Ctrl-click or Cmd-click to enable all folders; repeat to disable all." onChange={e => { const event = e.nativeEvent as MouseEvent; const all = event.ctrlKey || event.metaKey; const enabled = e.target.checked; setCollection(c => enableGroups(c, scopedKeys, all ? scopedKeys.some(key => c.disabledGroups?.includes(key)) : enabled, all)); }} /><span>{scopePartial ? "Some" : scopedKeys.some(key => groupActive(collection, key)) ? "On" : "Off"}</span></label>
                          : activeGroup && <label className="overview-switch"><input type="checkbox" role="switch" aria-label={`Enable ${activeGroup.name}`} checked={activeGroup.enabled} disabled={!!busy}
                              onChange={e => setCollection(c => enableGroup(c, activeGroup.key, e.target.checked))} /><span>{activeGroup.enabled ? "On" : "Off"}</span></label>}
                        <button className="text-button" disabled={!!busy} onClick={() => setCollection(c => scope
                          ? { ...c, pausedGroups: [], disabledGroups: groups.filter(g => !scopedKeys.includes(g.key)).map(g => g.key) }
                          : onlyGroup(c, section, groups))}><Focus size={14} />Only this</button>
                      </div>}
                  <div className="manager-toolbar-end">
                    {source && !readOnly && <button className="text-button" disabled={!!busy || !!sourceRefresh.checking || followEnabled && Date.now() < Date.parse(source.refresh?.retryAt || "1970-01-01")} onClick={refreshSource}><RefreshCw size={14} />{sourceRefresh.checking === source.key ? "Checking…" : "Refresh"}</button>}
                    {section === "demo" && !headerHidden && <button className="text-button" disabled={!!busy} title="Check Archidekt for precons released since this snapshot" onClick={updatePrecons}><RefreshCw size={14} />Refresh</button>}
                    <CollectionMenu name={headerName} busy={!!busy} items={menuItems} />
                  </div>
                  {section === "starter" && !collection.demo && <div className="manager-precon-link"><button className="text-button" disabled={!!busy} onClick={addPrecons}>
                    <Plus size={14} />Add all Official Commander precons</button></div>}
                </div>}
                {followEnabled && source && <div className="source-refresh-status" aria-live="polite">
                  <span>Checked {new Date(source.checkedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {sourceRefresh.checking === source.key ? <span>Checking…</span> : source.refresh?.error ? <span>Couldn’t check · {source.refresh.error} Trying again after {new Date(source.refresh.retryAt!).toLocaleTimeString([], { timeStyle: 'short' })}</span>
                    : source.lastChange && <span>{refreshSummary(source, newDeckCount)}</span>}
                </div>}
                <div className="manager-search">
                  <label>
                    <Search size={16} />
                    <input
                      aria-label="Find a deck in collection settings"
                      placeholder="Find a deck or commander…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <FormatSelect label="Collection format" value={browseFormat} onChange={setBrowseFormat} items={rows} all disabled={!!busy} />
                  <select
                    aria-label="Deck display status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All decks</option>
                    <option value="shown">On display</option>
                    <option value="hidden">Hidden</option>
                    {scopedSources.length > 0 && !readOnly && <option value="new">Not added</option>}
                  </select>
                </div>
                <div className="workspace-display-controls">
                <div className="manager-bulk">
                  <span>
                    {shown.length} {shown.length === 1 ? "deck" : "decks"}
                  </span>
                  <label className="manager-select-all" title={allChecked ? "Deselect every deck in the current results" : "Select every deck in the current results. New decks wait for Add selected decks."}>
                    <input ref={selectAllBox} type="checkbox" checked={allChecked} disabled={!!busy || !shown.length}
                      onChange={() => selectAll(!allChecked)} />
                    <span>Select all</span>
                  </label>
                </div>
                <CollectionViewControls display={display} onChange={setDisplay} sort={sort} onSort={setSort} />
                </div>
                <div className={`manager-list workspace-decks layout-${layout}`} style={{
                  "--manager-card-size": `${collectionTileSize(layout, size)}px`,
                  "--phone-columns": collectionPhoneColumns(layout, size),
                } as CSSProperties}>

                  {deckViews}
                  {!shown.length && (
                    <div className="manager-empty">
                      <Library size={26} />
                      <h4>
                        {rows.length
                          ? "No matching decks"
                          : source
                            ? "No public decks in this format"
                            : "No decks here yet"}
                      </h4>
                      <p>
                        {source && !rows.length
                          ? "Check the username or folder on Archidekt. Private decks cannot be read here."
                          : rows.length
                            ? "Try another search or display status."
                            : "Add a deck link or connect a source to get started."}
                      </p>
                    </div>
                  )}
                </div>
                {selected.length > 0 && (
                  <div className="manager-selection">
                    <span>{selected.length} selected</span>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() => setSelected([])}
                    >
                      Clear
                    </button>
                    <button
                      className="button button-gold"
                      disabled={!!busy}
                      onClick={addSelected}
                    >
                      <Plus size={15} /> Add selected decks
                    </button>
                  </div>
                )}
              </>}
              </>
            )}
          </section>
        </div>
        <footer className="manager-footer">
          {readOnly ? <div /> : <div>
            <button className="text-button" onClick={backup}>
              <Download size={14} /> Export backup
            </button>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={14} /> Restore backup
            </button>
            <input
              ref={input}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              accept=".json,application/json"
              onChange={restore}
            />
          </div>}
          <button className="button button-outline" onClick={onClose}>
            <Check size={15} /> Done
          </button>
        </footer>
        {restorePreview && (
          <div
            ref={restoreRegion}
            tabIndex={-1}
            className="manager-restore"
            role="region"
            aria-label="Restore collection backup"
          >
            <div>
              <strong>Replace this local collection?</strong>
              <p>
                The backup has {restorePreview.added.length} saved deck snapshots and{" "}
                {restorePreview.sources?.length || 0} linked sources
                {restorePreview.demo ? `, plus ${restorePreview.demo.decks.length} saved precons` : ""}.
                {" "}It replaces your decks, sources and collection choices; it does not merge them.
                Display preferences stay as they are. Export your current backup first if you want to keep it.
              </p>
              {restoreError && <p className="inline-error" role="alert">{restoreError}</p>}
            </div>
            <button
              className="button button-gold"
              disabled={!!busy}
              onClick={() => {
                try {
                  controller.current?.abort();
                  onRestore(restorePreview);
                  setRestoreError("");
                  setRestorePreview(null);
                  navigate("all");
                  setError("");
                  notify("Collection restored and saved in this browser.");
                } catch (e) { setRestoreError((e as Error).message); }
              }}
            >
              Restore this backup
            </button>
            <button
              className="icon-button"
              aria-label="Cancel restore"
              onClick={() => { setRestorePreview(null); setRestoreError(""); }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
// What the last check found, in plain words. Zero counts are left out.
function refreshSummary(source: CollectionSource, newDecks: number): string {
  const follow = sourceMembership(source) === 'follow';
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts = [
    newDecks ? `${count(newDecks, 'new deck')} ${follow ? 'added' : 'on Archidekt, not added'}` : '',
    source.lastChange?.unlisted.length ? `${source.lastChange.unlisted.length} no longer on Archidekt` : '',
    source.lastChange?.renamed.length ? `${source.lastChange.renamed.length} renamed` : '',
    follow && source.pendingIds?.length ? `${source.pendingIds.length} still downloading` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'No changes';
}

function toEntry(deck: Deck): SourceEntry {
  return {
    format: formatOf(deck),
    id: deck.id,
    name: deck.name,
    image: coverOf(deck).art,
    colors: deck.colors,
  };
}
