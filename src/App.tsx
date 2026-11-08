import { saveSharedCollectionWithLock } from './shared-collection-storage';
import ShareCollection from './ShareCollection';
import { fetchShelfListing, readSharedLocation, useSharedCollection } from './useSharedCollection';
import { buildSharePath, type SharedSource } from './share-links';
import { addRecent, applyShelfView, cachedShelf, keepShelf, putShelfView, readKept, readRecent, readShelfViews, shelfCollection, shelfId, shelfRef, shelfViewOf, writeKept, writeRecent, writeShelfViews, type KeptShelf, type ShelfRef, type ShelfViews } from './shelves';
import { OtherCollections, ShelfSwitcher } from './SharedShelves';
import { coverOf, formatOf, formatName } from './domain';
import { listingDeck } from './collection';
import QuickChoiceControls from './QuickChoiceControls';
import './recovery.css';
import FormatSelect from './FormatSelect';
import TagFilter from './TagFilter';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  Plus,
  Share2,
  Check,
  ChevronDown,
  ExternalLink,
  CircleHelp,
  LayoutGrid,
  Library,
  Search,
  SlidersHorizontal,
  Dices,
  Tag,
  RefreshCw,
  X,
  Settings,
} from "lucide-react";
import seed from "./data/decks.json";
import precons from "./data/precons.json";
import {
  COLORS,
  descriptionParts,
  EMPTY_COLLECTION,
  EMPTY_FILTERS,
  listSettings,
  parseListSettings,
  matchesDeck,
  pickerDecks,
  parseCollection,
  tagCounts,
  validateDeck,
  type Collection,
  type Deck,
  type Filters,
} from "./domain";
import { Artwork, ArtworkContext, Mana, ManaSymbol, Modal } from "./components";
import { applyUpdate, useOnline, useUpdateReady } from "./pwa";
import { onMenuCommand } from "./WindowBar";
import { DeckTable, ListSettingsContext, tableDeck } from "./DeckTable";
import CollectionViewControls, { collectionPhoneColumns, collectionTileSize, sortCollectionDecks, useCollectionDisplay } from "./CollectionViewControls";
import { CardFanIcon } from "./CardFanIcon";
import Picker from "./HelixPicker";
import ShufflePicker from "./ShufflePicker";
import { savedPresentation, savePresentation, type Presentation } from "./PickerControls";
import CardStudio from "./CardStudio";
import HelpCenter, { helpSectionFromPath, type FeatureTarget, type HelpSection } from "./HelpCenter";
import { CardBackContext } from "./placeholders/CardBackArt";
import CollectionManager from "./CollectionManager";
import { useSourceRefresh } from './sourceRefresh';
import { Notices, notify } from "./Notices";
import { showcaseDecks, showcaseGroups, deckCollections, collectionDecks, freshCollection, addDemo, fillDeck, dropPartialDecks } from "./collection";
import { DeckLoadError, fillDecks, loadFullDeck } from "./deckFill";
import { Atmosphere, tiltCard, resetTilt } from "./Atmosphere";
import FirstVisitHint, { TourPopover } from "./FirstVisitHint";
import { ENABLE_FIRST_VISIT_IN_PRODUCTION, isFreshProfile, markFirstVisit } from "./firstVisit";

const catalog = seed as Deck[];
// Blocked storage throws on access; shelf lists then live in memory only.
const shelfStorage = () => { try { return localStorage; } catch { return undefined; } };
const STORAGE_KEY = "commander-archive.collection.v1";
// More chips than this fold behind a "+N more" button.
const CHIPS_FOLDED = 2;
type View = "cards" | "grid" | "picker";
const HOME_VIEW: View = "grid";
function readSaved(): { collection: Collection; error: string; raw?: string | null; fresh?: boolean } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return {
      collection: raw !== null ? parseCollection(raw) : freshCollection(precons as { snapshotAt: string; decks: Deck[] }),
      error: "",
      fresh: isFreshProfile(localStorage),
    };
  } catch {
    return {
      collection: { ...EMPTY_COLLECTION },
      raw,
      error:
        raw !== null
          ? "Saved collection data is damaged. It has not been overwritten. Download it for recovery before restoring a backup. Changes here are temporary."
          : "Browser storage could not be read. Existing saved data has not been overwritten. Changes here are temporary; export them before closing.",
    };
  }
}

