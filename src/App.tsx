import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  BookOpen,
  LayoutGrid,
  List,
  GalleryVerticalEnd,
  Library,
  Search,
  SlidersHorizontal,
  Dices,
  RefreshCw,
  X,
} from "lucide-react";
import seed from "./data/decks.json";
import precons from "./data/precons.json";
import {
  COLORS,
  EMPTY_COLLECTION,
  EMPTY_FILTERS,
  matchesDeck,
  parseCollection,
  validateDeck,
  type Collection,
  type Deck,
  type Filters,
} from "./domain";
import { Artwork, Mana, ManaSymbol, Modal } from "./components";
import { CardFanIcon } from "./CardFanIcon";
import Picker from "./HelixPicker";
import CardStudio from "./CardStudio";
import CollectionGuide from "./CollectionGuide";
import CollectionManager from "./CollectionManager";
import { showcaseDecks, collectionDecks, freshCollection, addDemo } from "./collection";
import { Atmosphere, tiltCard, resetTilt } from "./Atmosphere";

const catalog = seed as Deck[];
const STORAGE_KEY = "commander-archive.collection.v1";
type View = "cards" | "grid" | "picker";
const HOME_VIEW: View = "grid";
type CollectionLayout = "grid" | "art" | "list";
const DISPLAY_KEY = "commander-archive.display.v1";
function readDisplay(): { layout: CollectionLayout; size: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(DISPLAY_KEY) || "null");
    return {
      layout: ["grid", "art", "list"].includes(saved?.layout)
        ? saved.layout
        : "art",
      size:
        Number.isInteger(saved?.size) && saved.size >= 0 && saved.size <= 2
          ? saved.size
          : 1,
    };
  } catch {
    return { layout: "art", size: 1 };
  }
}
function readSaved(): { collection: Collection; error: string; raw?: string | null } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return {
      collection: raw !== null ? parseCollection(raw) : freshCollection(precons as { snapshotAt: string; decks: Deck[] }),
      error: "",
    };
  } catch {
    return {
      collection: { ...EMPTY_COLLECTION },
      raw,
      error:
        "Your saved collection could not be read. The starter collection is shown temporarily; the saved data has not been overwritten. Export it for recovery, or restore a valid backup to resume saving.",
    };
  }
}

