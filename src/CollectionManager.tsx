import CollectionMenu, { type MenuItem } from './CollectionMenu';
import CollectionDeckTile from "./CollectionDeckTile";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Power,
  PowerOff,
  Focus,
  ListChecks,
  Eye,
  EyeOff,
  Square,
  FolderTree,
  Trash2,
  Check,
  Download,
  ExternalLink,
  Library,
  Plus,
  RefreshCw,
  Search,
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
import {
  parseSourceInput,
  rememberSource,
  saveSnapshots,
  setShown,
  setDeckSelection,
  setSourceSelection,
  showcaseGroups,
  showcaseDecks,
  hideGroups,
  isHidden,
  groupActive,
  enableGroup,
  enableGroups,
  onlyGroup,
  sourceDeckIds,
  removeSources,
  addDemo,
  updateDemo,
  importFolderSelection,
} from "./collection";
import precons from "./data/precons.json";
import CollectionNavigator from "./CollectionNavigator";
import { CollectionLayoutSwitch } from "./CollectionLayoutSwitch";
import "./collection-workspace.css";
import CollectionOverview from "./CollectionOverview";
import SourceSetup, { type FolderDiscovery } from "./SourceSetup";
import "./collection.css";

type Props = {
  decks: Deck[];
  catalog: Deck[];
  collection: Collection;
  setCollection: (update: Collection | ((c: Collection) => Collection)) => void;
  onClose: () => void;
  backup: () => void;
  notify: (message: string) => void;
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
): Promise<CollectionSource> {
  const data = await jsonRequest(
    `/api/sources?${new URLSearchParams({ kind, value })}`,
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

export default function CollectionManager({
  decks,
  catalog,
  collection,
  setCollection,
  onClose,
  backup,
  notify,
  startPersonal = false,
  initialSection = "overview",
  initialScope = null,
  onLocationChange,
  onRestore,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [layout, setLayout] = useState<'grid' | 'art' | 'compact' | 'list'>('grid');
  const [size, setSize] = useState(175);
  const [scope, setScope] = useState<{ name: string; keys: string[] } | null>(initialScope);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);
  const [section, setSection] = useState(initialSection);
  useEffect(() => { onLocationChange(section, scope); }, [section, scope]);
  const [connecting, setConnecting] = useState(startPersonal);
  const [discovery, setDiscovery] = useState<FolderDiscovery | null>(null);
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [restorePreview, setRestorePreview] = useState<Collection | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const restoreRequest = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const restoreRegion = useRef<HTMLDivElement>(null);
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
  const scopedSources = scope ? sources.filter(s => scope.keys.includes(s.key)) : source ? [source] : [];
  const scopedKeys = scopedSources.map(s => s.key);
  const saved = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);
  const groups = showcaseGroups(collection, catalog, decks);
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
  const shown = rows.filter((row) => {
    const deck = saved.get(row.id);
    const text = [row.name, ...(deck?.commanders.map((c) => c.name) || [])]
      .join(" ")
      .toLowerCase();
    const display = isSavedHere(row.id) && (!scopedSources.length || sourceIds.has(row.id)) && displayedHere(row.id);
    return (
      text.includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "shown" && display) ||
        (status === "hidden" && isSavedHere(row.id) && !display) ||
        (status === "new" && !isSavedHere(row.id)))
    );
  });
  function selectAll(select: boolean) {
    if (scopedSources.length) {
      const ids = shown.filter(row => isSavedHere(row.id)).map(row => row.id);
      setCollection(c => setSourceSelection(c, scopedKeys, ids, select, decks));
      const pending = shown.filter(row => !isSavedHere(row.id)).map(row => row.id);
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
  function report(error: unknown) {
    if ((error as Error).name !== "AbortError")
      setError(
        (error as Error).message === "Failed to fetch"
          ? "Could not reach Archidekt. Your saved decks are still available."
          : (error as Error).message,
      );
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
        setCollection({
          ...saveSnapshots(collection, [deck], true),
          manualIds: [...new Set([...(collection.manualIds || []), deck.id])],
        });
        navigate("manual");
        notify(`${deck.name} added to Individual decks.`);
      } else {
        const found = await jsonRequest(`/api/source-folders?${new URLSearchParams({ kind: parsed.kind, value: parsed.value })}`, signal);
        if (typeof found.name !== 'string' || !Array.isArray(found.folders) || found.folders.length > 80 ||
          !found.folders.every((f: FolderDiscovery['folders'][number]) => f && validateSource(f.source) && typeof f.path === 'string' && typeof f.root === 'boolean'))
          throw new Error('The source returned incomplete folder information.');
        signal.throwIfAborted();
        setDiscovery(found);
        setSelected([]);
        importedFolderKeys.current.clear();
      }
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  async function addFolders(onlyFolders: boolean) {
    if (!discovery) return;
    const signal = begin('Adding selected decks…');
    try {
      const parsed = parseSourceInput(value);
      const chosen = discovery.folders.map(f => ({ ...f.source, folderPath: f.path, connectionKey: parsed.key, connectionName: discovery.name })).filter(s => s.entries.some(e => selected.includes(e.id)));
      if (new Set([...sources.map(s => s.key), ...chosen.map(s => s.key)]).size > 50)
        throw new Error('Choose fewer folders. A collection can link up to 50 sources.');
      if (collection.added.length + selected.filter(id => !collection.added.some(d => d.id === id)).length > 1000)
        throw new Error('A local collection can hold up to 1,000 imported decks. Choose fewer decks.');
      const { loaded, errors } = await fetchDecks(selected.filter(id => !saved.has(id)), signal, false);
      signal.throwIfAborted();
      const accepted = [...loaded, ...selected.filter(id => saved.has(id)).map(id => saved.get(id)!)];
      const next = importFolderSelection(collection, chosen, accepted, decks, onlyFolders && !errors.length ? groups.map(g => g.key).filter(key => !importedFolderKeys.current.has(key)) : []);
      setCollection(next);
      chosen.filter(s => s.entries.some(e => accepted.some(d => d.id === e.id))).forEach(s => importedFolderKeys.current.add(s.key));
      if (errors.length) {
        setSelected(ids => ids.filter(id => !accepted.some(d => d.id === id)));
        setFailures(errors);
        notify(`${accepted.length} decks added. The remaining decks can be retried.`);
      } else {
        notify(`${accepted.length} ${accepted.length === 1 ? 'deck' : 'decks'} added to your collection.`);
        navigate("overview");
      }
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
      const { loaded, errors } = await fetchDecks(
        selected.filter((id) => !saved.has(id)),
        signal,
        false,
      );
      const accepted = [
        ...loaded,
        ...selected.filter((id) => saved.has(id)).map((id) => saved.get(id)!),
      ];
      const next = setShown(
        saveSnapshots(collection, accepted, true),
        accepted.map((d) => d.id),
        true,
      );
      setCollection(
        scopedSources.length
          ? setSourceSelection(next, scopedKeys, accepted.map(d => d.id), true, [...decks, ...accepted])
          : next,
      );
      setSelected((ids) =>
        ids.filter((id) => !accepted.some((d) => d.id === id)),
      );
      setFailures(errors);
      notify(
        `${accepted.length} ${accepted.length === 1 ? "deck" : "decks"} selected${activeGroup?.enabled === false ? ". Enable this collection to show them." : "."}`,
      );
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  async function refreshSource() {
    if (!source) return;
    const signal = begin("Checking source…");
    try {
      const found = await loadSource(source.kind, source.value, signal);
      const { loaded, errors } = await fetchDecks(
        found.entries.filter((e) => sourceIds.has(e.id)).map((e) => e.id),
        signal,
        true,
      );
      setCollection(saveSnapshots(rememberSource(collection, found), loaded));
      setSelected([]);
      setFailures(errors);
      notify(
        `Source checked. ${loaded.length} saved decks refreshed; new decks are ready to review.`,
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
      // A recent export toast can cover the confirmation actions on a phone.
      notify("");
      setError("");
    } catch (e) {
      if (request === restoreRequest.current) report(e);
    }
  }
  function hide(keys: string[]) {
    setCollection(c => hideGroups(c, keys, true));
  }
  function remove(keys: string[]) {
    setCollection(c => removeSources(c, keys));
    navigate("overview");
  }
  async function updatePrecons() {
    const signal = begin("Checking Archidekt for new precons…");
    try {
      const found = await loadSource("account", "Archidekt_Precons", signal);
      const known = new Set(collection.demo?.decks.map(d => d.id) || []);
      const { loaded, errors } = await fetchDecks(found.entries.map(e => e.id).filter(id => !known.has(id)), signal, false);
      setCollection(c => updateDemo(c, loaded, found.checkedAt));
      setFailures(errors);
      notify(loaded.length ? `${loaded.length} new ${loaded.length === 1 ? "precon" : "precons"} added.` : "Precons are up to date.");
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
    ...(scopedSources.length ? [{ label: "Remove…", icon: <Trash2 size={14} />, run: () => remove(scopedKeys),
      confirm: { text: `Remove ${headerName} and its ${sourceIds.size} saved ${sourceIds.size === 1 ? "deck" : "decks"}? Decks that are also in another collection stay.`, action: "Remove" } }] : []),
  ];
  return (
    <main className="collection-workspace" aria-label="My collection">
      <header className="workspace-heading">
        <div><h1 ref={heading} tabIndex={-1}>My collection</h1><p>{onDisplay} on display</p></div>
        <button className="text-button workspace-back" aria-label="Back to collection" title="Back to collection" onClick={onClose}><ArrowLeft size={15} /><span>Back to collection</span></button>
        <button className="button button-gold" disabled={!!busy} onClick={() => { setConnecting(true); setDiscovery(null); setSelected([]); setError(''); setFailures([]); }}><Plus size={16} /> Add decks</button>
      </header>
      <div className="collection-manager">
        <div className="manager-body">
          <button className="workspace-mobile-toggle button button-outline" aria-expanded={mobileNav} onClick={() => setMobileNav(v => !v)}><FolderTree size={15} />Sources and folders</button>
          <div className={mobileNav ? 'workspace-navigation is-open' : 'workspace-navigation'}>
            <CollectionNavigator collection={collection} decks={decks} groups={groups} section={connecting ? '' : section} busy={!!busy} navigate={navigate}
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
              <details className="manager-failures" open>
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
              <SourceSetup value={value} setValue={setValue} discovery={discovery}
                selected={selected} setSelected={setSelected} busy={!!busy}
                back={() => { if (discovery) { setDiscovery(null); setSelected([]); } else setConnecting(false); setError(''); setFailures([]); }}
                connect={connect} save={addFolders} />
            ) : (
              <>
              {section === "overview" && (
              <CollectionOverview
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
              {section !== "overview" && <>
                <div className="manager-section-heading">
                  <div>
                    <h3>
                      {scope?.name || activeGroup?.name ||
                        (section === "starter"
                          ? "Included precons"
                          : section === "manual"
                            ? "Individual decks"
                            : "All saved decks")}
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
                    {source && <button className="text-button" disabled={!!busy} onClick={refreshSource}><RefreshCw size={14} />Refresh</button>}
                    {section === "demo" && !headerHidden && <button className="text-button" disabled={!!busy} title="Check Archidekt for precons released since this snapshot" onClick={updatePrecons}><RefreshCw size={14} />Refresh</button>}
                    <CollectionMenu name={headerName} busy={!!busy} items={menuItems} />
                  </div>
                  {section === "starter" && !collection.demo && <div className="manager-precon-link"><button className="text-button" disabled={!!busy} onClick={addPrecons}>
                    <Plus size={14} />Add all Official Commander precons</button></div>}
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
                  <select
                    aria-label="Deck display status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All decks</option>
                    <option value="shown">On display</option>
                    <option value="hidden">Hidden</option>
                    {scopedSources.length > 0 && <option value="new">Not added</option>}
                  </select>
                </div>
                <div className="workspace-display-controls">
                <div className="workspace-view-controls">
                  <CollectionLayoutSwitch compact value={layout} onChange={setLayout} />
                  <label>Size <input aria-label="Deck size" type="range" min="130" max="250" step="10" value={size} onChange={e => setSize(Number(e.target.value))} /></label>
                </div>
                <div className="manager-bulk">
                  <span>
                    {shown.length} {shown.length === 1 ? "deck" : "decks"}
                  </span>
                  <button
                    className="text-button"
                    disabled={!!busy || !shown.length}
                    aria-label="Select all" title="Select every deck in the current results. New decks wait for Add selected decks."
                    onClick={() => selectAll(true)}
                  >
                    <ListChecks size={14} /><span className="bulk-long">Select all</span><span className="bulk-short">All</span>
                  </button>
                  <button
                    className="text-button"
                    disabled={!!busy || !shown.length}
                    aria-label="Deselect all" title="Deselect every deck in the current results"
                    onClick={() => selectAll(false)}
                  >
                    <Square size={14} /><span className="bulk-long">Deselect all</span><span className="bulk-short">None</span>
                  </button>
                </div>
                </div>
                <div className={`manager-list workspace-decks layout-${layout}`} style={{ "--manager-card-size": `${size}px` } as CSSProperties}>

                  {shown.map((row) => {
                    const deck = saved.get(row.id);
                    const displaying =
                      isSavedHere(row.id) &&
                      !collection.hidden.includes(row.id) && (!scopedSources.length || sourceIds.has(row.id));
                    const member = isSavedHere(row.id);
                    const missing =
                      !!source &&
                      !!deck &&
                      !source.entries.some((e) => e.id === row.id);
                    const checked = member ? displaying : selected.includes(row.id);
                    const toggle = (on: boolean) => member
                      ? setCollection(c => scopedSources.length ? setSourceSelection(c, scopedKeys, [row.id], on, decks) : setShown(c, [row.id], on))
                      : setSelected(ids => on ? [...new Set([...ids, row.id])] : ids.filter(id => id !== row.id));
                    return <CollectionDeckTile key={row.id} row={row} deck={deck} layout={layout} checked={checked} member={member} busy={!!busy}
                      toggle={toggle}
                      note={missing ? 'No longer listed · saved copy kept' : !member ? 'Not added' : !displayedHere(row.id) && displaying ? (headerHidden ? 'Hidden · selection kept' : 'Collection off · selection kept') : deck?.commanders.map(c => c.name).join(' & ') || ''}
                      />;
                  })}
                  {!shown.length && (
                    <div className="manager-empty">
                      <Library size={26} />
                      <h4>
                        {rows.length
                          ? "No matching decks"
                          : source
                            ? "No public Commander decks found"
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
          <div>
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
              accept=".json,application/json"
              onChange={restore}
            />
          </div>
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
function toEntry(deck: Deck): SourceEntry {
  return {
    id: deck.id,
    name: deck.name,
    image: deck.commanders[0].art,
    colors: deck.colors,
  };
}