function App() {
  const [sharedRoute, setSharedRoute] = useState(readSharedLocation);
  const [kept, setKept] = useState<KeptShelf[]>(() => readKept(shelfStorage()));
  const [recent, setRecent] = useState<ShelfRef[]>(() => readRecent(shelfStorage()));
  const shared = useSharedCollection(sharedRoute, {
    // Kept snapshots open offline; other shelves are fetched on first view in each tab.
    lookup: id => kept.find(shelf => shelfId(shelf.source) === id),
    onLoad: ({ source, decks }) => {
      setRecent(list => addRecent(list, shelfRef({ source, decks })));
    },
  });
  useEffect(() => { writeRecent(shelfStorage(), recent); }, [recent]);
  // What's switched on or off on friends' shelves, kept apart from your own collection.
  const [shelfViews, setShelfViews] = useState<ShelfViews>(() => readShelfViews(shelfStorage()));
  useEffect(() => { writeShelfViews(shelfStorage(), shelfViews); }, [shelfViews]);
  function changeKept(next: KeptShelf[]) {
    if (!writeKept(shelfStorage(), next)) notify("This browser couldn't keep that collection. It stays here until you close this tab.");
    setKept(next);
  }
  // Every way back to a shared shelf goes through its address, so browser Back keeps working.
  // Switching from the header menu keeps the page you're on: the folders page stays the folders page.
  function openSharedShelf(source: SharedSource, { stay = false } = {}) {
    if (spinning) return;
    history.pushState(null, '', buildSharePath(source));
    setSharedRoute(readSharedLocation());
    if (!stay) setShowCollection(false);
    setHelp(null);
  }
  function openPersonalShelf() {
    if (isShared) leaveShared();
  }
  const isShared = !!sharedRoute.source || !!sharedRoute.error;
  const sharedIdentity = sharedRoute.source
    ? sharedRoute.source.kind + ':' + sharedRoute.source.value.toLowerCase()
    : sharedRoute.error ? 'invalid-shared-link' : '';
  const [showShare, setShowShare] = useState(false);
  // Bookmarking never leaves the page: a shelf that isn't open is read from its listing.
  async function bookmarkShelf(target: SharedSource & { name: string }) {
    const id = shelfId(target);
    const loaded = id === sharedIdentity && shared.source ? { source: shared.source, decks: shared.decks, folders: shared.folders } : cachedShelf(id);
    try {
      const shelf = loaded || await (async () => {
        const { source, folders } = await fetchShelfListing(target, AbortSignal.timeout(60000));
        return { source, folders, decks: source.entries.map(entry => listingDeck(entry)) };
      })();
      setKept(list => {
        const next = keepShelf(list, shelf);
        if (!writeKept(shelfStorage(), next)) notify("This browser couldn't keep that collection. It stays here until you close this tab.");
        return next;
      });
    } catch (error) { notify((error as Error).message); }
  }
  function removeBookmark(id: string) {
    const shelf = kept.find(item => shelfId(item.source) === id);
    changeKept(kept.filter(item => shelfId(item.source) !== id));
    if (shelf && !recent.some(ref => shelfId(ref) === id)) setRecent(list => addRecent(list, shelfRef(shelf)));
  }
  const [sharedSaved, setSharedSaved] = useState(false);
  const [sharedSaving, setSharedSaving] = useState(false);
  const activeSharedIdentity = useRef(sharedIdentity);
  activeSharedIdentity.current = sharedIdentity;
  function openMyCollection() {
    if (isShared && !sharedShelf) leaveShared();
    setHelp(null);
    setPersonalStart(false);
    if (showCollection) {
      setCollectionSection("overview");
      setCollectionScope(null);
      setCollectionVisit(v => v + 1);
    }
    setShowCollection(true);
  }
  function leaveShared() {
    activeSharedIdentity.current = '';
    history.pushState(null, '', '/');
    setSharedRoute(readSharedLocation());
    setHelp(null);
  }
  // Each shelf keeps its own search, filters, sort and shortlist while this tab is open.
  const browseState = useRef(new Map<string, { filters: Filters; shortlist: string[]; sort: string }>());
  const lastIdentity = useRef(sharedIdentity);
  useEffect(() => {
    browseState.current.set(lastIdentity.current, browseNow.current);
    lastIdentity.current = sharedIdentity;
    const saved = browseState.current.get(sharedIdentity);
    setSharedSaved(false);
    setShortlist(saved?.shortlist ?? []);
    setFilters(saved?.filters ?? { ...EMPTY_FILTERS });
    if (saved) setSort(saved.sort);
    setDetail(null);
    setPickerWinner(null);
  }, [sharedIdentity]);
  const [loaded, setLoaded] = useState(readSaved);
  const [firstVisit, setFirstVisit] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const firstVisitClaimed = useRef(false);
  useEffect(() => {
    if (!(import.meta.env.DEV || ENABLE_FIRST_VISIT_IN_PRODUCTION) || !loaded.fresh || firstVisitClaimed.current) return;
    firstVisitClaimed.current = true;
    try { setFirstVisit(markFirstVisit(localStorage)); } catch { /* Fail closed when storage itself is blocked. */ }
  }, [loaded]);
  const [collection, setCollection] = useState<Collection>(loaded.collection);
  const [storageError, setStorageError] = useState(loaded.error);
  const [storageLocked, setStorageLocked] = useState(!!loaded.error);
  // New decks from Archidekt folders are added automatically unless Settings turns it off.
  const followEnabled = !collection.followOff;
  const collectionGeneration = useRef(0);
  const sourceRefresh = useSourceRefresh(collection, setCollection, storageLocked, followEnabled, catalog);
  const persistedCollection = useRef<Collection | null>(null);
  const wasShared = useRef(isShared);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [view, setView] = useState<View>(HOME_VIEW);
  // Helix or shuffle-and-deal (#76), remembered like the player count.
  const [presentation, setPresentation] = useState(savedPresentation);
  const [display, setDisplay] = useCollectionDisplay("commander-archive.display.v1");
  const [pickerWinner, setPickerWinner] = useState<Deck | null>(null);
  const revealed = !!pickerWinner;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<{ id: string; message: string } | null>(null);
  const [sort, setSort] = useState("collection");
  const [detail, setDetail] = useState<Deck | null>(null);
  const collectionTrigger = useRef<HTMLButtonElement>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [personalStart, setPersonalStart] = useState(false);
  const [collectionSection, setCollectionSection] = useState("overview");
  const [collectionScope, setCollectionScope] = useState<{ name: string; keys: string[] } | null>(null);
  const [collectionVisit, setCollectionVisit] = useState(0);
  const [help, setHelp] = useState<HelpSection | null>(() => helpSectionFromPath(location.pathname));
  useEffect(() => {
    if (help === "start") setFirstVisit(false);
    if (help) setTourOpen(false);
  }, [help]);
  const helpTrigger = useRef<HTMLButtonElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  // Leaving Help returns focus to whichever header icon opened it.
  const helpOpener = useRef<"help" | "settings">("help");
  function startTour() { setFirstVisit(false); setTourOpen(true); }
  function dismissTour() { setFirstVisit(false); helpTrigger.current?.focus(); }
  const closeTour = useCallback((returnFocus: boolean) => {
    setTourOpen(false);
    if (returnFocus) helpTrigger.current?.focus();
  }, []);
  // Personal browsing keeps its URL; Help and shared sources are addressable.
  useEffect(() => {
    const current = helpSectionFromPath(location.pathname);
    // Personal browsing and shared sources keep their address until Help opens.
    if (!help && !current) return;
    const path = help ? `/help/${help}` : "/";
    if (location.pathname === path) return;
    // Keep main's equivalent Help/Settings addresses out of the history stack.
    if (current === help) history.replaceState(null, "", path);
    else history.pushState(null, "", path);
    setSharedRoute(readSharedLocation());
  }, [help]);
  useEffect(() => {
    const sync = () => { setShowCollection(false); setHelp(helpSectionFromPath(location.pathname)); setSharedRoute(readSharedLocation()); };
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  const [showFilters, setShowFilters] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showFilters) return;
    const closeOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !filterDropdownRef.current?.contains(event.target)
      ) {
        setShowFilters(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowFilters(false);
        filterTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showFilters]);
  const [spinning, setSpinning] = useState(false);
  // Undo restores the collection from before an action, but only while nothing has changed since.
  const latestCollection = useRef(collection);
  latestCollection.current = collection;
  const undoTo = useCallback((before: Collection, after: Collection) => () => {
    if (latestCollection.current !== after) { notify("Undo isn’t available: your collection has changed since."); return; }
    setCollection(before);
  }, []);
  const online = useOnline();
  // Decks added from a folder listing get their full details here, so they keep
  // filling in after the collection manager closes. A deck that cannot load for
  // good (private, gone, no commander) is dropped again, as it was never added
  // before; one that failed for now waits for the next start or reconnection.
  // App lasts as long as the page, so filling is never cancelled.
  const fill = useRef({ started: new Set<string>(), later: new Set<string>(), signal: new AbortController().signal });
  const [fillPass, setFillPass] = useState(0);
  useEffect(() => {
    if (!online || !fill.current.later.size) return;
    fill.current.later.forEach(id => fill.current.started.delete(id));
    fill.current.later.clear();
    setFillPass(n => n + 1);
  }, [online]);
  useEffect(() => {
    const queue = fill.current;
    const ids = online ? collection.added.filter(d => d.partial && !queue.started.has(d.id)).map(d => d.id) : [];
    if (!ids.length) return;
    ids.forEach(id => queue.started.add(id));
    const names = new Map(collection.added.map(d => [d.id, d.name]));
    const dropped: string[] = [];
    const reasons: string[] = [];
    void fillDecks(ids, loadFullDeck, {
      signal: queue.signal,
      onDeck: deck => {
        setCollection(c => fillDeck(c, deck));
        setDetail(current => current?.id === deck.id && current.partial ? deck : current);
      },
      onError: (id, error) => {
        if (error instanceof DeckLoadError && !error.retry) {
          dropped.push(id);
          reasons.push(`${names.get(id) || id}: ${error.message}`);
        } else queue.later.add(id);
      },
    }).then(() => {
      if (!dropped.length) return;
      setCollection(c => dropPartialDecks(c, dropped));
      setDetail(current => current && dropped.includes(current.id) ? null : current);
      notify(`${dropped.length === 1 ? "A deck" : `${dropped.length} decks`} could not be added. ${reasons.join(" ")}`, { tone: "problem" });
    });
  }, [collection.added, online, fillPass]);
  // A shared deck opened while its details were loading updates in place.
  useEffect(() => {
    setDetail(current => current?.partial ? shared.decks.find(deck => deck.id === current.id) ?? current : current);
  }, [shared.decks]);
  const updateReady = useUpdateReady();
  const [updateLater, setUpdateLater] = useState(false);
  useEffect(() => {
    if (isShared) { wasShared.current = true; return; }
    if (wasShared.current) {
      // Returning from a read-only shelf reads the current personal collection.
      // Neither the transition nor its state update may persist the old tab state.
      wasShared.current = false;
      const latest = readSaved();
      persistedCollection.current = latest.collection;
      setLoaded(latest);
      setCollection(latest.collection);
      setStorageError(latest.error);
      setStorageLocked(!!latest.error);
      return;
    }
    if (storageLocked || collection === persistedCollection.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      persistedCollection.current = collection;
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your collection. Export a backup before closing this page.",
      );
    }
  }, [collection, storageLocked, isShared]);
  const allDecks = useMemo(
    () => collectionDecks(collection, catalog),
    [collection],
  );
  // A friend's shelf uses the Library screens. Its choices are never saved into yours.
  const sharedBase = useMemo(
    () => shared.source ? shelfCollection({ source: shared.source, decks: shared.decks, folders: shared.folders }) : null,
    [shared.source, shared.decks, shared.folders],
  );
  const sharedWorkspace = useMemo(
    () => sharedBase && applyShelfView(sharedBase, shelfViews[sharedIdentity]),
    [sharedBase, shelfViews, sharedIdentity],
  );
  const setSharedWorkspace = (update: Collection | ((c: Collection) => Collection)) => {
    if (!sharedBase) return;
    setShelfViews(views => {
      const current = applyShelfView(sharedBase, views[sharedIdentity]);
      return putShelfView(views, sharedIdentity, shelfViewOf(typeof update === 'function' ? update(current) : update));
    });
  };
  const owned = useMemo(
    () => isShared ? (sharedWorkspace ? showcaseDecks(sharedWorkspace, [], shared.decks) : shared.decks) : showcaseDecks(collection, catalog, allDecks),
    [allDecks, collection, isShared, shared.decks, sharedWorkspace],
  );
  const tableSettings = useMemo(() => listSettings(collection), [collection.list]);
  // The List table's Collection column and the Collection name sort use these.
  const collectionNames = useMemo(() => deckCollections(showcaseGroups(collection, catalog, allDecks)), [allDecks, collection]);
  const visible = useMemo(
    () => sortCollectionDecks(sort, owned.filter((d) => matchesDeck(d, filters)), deck => ({ ...deck, collections: collectionNames.get(deck.id) })),
    [owned, filters, sort, collectionNames],
  );
  useEffect(() => setRefreshError(null), [detail?.id]);
  const [selecting, setSelecting] = useState(false);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [pickerFormat, setPickerFormat] = useState('commander');
  const selectionAnchor = useRef<string | null>(null);
  const browseNow = useRef({ filters, shortlist, sort });
  browseNow.current = { filters, shortlist, sort };
  function selectDeck(id: string, range: boolean) {
    const end = visible.findIndex(deck => deck.id === id);
    const start = range ? visible.findIndex(deck => deck.id === selectionAnchor.current) : -1;
    const ids = start < 0 ? [id] : visible.slice(Math.min(start, end), Math.max(start, end) + 1).map(deck => deck.id);
    setShortlist(current => current.includes(id) ? current.filter(key => !ids.includes(key)) : [...new Set([...current, ...ids])]);
    selectionAnchor.current = id;
  }
  const eligible = useMemo(
    () => pickerDecks(owned.filter(deck => matchesDeck(deck, { ...filters, format: pickerFormat })), pickerFormat, shortlist),
    [owned, filters, shortlist, pickerFormat],
  );
  const pickerScope = <div className="picker-scope-controls"><FormatSelect label="Pick format" value={pickerFormat} onChange={setPickerFormat} items={owned} disabled={spinning} /><span className="picker-scope-count" role="status">{eligible.length} eligible</span></div>;
  const browsingEligible = shortlist.length ? visible.filter(deck => shortlist.includes(deck.id)) : visible;
  const shortlistNumbers = new Map(visible.filter(deck => shortlist.includes(deck.id)).map((deck, index) => [deck.id, index + 1]));
  const sets = useMemo(
    () => [...new Set(owned.map((d) => d.set).filter(Boolean))].sort(),
    [owned],
  );
  // Tags offered are those in the format being browsed or picked.
  const tagFormat = view === 'picker' ? pickerFormat : filters.format;
  const tags = useMemo(
    () => tagCounts(owned.filter(deck => matchesDeck(deck, { ...EMPTY_FILTERS, format: tagFormat }))),
    [owned, tagFormat],
  );
  const [chipsOpen, setChipsOpen] = useState(false);
  const activeCount =
    Number(!!filters.query) +
    Number(!!filters.colors.length || filters.colorless) +
    Number(!!filters.set) +
    filters.tags.length +
    Number(!!filters.count) + Number(view !== 'picker' && filters.format !== 'commander');
  function changeFilters(next: Parameters<typeof setFilters>[0]) {
    if (help) {
      setHelp(null);
      selectView(HOME_VIEW);
    }
    setFilters(next);
  }
  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    changeFilters((f) => ({ ...f, [key]: value }));
  }
  function toggleTag(tag: string) {
    changeFilters(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  }
  function openPrecons() {
    if (isShared) leaveShared();
    setCollection(c => c.demo && !c.demo.removed ? c : addDemo(c, precons as { snapshotAt: string; decks: Deck[] }));
    setHelp(null);
    setPersonalStart(false);
    setCollectionSection("demo");
    setCollectionScope(null);
    setShowCollection(true);
  }
  // Commands from the Windows app's ≡ menu (desktop/main.mjs); the latest state handles each one.
  const menuCommand = useRef((_command: string) => {});
  menuCommand.current = (command) => {
    if (spinning) return;
    if (command === "backup") backup();
    else if (command === "help") { helpOpener.current = "help"; setShowCollection(false); setHelp("start"); }
    else if (["grid", "cards", "picker", "search", "collection"].includes(command)) goToFeature(command as FeatureTarget);
  };
  useEffect(() => onMenuCommand((command) => menuCommand.current(command)), []);
  function goToFeature(target: FeatureTarget) {
    setHelp(null);
    if (target === "collection" || target === "precons") {
      if (isShared) leaveShared();
      const present = !!collection.demo && !collection.demo.removed;
      setPersonalStart(false);
      setCollectionSection(target === "precons" && present ? "demo" : "overview");
      setCollectionScope(null);
      setShowCollection(true);
      return;
    }
    setShowCollection(false);
    if (target === "shortlist") setSelecting(true);
    selectView(target === "search" || target === "shortlist" ? "grid" : target);
    if (target === "search") requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".studio-search input")?.focus());
  }
  function selectView(next: View) {
    if (spinning) return;
    if (next === 'picker' && view !== 'picker') {
      const formats = [...new Set(browsingEligible.map(deck => formatOf(deck).id))];
      setPickerFormat(filters.format && filters.format !== 'all' ? filters.format : formats.length === 1 ? formats[0] : 'commander');
    }
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function refreshDeck(deck: Deck) {
    const epoch = collectionGeneration.current;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch(`/api/decks/${deck.id}?refresh=1`, {
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not refresh this deck.");
      if (!validateDeck(data) || data.id !== deck.id)
        throw new Error("The source returned incomplete deck information.");
      const updated = {
        ...data,
        theme: deck.theme || data.theme,
        originalUrl: deck.originalUrl,
      };
      if (epoch !== collectionGeneration.current) return;
      setCollection((c) => epoch !== collectionGeneration.current ? c : ({
        ...c,
        added: [...c.added.filter((d) => d.id !== deck.id), updated],
      }));
      setDetail((current) => (current?.id === deck.id ? updated : current));
      notify(`${updated.name} refreshed from Archidekt.`);
    } catch (error) {
      setRefreshError({ id: deck.id, message: `${(error as Error).message} Your saved deck is unchanged.` });
    } finally {
      setRefreshing(false);
    }
  }
  function retrySaving() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      setStorageError("");
      notify("Collection saved in this browser.");
    } catch {
      setStorageError("This browser still could not save your collection. Export a backup before closing this page.");
    }
  }
  function restoreCollection(value: Collection) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      throw new Error("The backup could not be saved. Your current collection is unchanged. Free browser storage or allow storage access, then try again.");
    }
    collectionGeneration.current++;
    sourceRefresh.invalidate();
    setCollection(value);
    setFirstVisit(false);
    setStorageLocked(false);
    setStorageError("");
  }
  function backup(recovery = false) {
    const url = URL.createObjectURL(
      new Blob([recovery && loaded.raw != null ? loaded.raw : JSON.stringify(collection, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = recovery ? "deckshelf-recovery-data.json" : "deckshelf-collection.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(recovery ? "Recovery data downloaded. This file may need repair before it can be restored." : "Collection backup downloaded. Display preferences are not included.");
  }
  const colorControls = (<div
            className="studio-color-controls"
            role="group"
            aria-label="Color identity"
          >
            <div className="inline-colors">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.name}
                  className={`color-button ${filters.colors.includes(c.id) ? "selected" : ""}`}
                  aria-label={`Filter ${c.name}`}
                  aria-pressed={filters.colors.includes(c.id)}
                  onClick={() =>
                    changeFilters((f) => ({
                      ...f,
                      colorless: false,
                      colors: f.colors.includes(c.id)
                        ? f.colors.filter((v) => v !== c.id)
                        : [...f.colors, c.id],
                    }))
                  }
                >
                  <ManaSymbol color={c.id} />
                </button>
              ))}
            </div>
            <label
              className="switch-label"
              title={
                filters.exact
                  ? "Exactly the selected colors, with no extras."
                  : "Must include every selected color; additional colors are allowed."
              }
            >
              <input
                type="checkbox"
                checked={filters.exact}
                onChange={(e) => updateFilter("exact", e.target.checked)}
              />
              <span className="switch" />
              Exact colors
            </label>
          </div>);
  const sharedName = shared.source?.name || sharedRoute.source?.value || 'Shared collection';
  const isKept = !!shared.source && kept.some(shelf => shelfId(shelf.source) === sharedIdentity);
  // A bookmark is instant and its snapshot fills in behind it. Save waits for every deck's details.
  const canSave = !!shared.source && owned.length > 0 && !shared.filling && !sharedSaved && !sharedSaving && !storageLocked;
  // One toggle: pressed once bookmarked, and pressing it again removes the bookmark.
  function toggleBookmark() {
    if (!shared.source || !shared.decks.length) return;
    if (isKept) removeBookmark(sharedIdentity);
    else changeKept(keepShelf(kept, { source: shared.source, decks: shared.decks, folders: shared.folders }));
  }
  // A bookmark made while details were loading takes the finished snapshot.
  useEffect(() => {
    if (!isKept || !shared.source || shared.filling || shared.loading) return;
    if (kept.find(shelf => shelfId(shelf.source) === sharedIdentity)?.decks.some(deck => deck.partial))
      changeKept(keepShelf(kept, { source: shared.source, decks: shared.decks, folders: shared.folders }));
  }, [isKept, shared.source, shared.filling, shared.loading, sharedIdentity]);
  async function saveShared() {
    if (!canSave) return;
    setSharedSaving(true);
    const identity = sharedIdentity;
    try {
      const next = await saveSharedCollectionWithLock(localStorage, STORAGE_KEY, shared.source!, owned, catalog,
        () => freshCollection(precons as { snapshotAt: string; decks: Deck[] }), undefined, shared.folders);
      // A queued Save may finish after the visitor has left this shelf.
      if (activeSharedIdentity.current !== identity) return;
      persistedCollection.current = next;
      setCollection(next);
      setSharedSaved(true);
      notify('Saved to your library. Refresh it there.');
    } catch (error) { notify((error as Error).message); }
    finally { setSharedSaving(false); }
  }
  // A loaded shared shelf: the header button, dock and read-only workspace follow it.
  const sharedShelf = isShared && !!shared.source && !shared.loading && !shared.error && shared.decks.length > 0;
  // Labels keep one width whatever the state; the icon and aria-pressed show it.
  const bookmarkIcon = (size: number) => isKept ? <BookmarkCheck size={size} /> : <BookmarkPlus size={size} />;
  const saveLabel = sharedSaved ? 'Saved to my library' : 'Save to my library';
  const saveTitle = sharedSaved ? 'Saved to your collection' : 'Add the decks you have on to your own collection';
  const shelfButtons = <>
    <button className={`button button-outline shelf-bookmark ${isKept ? 'is-marked' : ''}`} aria-pressed={isKept} aria-label="Bookmark this collection"
      title={isKept ? 'Bookmarked. Press again to remove the bookmark.' : 'Bookmark this collection so it stays one click away, and opens offline. Your own collection is not changed.'} onClick={toggleBookmark}>
      {bookmarkIcon(15)}<span>Bookmark</span></button>
    <button className="button button-outline shelf-secondary" aria-label="Share" onClick={() => setShowShare(true)}><Share2 size={15} /><span>Share</span></button>
    <button className="button button-gold shelf-secondary" disabled={!canSave} aria-label={saveLabel}
      title={saveTitle} onClick={saveShared}>{sharedSaved ? <Check size={15} /> : <Plus size={15} />}<span>{sharedSaved ? 'Saved' : 'Save to mine'}</span></button>
  </>;
  // A friend's shelf keeps its header quiet: Bookmark is on the menu's first row, and Share and
  // Save to mine are on their folders page. The menu's Mine row is the way back.
  const shelfMenu = <ShelfSwitcher
    current={isShared ? { id: sharedIdentity, name: shared.source?.name || sharedRoute.source?.value || "Shared" } : null}
    viewing={isShared && shared.source ? { source: shared.source, count: shared.decks.length } : null}
    kept={kept} recent={recent} personalCount={isShared ? showcaseDecks(collection, catalog, allDecks).length : owned.length} disabled={spinning}
    onPersonal={openPersonalShelf} onOpen={source => openSharedShelf(source, { stay: true })} onBookmark={bookmarkShelf} onUnbookmark={removeBookmark} />;
  const activeFilterChips = [
    view !== 'picker' && filters.format !== 'commander' && <button key="format" disabled={spinning} onClick={() => updateFilter('format', 'commander')}>{filters.format === 'all' ? 'All formats' : formatName(filters.format || 'commander')}<X size={12} /></button>,
    filters.query && <button key="query" disabled={spinning} onClick={() => updateFilter("query", "")}>“{filters.query}” <X size={12} /></button>,
    filters.colors.length > 0 && <button key="colors" disabled={spinning} onClick={() => updateFilter("colors", [])}>
      <Mana colors={filters.colors} size="mini" />{filters.exact ? "Exact colors" : "Includes all"} <X size={12} />
    </button>,
    filters.colorless && <button key="colorless" disabled={spinning} onClick={() => updateFilter("colorless", false)}>Colorless <X size={12} /></button>,
    filters.set && <button key="set" disabled={spinning} onClick={() => updateFilter("set", "")}>{filters.set} <X size={12} /></button>,
    ...filters.tags.map(tag => <button key={`tag:${tag}`} disabled={spinning} aria-label={`Remove tag ${tag}`} onClick={() => toggleTag(tag)}><Tag size={11} />{tag} <X size={12} /></button>),
    filters.count && <button key="count" disabled={spinning} onClick={() => updateFilter("count", "")}>{filters.count} colors <X size={12} /></button>,
  ].filter(Boolean);
  return (
    <CardBackContext.Provider value={collection.cardBack ?? "nest"}>
    <ArtworkContext.Provider value={!collection.hideArtwork}>
    <ListSettingsContext.Provider value={tableSettings}>
    <div
      className={`app-shell studio-theme ${revealed ? "winner-atmosphere" : ""}`}
    >
      <Atmosphere deck={pickerWinner} revealed={revealed} />
      <header className="studio-header">
        <div className="brand-cell">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setShowCollection(false);
            setHelp(null);
            selectView(HOME_VIEW);
          }}
          aria-label="DeckShelf home"
          title="Back to Collection"
          aria-disabled={spinning}
        >
          <img src="/brand-familiar.svg" alt="" />
          <span>
            Deck<span className="brand-sub">Shelf</span>
          </span>
        </a>
        {shelfMenu}
        </div>
        <div className="studio-nav" role="group" aria-label="Collection view">
          {(
            [
              { id: "grid", label: "Collection", Icon: LayoutGrid },
              { id: "cards", label: "Cards", Icon: CardFanIcon },
              { id: "picker", label: "Pick a deck", Icon: Dices },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-pressed={view === id && !help}
              className={view === id && !help ? "active" : ""}
              disabled={spinning}
              onClick={() => { setShowCollection(false); setHelp(null); selectView(id); }}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="header-actions">
          {firstVisit && !help && <FirstVisitHint
            disabled={spinning}
            onStart={startTour}
            onDismiss={dismissTour}
          />}
          {tourOpen && <TourPopover
            present={!!collection.demo && !collection.demo.removed}
            onPrecons={() => { setTourOpen(false); openPrecons(); }}
            onClose={closeTour}
          />}
          <span className="header-icons">
            <button
              className="button button-outline header-icon"
              ref={settingsTrigger}
              disabled={spinning}
              aria-label="Settings"
              title="Settings"
              aria-current={help === "settings" ? "page" : undefined}
              onClick={() => { helpOpener.current = "settings"; setShowCollection(false); setHelp("settings"); }}
            >
              <Settings size={18} />
            </button>
            <button
              className="button button-outline header-icon help-trigger"
              ref={helpTrigger}
              disabled={spinning}
              aria-label="Help"
              title="Help"
              aria-current={help && help !== "settings" ? "page" : undefined}
              onClick={() => { helpOpener.current = "help"; setShowCollection(false); setHelp("start"); }}
            >
              <CircleHelp size={18} />
            </button>
          </span>
          <button
            className="button button-outline header-collection"
            disabled={spinning}
            ref={collectionTrigger}
            aria-label={sharedShelf ? `${sharedName} library` : "Library"}
            data-friend={sharedShelf || undefined}
            onClick={openMyCollection}
          >
            <Library size={16} />
            {/* Library on every shelf; someone else's name shows once, by the people icon. */}
            <span>Library</span>
            <span className="count-badge">{sharedShelf ? owned.length : isShared ? showcaseDecks(collection, catalog, allDecks).length : owned.length}</span>
          </button>
        </div>
      </header>
      {/* Only a shelf that failed or came back empty needs this bar; while one loads, the page says so in place. */}
      {isShared && !sharedShelf && !shared.loading && <section className="shared-collection-bar shared-bar-slim" aria-label="Shared collection">
        <button className="shared-bar-back" aria-label="Back to my library" title="Back to my library" onClick={leaveShared}><ArrowLeft size={16} /><span>Mine</span></button>
        <p><strong>{sharedName}</strong><small role={shared.error ? "alert" : undefined}>{shared.loading ? 'Loading public decks…' : shared.error || 'No public decks found. The source may be empty, unavailable or private.'}</small></p>
      </section>}
      {showShare && <ShareCollection sources={isShared ? (shared.source ? [shared.source] : []) : collection.sources || []} onClose={() => setShowShare(false)} />}
      {storageError && (
        <div className="storage-warning" role="alert">
          <span>{storageError}</span>
          {!storageLocked && !isShared && <button className="text-button" onClick={retrySaving}>Retry saving</button>}
          {storageLocked && loaded.raw != null && <button className="text-button" onClick={() => backup(true)}>Download recovery data</button>}
          <button className="text-button" onClick={() => backup()}>
            Export backup
          </button>
        </div>
      )}
      {updateReady && !updateLater && (
        <div className="update-notice" role="status">
          A new version of DeckShelf is ready.
          <button className="text-button" onClick={applyUpdate}>
            Reload
          </button>
          <button className="text-button" onClick={() => setUpdateLater(true)}>
            Later
          </button>
        </div>
      )}
      {!showCollection && <div className={`studio-workspace ${help ? "utility-search" : ""}`}>
        <fieldset
          className="studio-toolbar"
          disabled={spinning}
          aria-label="Filter collection"
        >
          <label className="studio-search">
            <Search size={16} />
            <input
              aria-label="Search decks"
              placeholder={sharedShelf ? `Search ${sharedName}'s decks…` : "Search decks, commanders, or themes…"}
              value={filters.query}
              onChange={(e) => updateFilter("query", e.target.value)}
            />
            {filters.query && (
              <button
                aria-label="Clear search"
                onClick={() => updateFilter("query", "")}
              >
                <X size={14} />
              </button>
            )}
          </label>
          <div className="desktop-color-controls">{colorControls}</div>
          <div className="filter-dropdown" ref={filterDropdownRef}>
            <button
              className="button filters-trigger"
              ref={filterTriggerRef}
              onClick={() => setShowFilters((open) => !open)}
              aria-expanded={showFilters}
              aria-controls="collection-filters"
            >
              <SlidersHorizontal size={17} /> Filters{" "}
              {(filters.set ||
                filters.tags.length > 0 ||
                filters.count || (view !== 'picker' && filters.format !== 'commander') ||
                filters.colorless || filters.colors.length > 0 || filters.exact) && <span className="filter-dot" />}
              <ChevronDown size={14} />
            </button>
            {showFilters && (
              <div
                className="advanced-filters"
                id="collection-filters"
                role="region"
                aria-label="More filters"
              >
                <div className="filter-dropdown-heading">
                  <strong>More filters</strong>
                  <button
                    className="icon-button"
                    aria-label="Close filters"
                    onClick={() => {
                      setShowFilters(false);
                      filterTriggerRef.current?.focus();
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="phone-color-controls">{colorControls}</div>
                <p>
                  Combine with search and colors. Results update as you choose.
                </p>
                <fieldset disabled={spinning} className="filter-fieldset">
                  {view !== 'picker' && <FormatSelect label="Format" value={filters.format || 'commander'} onChange={value => updateFilter('format', value)} items={owned} all />}
                  <label className="small-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.colorless}
                      onChange={(e) =>
                        changeFilters((f) => ({
                          ...f,
                          colorless: e.target.checked,
                          colors: [],
                        }))
                      }
                    />{" "}
                    Colorless decks
                  </label>
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="set-filter">
                      Set / release
                    </label>
                    <div className="select-wrap">
                      <select
                        id="set-filter"
                        value={filters.set}
                        onChange={(e) => updateFilter("set", e.target.value)}
                      >
                        <option value="">All releases</option>
                        {sets.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  <TagFilter counts={tags} selected={filters.tags} onToggle={toggleTag} />
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="color-count">
                      Number of colors
                    </label>
                    <div className="select-wrap">
                      <select
                        id="color-count"
                        value={filters.count}
                        onChange={(e) => updateFilter("count", e.target.value)}
                      >
                        <option value="">Any combination</option>
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n === 0
                              ? "Colorless"
                              : n === 1
                                ? "One color"
                                : `${n} colors`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  <button
                    className="reset-button"
                    disabled={!activeCount}
                    onClick={() => changeFilters({ ...EMPTY_FILTERS })}
                  >
                    <X size={13} /> Clear filters{" "}
                    {activeCount > 0 && <span>{activeCount}</span>}
                  </button>
                </fieldset>
                <div className="filter-dropdown-footer" role="status">
                  {visible.length}{" "}
                  {visible.length === 1 ? "deck matches" : "decks match"}
                </div>
              </div>
            )}
          </div>
        </fieldset>
        {!help && <main>
          <section className="collection-section">
            <h1 className="sr-only">
              {view === "picker"
                ? "Deck picker"
                : view === "cards"
                  ? "Deck cards"
                  : isShared ? "Shared collection" : "Your collection"}
            </h1>
            <div className={`results-toolbar ${`view-${view}`}`}>
              <div>
                <span className="result-count" role="status">
                  {visible.length === owned.length
                    ? `${visible.length} ${visible.length === 1 ? "deck" : "decks"}`
                    : <>{visible.length} of {owned.length}<span className="count-unit"> decks</span></>}
                  {sharedShelf && shared.filling > 0 && ` · ${shared.filling} loading`}
                  {sharedShelf && shared.failed > 0 && ` · ${shared.failed} couldn’t load`}
                </span>
              </div>
              <QuickChoiceControls view={view} selecting={selecting} total={shortlist.length} eligible={view === 'picker' ? eligible.length : browsingEligible.length} busy={spinning}
                hasVisible={visible.length > 0} allSelected={visible.length > 0 && visible.every(d => shortlist.includes(d.id))}
                edit={() => { if (view === 'grid') setSelecting(value => !value); else { setSelecting(true); selectView('grid'); } }}
                pick={() => { setSelecting(false); selectView('picker'); }}
                clear={() => { setShortlist([]); setSelecting(false); selectionAnchor.current = null; }}
                toggleAll={() => setShortlist(current => visible.every(d => current.includes(d.id)) ? current.filter(id => !visible.some(d => d.id === id)) : [...new Set([...current, ...visible.map(d => d.id)])])} />
              {view === "grid" && (
                <CollectionViewControls display={display} onChange={setDisplay} sort={sort} onSort={setSort} />
              )}
            </div>
            {activeFilterChips.length > 0 && (
              <div className="active-filters" aria-label="Active filters">
                {chipsOpen || activeFilterChips.length <= CHIPS_FOLDED + 1 ? activeFilterChips : activeFilterChips.slice(0, CHIPS_FOLDED)}
                {activeFilterChips.length > CHIPS_FOLDED + 1 && (
                  <button className="active-filters-fold" aria-expanded={chipsOpen} onClick={() => setChipsOpen(v => !v)}>
                    {chipsOpen ? "Fewer" : `+${activeFilterChips.length - CHIPS_FOLDED} more`}
                  </button>
                )}
                {activeFilterChips.length > 1 && (
                  <button className="active-filters-clear" disabled={spinning} onClick={() => setFilters(f => ({ ...EMPTY_FILTERS, format: view === 'picker' ? f.format : EMPTY_FILTERS.format }))}>
                    Clear all
                  </button>
                )}
              </div>
            )}
            {view === "picker" ? (() => {
              const PickerView = presentation === "shuffle" ? ShufflePicker : Picker;
              return (
                <PickerView
                  key={presentation}
                  presentation={{ value: presentation, onChange: (next: Presentation) => { setPresentation(next); savePresentation(next); } }}
                  scopeControl={pickerScope} scopeLabel={formatName(pickerFormat)}
                  decks={eligible}
                  spinning={spinning}
                  setSpinning={setSpinning}
                  openDeck={setDetail}
                  onWinner={setPickerWinner}
                />
              );
            })() : visible.length ? (
              view === "cards" ? (
                <CardStudio
                  decks={visible}
                  openDeck={setDetail}
                />
              ) : display.layout === "list" ? (
                <DeckTable label="Your collection" sort={sort} onSort={setSort} size={display.size}
                  rows={visible.map((deck, index) => {
                    const selected = shortlistNumbers.get(deck.id) || 0;
                    const act = (shift: boolean) => selecting ? selectDeck(deck.id, shift) : setDetail(deck);
                    return {
                      deck: tableDeck(deck, collectionNames.get(deck.id)),
                      className: `collection-tile ${selected ? "is-shortlisted" : ""}`,
                      onActivate: event => act(event.shiftKey),
                      title: <button type="button" className="deck-table-title" onClick={e => act(e.shiftKey)}
                        aria-pressed={selecting ? !!selected : undefined}
                        aria-label={`${selecting ? "Select" : "View"} ${deck.name}`}>{deck.name}</button>,
                      mark: selected,
                      eager: index < 16,
                    };
                  })} />
              ) : (
                <div
                  key={visible.map((d) => d.id).join(",")}
                  className={`collection-grid collection-layout-${display.layout} collection-size-${display.size}`}
                  style={
                    {
                      "--collection-card-min": `${collectionTileSize(display.layout, display.size)}px`,
                      "--phone-columns": collectionPhoneColumns(display.layout, display.size),
                    } as CSSProperties
                  }
                >
                  {visible.map((deck, index) => (
                    <DeckTile
                      key={deck.id}
                      deck={deck}
                      index={index}
                      compact={display.layout === "compact"}
                      selecting={selecting}
                      selected={shortlistNumbers.get(deck.id) || 0}
                      activeTags={filters.tags}
                      onTag={toggleTag}
                      onOpen={() => setDetail(deck)}
                      onSelect={shift => selectDeck(deck.id, shift)}
                    />
                  ))}
                </div>
              )
            ) : isShared && shared.loading ? (
              <div className="empty-state" role="status"><Library size={32} strokeWidth={1} /><h3>Loading {sharedName}'s decks…</h3></div>
            ) : (
              <div className="empty-state">
                <Search size={32} strokeWidth={1} />
                <h3>
                  {owned.length ? "No decks match." : "No decks on display."}
                </h3>
                <p>
                  {owned.length
                    ? "Try another color, release, or search. Your decks are still here."
                    : "Enable a collection or select decks in Library."}
                </p>
                <button
                  className="button button-gold"
                  onClick={() =>
                    owned.length
                      ? changeFilters({ ...EMPTY_FILTERS })
                      : openMyCollection()
                  }
                >
                  {owned.length ? "Clear all filters" : "Choose decks"}
                </button>
              </div>
            )}
          </section>
        </main>}
      </div>
      }
      <Notices />
      {help && !showCollection && <HelpCenter
        section={help}
        onSection={setHelp}
        onClose={() => { setHelp(null); requestAnimationFrame(() => (helpOpener.current === "settings" ? settingsTrigger : helpTrigger).current?.focus()); }}
        onGo={goToFeature}
        precons={{ present: !!collection.demo && !collection.demo.removed, open: openPrecons }}
        settings={{
          value: { cardBack: collection.cardBack ?? "nest", hideArtwork: !!collection.hideArtwork, list: listSettings(collection), addNewDecks: !collection.followOff, addTurnsOn: !!collection.addTurnsOn },
          change: ({ hideArtwork, list, addNewDecks, addTurnsOn, ...rest }) => {
            if (addNewDecks !== undefined) sourceRefresh.invalidate();
            setCollection(({ hideArtwork: was, list: wasList, followOff: wasOff, addTurnsOn: wasTurnsOn, ...c }) => {
              // Only choices that differ from the defaults are saved.
              const nextList = list ? parseListSettings(list) : wasList;
              const off = addNewDecks === undefined ? wasOff : !addNewDecks;
              return { ...c, ...rest, ...((hideArtwork ?? was) ? { hideArtwork: true as const } : {}), ...(nextList ? { list: nextList } : {}), ...(off ? { followOff: true as const } : {}), ...((addTurnsOn ?? wasTurnsOn) ? { addTurnsOn: true as const } : {}) };
            });
          },
        }}
      />}
      {detail && (
        <Modal
          title="Deck details"
          onClose={() => setDetail(null)}
          wide
        >
          <div className="deck-detail">
            <div
              className={`detail-cards ${detail.commanders.length > 1 ? "partners" : ""}`}
            >
              {(detail.commanders.length ? detail.commanders : [coverOf(detail)]).map((c) => (
                <div key={c.name}>
                  <Artwork src={c.image} alt={c.name} colors={detail.colors} eager />
                  {detail.cover?.kind !== 'fallback' && !detail.partial && <span>Illustration by {c.artist || "artist unlisted"}</span>}
                </div>
              ))}
            </div>
            <div className="detail-copy">
              <span className="detail-set">{formatOf(detail).name}{detail.set ? ` · ${detail.set}` : ''}</span>
              <h2>{detail.name}</h2>
              <Mana colors={detail.colors} />
              <p className="detail-commander">
                {detail.partial ? 'Loading details from Archidekt…' : detail.commanders.map((c) => c.name).join(" & ") || (detail.cover?.kind === 'featured' ? `Featured card · ${coverOf(detail).name}` : 'No cover selected · Set a featured card on Archidekt')}
              </p>
              {detail.theme && <p className="detail-theme">{detail.theme}</p>}
              {detail.tags.length > 0 && <div className="tag-list" role="group" aria-label="Tags">
                {detail.tags.map((t) => (
                  <button key={t} type="button" aria-pressed={filters.tags.includes(t)} title={`Show decks tagged ${t}`} onClick={() => { toggleTag(t); setDetail(null); }}><Tag size={11} />{t}</button>
                ))}
              </div>}
              {detail.description && (
                <p className="source-description">
                  {descriptionParts(detail.description).map((part, i) =>
                    part.card ? <strong key={i}>{part.text}</strong> : part.text,
                  )}
                </p>
              )}
              {!detail.partial && <div className="detail-facts">
                <span>
                  <strong>{detail.cardCount}</strong> cards
                </span>
                <span>
                  {detail.releasedAt
                    ? new Date(
                        detail.releasedAt +
                          (detail.releasedAt.includes("T") ? "" : "T12:00:00"),
                      ).toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })
                    : "Release not listed"}
                </span>
              </div>}
              <div className="detail-actions">
              <a
                className="button button-gold"
                href={detail.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                View deck on {detail.sourceName} <ExternalLink size={15} />
              </a>
              <button
                className="button button-outline refresh-source"
                disabled={refreshing || !online || isShared}
                onClick={() => refreshDeck(detail)}
              >
                <RefreshCw size={15} className={refreshing ? "refreshing" : ""} />
                {refreshing ? "Refreshing…" : "Refresh snapshot"}
              </button>
              </div>
              {detail.originalUrl &&
                detail.originalUrl !== detail.sourceUrl && (
                  <a
                    className="text-button original-link"
                    href={detail.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Original reference <ExternalLink size={12} />
                  </a>
                )}
              {!online && (
                <p className="source-note">
                  You're offline. Refresh when you're connected.
                </p>
              )}
              {refreshError?.id === detail.id && (
                <p className="inline-error" role="alert">
                  {refreshError.message}
                </p>
              )}
              {!detail.partial && <p className="source-note">
                Saved snapshot · {" "}
                {new Date(detail.fetchedAt).toLocaleDateString("en-GB")}
              </p>}
            </div>
          </div>
        </Modal>
      )}
      {showCollection && sharedShelf && sharedWorkspace && (
        <CollectionManager
          key={`${sharedIdentity}:${collectionVisit}`}
          readOnly={{ name: sharedName, actions: shelfButtons }}
          // Someone else's shelf is never checked from here, and your choices stay on this device.
          sourceRefresh={sourceRefresh}
          followEnabled={false}
          catalog={[]}
          decks={shared.decks}
          collection={sharedWorkspace}
          setCollection={setSharedWorkspace}
          initialSection="overview"
          onLocationChange={() => {}}
          onRestore={() => {}}
          onClose={() => { setShowCollection(false); requestAnimationFrame(() => collectionTrigger.current?.focus()); }}
          backup={() => {}}
          notify={notify}
          undoTo={() => () => {}}
          onShare={() => setShowShare(true)}
        />
      )}
      {/* While a friend's shelf loads, its folders page says so; your own folders never stand in for it. */}
      {showCollection && isShared && shared.loading && (
        <main className="collection-workspace" aria-label={`${sharedName} folders`}><div className="empty-state" role="status"><Library size={32} strokeWidth={1} /><h3>Loading {sharedName}'s decks…</h3></div></main>
      )}
      {showCollection && !isShared && (
        <CollectionManager
          sourceRefresh={sourceRefresh}
          followEnabled={followEnabled}
          key={collectionVisit}
          catalog={catalog}
          decks={allDecks}
          collection={collection}
          setCollection={setCollection}
          startPersonal={personalStart}
          initialSection={collectionSection}
          initialScope={collectionScope}
          onLocationChange={(section, scope) => { setCollectionSection(section); setCollectionScope(scope); }}
          onRestore={restoreCollection}
          onClose={() => { setShowCollection(false); requestAnimationFrame(() => collectionTrigger.current?.focus()); }}
          backup={() => backup()}
          notify={notify}
          undoTo={undoTo}
          onShare={() => setShowShare(true)}
          onBrowse={openSharedShelf}
          overviewExtra={<OtherCollections kept={kept} recent={recent} onOpen={openSharedShelf} onBookmark={bookmarkShelf} onUnbookmark={removeBookmark}
            onForget={id => setRecent(list => list.filter(ref => shelfId(ref) !== id))} />}
        />
      )}
    </div>
    </ListSettingsContext.Provider>
    </ArtworkContext.Provider>
    </CardBackContext.Provider>
  );
}

function DeckTile({
  deck,
  index,
  compact,
  selecting,
  selected,
  activeTags,
  onTag,
  onOpen,
  onSelect,
}: {
  deck: Deck;
  index: number;
  compact: boolean;
  selecting: boolean;
  selected: number;
  activeTags: string[];
  onTag: (tag: string) => void;
  onOpen: () => void;
  onSelect: (shift: boolean) => void;
}) {
  return (
    <article
      className={`collection-tile ${selected ? "is-shortlisted" : ""}`}
      style={{ "--order": Math.min(index, 11) } as CSSProperties}
    >
      <button
        className="collection-card"
        onPointerMove={tiltCard}
        onPointerLeave={resetTilt}
        onClick={e => selecting ? onSelect(e.shiftKey) : onOpen()}
        aria-pressed={selecting ? !!selected : undefined}
        aria-label={`${selecting ? "Select" : "View"} ${deck.name}`}
        title={compact ? deck.name : undefined}
      >
        {selected > 0 && <span className="shortlist-mark" aria-hidden="true">{String(selected).padStart(2, "0")}</span>}
        <Artwork
          src={(compact && coverOf(deck).art) || coverOf(deck).image}
          alt={coverOf(deck).name}
          colors={deck.colors}
          eager={index < 8}
        />
        {formatOf(deck).id !== 'commander' && <span className="deck-format">{formatOf(deck).name}</span>}
      </button>
      <div className="collection-caption">
        <button className="collection-deck-title" onClick={e => selecting ? onSelect(e.shiftKey) : onOpen()} aria-pressed={selecting ? !!selected : undefined}>
          {deck.name}
          <ExternalLink size={14} />
        </button>
        <div className="collection-deck-meta">
          <span title={deck.set ? `${formatOf(deck).name} · ${deck.set}` : formatOf(deck).name}>{formatOf(deck).id === 'commander' ? deck.set.replace(" Commander", "") : formatOf(deck).name}</span>
          <Mana colors={deck.colors} />
        </div>
        <div className="collection-deck-bottom">
          {deck.tags.length ? <span className="deck-tags">
            {deck.tags.slice(0, 3).map(tag => <button key={tag} type="button" aria-pressed={activeTags.includes(tag)} title={`Show decks tagged ${tag}`} onClick={() => onTag(tag)}>{tag}</button>)}
          </span> : <span>{deck.theme}</span>}
        </div>
      </div>
    </article>
  );
}

export default App;