function App() {
  const [loaded] = useState(readSaved);
  const [collection, setCollection] = useState<Collection>(loaded.collection);
  const [storageError, setStorageError] = useState(loaded.error);
  const [storageLocked, setStorageLocked] = useState(!!loaded.error);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [view, setView] = useState<View>(HOME_VIEW);
  const [pickerControlsTarget, setPickerControlsTarget] = useState<HTMLDivElement | null>(null);
  const [display, setDisplay] = useState(readDisplay);
  useEffect(() => {
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
    } catch {
      /* Session controls still work when storage is unavailable. */
    }
  }, [display]);
  const [pickerWinner, setPickerWinner] = useState<Deck | null>(null);
  const revealed = !!pickerWinner;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [sort, setSort] = useState("collection");
  const [detail, setDetail] = useState<Deck | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [personalStart, setPersonalStart] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [collectionSection, setCollectionSection] = useState("overview");
  const [showAbout, setShowAbout] = useState(false);
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
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (storageLocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your collection. Export a backup before closing this page.",
      );
    }
  }, [collection, storageLocked]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(timer);
  }, [notice]);
  const allDecks = useMemo(
    () => collectionDecks(collection, catalog),
    [collection],
  );
  const owned = useMemo(
    () => showcaseDecks(collection, catalog, allDecks),
    [allDecks, collection],
  );
  const visible = useMemo(() => {
    const decks = owned.filter((d) => matchesDeck(d, filters));
    if (sort === "name") decks.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "release")
      decks.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
    if (sort === "colors")
      decks.sort(
        (a, b) =>
          a.colors.length - b.colors.length || a.name.localeCompare(b.name),
      );
    return decks;
  }, [owned, filters, sort]);
  useEffect(() => setRefreshError(""), [detail?.id]);
  const eligible = useMemo(
    () => visible.filter((d) => !collection.excluded.includes(d.id)),
    [visible, collection.excluded],
  );
  const sets = useMemo(
    () => [...new Set(owned.map((d) => d.set))].sort(),
    [owned],
  );
  const tags = useMemo(
    () => [...new Set(owned.flatMap((d) => d.tags))].sort(),
    [owned],
  );
  const activeCount =
    Number(!!filters.query) +
    Number(!!filters.colors.length || filters.colorless) +
    Number(!!filters.set) +
    Number(!!filters.tag) +
    Number(!!filters.count);
  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function exclude(id: string) {
    setCollection((c) => ({
      ...c,
      excluded: c.excluded.includes(id)
        ? c.excluded.filter((v) => v !== id)
        : [...c.excluded, id],
    }));
  }
  function selectView(next: View) {
    if (spinning) return;
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function refreshDeck(deck: Deck) {
    setRefreshing(true);
    setRefreshError("");
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
      setCollection((c) => ({
        ...c,
        added: [...c.added.filter((d) => d.id !== deck.id), updated],
      }));
      setDetail((current) => (current?.id === deck.id ? updated : current));
      setNotice(`${updated.name} refreshed from Archidekt.`);
    } catch (error) {
      setRefreshError(
        `${(error as Error).message} Your saved deck is unchanged.`,
      );
    } finally {
      setRefreshing(false);
    }
  }
  function backup() {
    const url = URL.createObjectURL(
      new Blob([storageLocked && loaded.raw !== null && loaded.raw !== undefined ? loaded.raw : JSON.stringify(collection, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "commander-archive-collection.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Collection backup downloaded.");
  }
  return (
    <div
      className={`app-shell studio-theme ${revealed ? "winner-atmosphere" : ""}`}
    >
      <Atmosphere deck={pickerWinner} revealed={revealed} />
      <header className="studio-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
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
              aria-pressed={view === id}
              className={view === id ? "active" : ""}
              disabled={spinning}
              onClick={() => selectView(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="header-actions">
          <button
            className="icon-button about-button"
            aria-label="Help and about DeckShelf"
            title="About DeckShelf"
            onClick={() => setShowAbout(true)}
          >
            <Info size={18} />
          </button>
          <button className="button button-outline guide-trigger" onClick={() => setShowGuide(true)}><BookOpen size={16} /><span>Guide</span></button>
          <button
            className="button button-outline"
            disabled={spinning}
            onClick={() => { setPersonalStart(false); setCollectionSection("overview"); setShowCollection(true); }}
          >
            <Library size={16} />
            <span>My collection</span>
            <span className="count-badge">{owned.length}</span>
          </button>
        </div>
      </header>
      {storageError && (
        <div className="storage-warning" role="alert">
          {storageError}{" "}
          <button className="text-button" onClick={backup}>
            Export backup
          </button>
        </div>
      )}
      <div className="studio-workspace">
        <fieldset
          className="studio-toolbar"
          disabled={spinning}
          aria-label="Filter collection"
        >
          <label className="studio-search">
            <Search size={16} />
            <input
              aria-label="Search decks"
              placeholder="Search decks, commanders, or themes…"
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
          <div
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
                    setFilters((f) => ({
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
          </div>
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
                filters.tag ||
                filters.count ||
                filters.colorless) && <span className="filter-dot" />}
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
                <p>
                  Combine with search and colors. Results update as you choose.
                </p>
                <fieldset disabled={spinning} className="filter-fieldset">
                  <label className="small-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.colorless}
                      onChange={(e) =>
                        setFilters((f) => ({
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
                  <div className="filter-group">
                    <label className="filter-label" htmlFor="theme-filter">
                      Theme / playstyle
                    </label>
                    <div className="select-wrap">
                      <select
                        id="theme-filter"
                        value={filters.tag}
                        onChange={(e) => updateFilter("tag", e.target.value)}
                      >
                        <option value="">Every way to play</option>
                        {tags.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
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
                    onClick={() => setFilters({ ...EMPTY_FILTERS })}
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
        <main>
          <section className="collection-section">
            <h1 className="sr-only">
              {view === "picker"
                ? "Deck picker"
                : view === "cards"
                  ? "Commander cards"
                  : "Your collection"}
            </h1>
            <div className="results-toolbar">
              <div>
                <span className="result-count" role="status">
                  {visible.length === owned.length
                    ? `${visible.length} ${visible.length === 1 ? "deck" : "decks"}`
                    : `${visible.length} of ${owned.length} decks`}
                  {eligible.length !== visible.length && (
                    <>
                      <span className="separator-dot">·</span>
                      <span>{eligible.length} in picker</span>
                    </>
                  )}
                </span>
              </div>
              <div className="picker-controls-slot" ref={setPickerControlsTarget} />
              {view === "grid" && (
                <div className="collection-view-controls collection-display-toolbar">
                  <div
                    className="collection-layout-switch"
                    role="group"
                    aria-label="Collection layout"
                  >
                    {(
                      [
                        ["grid", "Details", LayoutGrid],
                        ["art", "Cards only", GalleryVerticalEnd],
                        ["list", "List", List],
                      ] as const
                    ).map(([layout, label, Icon]) => (
                      <button
                        key={layout}
                        title={label}
                        aria-label={label}
                        aria-pressed={display.layout === layout}
                        onClick={() => setDisplay((d) => ({ ...d, layout }))}
                      >
                        <Icon size={14} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <label className="collection-size-control">
                    <span>Size</span>
                    <input
                      type="range"
                      aria-label="Collection item size"
                      aria-valuetext={
                        ["Small", "Medium", "Large"][display.size]
                      }
                      min="0"
                      max="2"
                      step="1"
                      value={display.size}
                      onChange={(e) =>
                        setDisplay((d) => ({
                          ...d,
                          size: Number(e.target.value),
                        }))
                      }
                    />
                    <span className="size-value">
                      {["S", "M", "L"][display.size]}
                    </span>
                  </label>
                  <label className="sort-label">
                    <ArrowDownUp size={13} />
                    <span className="sr-only">Sort decks</span>
                    <select
                      aria-label="Sort decks"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="collection">Collection order</option>
                      <option value="name">Name: A–Z</option>
                      <option value="release">Newest releases</option>
                      <option value="colors">Number of colors</option>
                    </select>
                    <ChevronDown size={12} />
                  </label>
                </div>
              )}
            </div>
            {!!activeCount && (
              <div className="active-filters" aria-label="Active filters">
                {filters.query && (
                  <button
                    onClick={() => updateFilter("query", "")}
                    disabled={spinning}
                  >
                    “{filters.query}” <X size={12} />
                  </button>
                )}
                {filters.colors.length > 0 && (
                  <button
                    disabled={spinning}
                    onClick={() => updateFilter("colors", [])}
                  >
                    <Mana colors={filters.colors} size="mini" />
                    {filters.exact ? "Exact colors" : "Includes all"}{" "}
                    <X size={12} />
                  </button>
                )}
                {filters.colorless && (
                  <button
                    disabled={spinning}
                    onClick={() => updateFilter("colorless", false)}
                  >
                    Colorless <X size={12} />
                  </button>
                )}
                {(["set", "tag", "count"] as const)
                  .filter((k) => filters[k])
                  .map((k) => (
                    <button
                      key={k}
                      disabled={spinning}
                      onClick={() => updateFilter(k, "")}
                    >
                      {k === "count" ? `${filters[k]} colors` : filters[k]}{" "}
                      <X size={12} />
                    </button>
                  ))}
              </div>
            )}
            {view === "picker" ? (
              <Picker
                controlsTarget={pickerControlsTarget}
                decks={eligible}
                spinning={spinning}
                setSpinning={setSpinning}
                openDeck={setDetail}
                onWinner={setPickerWinner}
              />
            ) : visible.length ? (
              view === "cards" ? (
                <CardStudio
                  decks={visible}
                  openDeck={setDetail}
                  chooseDeck={() => selectView("picker")}
                />
              ) : (
                <div
                  key={visible.map((d) => d.id).join(",")}
                  className={`collection-grid collection-layout-${display.layout} collection-size-${display.size}`}
                  style={
                    {
                      "--collection-card-min": `${[150, 210, 280][display.size]}px`,
                      "--collection-thumbnail": `${[48, 66, 86][display.size]}px`,
                    } as CSSProperties
                  }
                >
                  {visible.map((deck, index) => (
                    <DeckTile
                      key={deck.id}
                      deck={deck}
                      index={index}
                      excluded={collection.excluded.includes(deck.id)}
                      onOpen={() => setDetail(deck)}
                      onExclude={() => exclude(deck.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="empty-state">
                <Search size={32} strokeWidth={1} />
                <h3>
                  {owned.length ? "No decks match." : "No decks on display."}
                </h3>
                <p>
                  {owned.length
                    ? "Try another color, release, or search. Your decks are still here."
                    : "Enable a collection or select decks in My collection."}
                </p>
                <button
                  className="button button-gold"
                  onClick={() =>
                    owned.length
                      ? setFilters({ ...EMPTY_FILTERS })
                      : setShowCollection(true)
                  }
                >
                  {owned.length ? "Clear all filters" : "Choose decks"}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {detail && (
        <Modal
          title="From your collection"
          onClose={() => setDetail(null)}
          wide
        >
          <div className="deck-detail">
            <div
              className={`detail-cards ${detail.commanders.length > 1 ? "partners" : ""}`}
            >
              {detail.commanders.map((c) => (
                <div key={c.name}>
                  <Artwork src={c.image} alt={c.name} eager />
                  <span>Illustration by {c.artist || "artist unlisted"}</span>
                </div>
              ))}
            </div>
            <div className="detail-copy">
              <span className="eyebrow">{detail.set}</span>
              <h2>{detail.name}</h2>
              <Mana colors={detail.colors} />
              <p className="detail-commander">
                {detail.commanders.map((c) => c.name).join(" & ")}
              </p>
              {detail.theme && <p className="detail-theme">{detail.theme}</p>}
              <div className="tag-list">
                {detail.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              {detail.description && (
                <p className="source-description">{detail.description}</p>
              )}
              <div className="detail-facts">
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
              </div>
              <a
                className="button button-gold"
                href={detail.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                View deck on {detail.sourceName} <ExternalLink size={15} />
              </a>
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
              <button
                className="text-button refresh-source"
                disabled={refreshing}
                onClick={() => refreshDeck(detail)}
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "refreshing" : ""}
                />
                {refreshing ? "Refreshing…" : "Refresh from Archidekt"}
              </button>
              {refreshError && (
                <p className="inline-error" role="alert">
                  {refreshError}
                </p>
              )}
              <p className="source-note">
                Decklists live at the source. This is your window into them.
                <br />
                Snapshot saved{" "}
                {new Date(detail.fetchedAt).toLocaleDateString("en-GB")}.
              </p>
            </div>
          </div>
        </Modal>
      )}
      {showCollection && (
        <CollectionManager
          catalog={catalog}
          decks={allDecks}
          collection={collection}
          setCollection={setCollection}
          startPersonal={personalStart}
          initialSection={collectionSection}
          onRestore={(value) => { setStorageLocked(false); setCollection(value); }}
          onClose={() => setShowCollection(false)}
          backup={backup}
          notify={setNotice}
        />
      )}
      {showGuide && <CollectionGuide
        present={!!collection.demo && !collection.demo.removed}
        onClose={() => setShowGuide(false)}
        onPrecons={() => {
          setCollection(c => c.demo && !c.demo.removed ? c : addDemo(c, precons as { snapshotAt: string; decks: Deck[] }));
          setShowGuide(false);
          setPersonalStart(false);
          setCollectionSection("demo");
          setShowCollection(true);
        }}
      />}
      {showAbout && (
        <Modal
          title="About DeckShelf"
          onClose={() => setShowAbout(false)}
        >
          <div className="about-copy">
            <p className="about-lead">Your decks, ready for game night.</p>
            <ul className="about-points">
              <li><strong>Showcase your collection.</strong> Browse the artwork or pick a deck at random.</li>
              <li><strong>Make it yours.</strong> Mix public Archidekt decks with official precons. Choose what’s shown.</li>
              <li><strong>No account needed.</strong> Choices are saved in this browser. Export a backup to keep a copy.</li>
              <li><strong>Run it locally, too.</strong> Source imports and new artwork need internet. Edit decklists on Archidekt.</li>
            </ul>
            <div className="about-actions">
              <button className="button button-gold" onClick={() => { setShowAbout(false); setPersonalStart(false); setCollectionSection("overview"); setShowCollection(true); }}>My collection <ArrowRight size={16} /></button>
              <button className="button button-outline" onClick={() => { setShowAbout(false); setShowGuide(true); }}>Quick guide</button>
            </div>
            <div className="about-credits">
              <a
                href="https://archidekt.com/commander-precons"
                target="_blank"
                rel="noreferrer"
              >
                Deck information: Archidekt <ExternalLink size={12} />
              </a>
              <span>
                Magic: The Gathering and card imagery © their respective
                owners. This is an unofficial fan project.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DeckTile({
  deck,
  index,
  excluded,
  onOpen,
  onExclude,
}: {
  deck: Deck;
  index: number;
  excluded: boolean;
  onOpen: () => void;
  onExclude: () => void;
}) {
  return (
    <article
      className={`collection-tile ${excluded ? "deck-excluded" : ""}`}
      style={{ "--order": Math.min(index, 11) } as CSSProperties}
    >
      <button
        className="collection-card"
        onPointerMove={tiltCard}
        onPointerLeave={resetTilt}
        onClick={onOpen}
        aria-label={`View ${deck.name}`}
      >
        <Artwork
          src={deck.commanders[0].image}
          alt={deck.commanders[0].name}
          eager={index < 8}
        />
      </button>
      <div className="collection-caption">
        <button className="collection-deck-title" onClick={onOpen}>
          {deck.name}
          <ExternalLink size={14} />
        </button>
        <div className="collection-deck-meta">
          <span title={deck.set}>{deck.set.replace(" Commander", "")}</span>
          <Mana colors={deck.colors} />
        </div>
        <div className="collection-deck-bottom">
          <span>{deck.theme || deck.tags.slice(0, 2).join(" · ")}</span>
          <button
            className={`collection-eligibility ${excluded ? "is-excluded" : ""}`}
            title={excluded ? "Include in picker" : "Exclude from picker"}
            aria-label={`${excluded ? "Include" : "Exclude"} ${deck.name} ${excluded ? "in" : "from"} picker`}
            aria-pressed={!excluded}
            onClick={onExclude}
          >
            {excluded ? <EyeOff size={14} /> : <Dices size={14} />}
            <span>{excluded ? "Excluded" : "In picker"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default App;
