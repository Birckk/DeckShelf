import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Folder,
  Library,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Unplug,
  Upload,
  UserRound,
  X,
  LayoutGrid,
} from "lucide-react";
import { Artwork, Mana, Modal } from "./components";
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
  showcaseGroups,
  showcaseDecks,
  enableGroup,
  onlyGroup,
  sourceDeckIds,
  selectSourceDecks,
  disconnectSource,
} from "./collection";
import CollectionOverview from "./CollectionOverview";
import "./collection.css";

type Props = {
  decks: Deck[];
  catalog: Deck[];
  collection: Collection;
  setCollection: (update: Collection | ((c: Collection) => Collection)) => void;
  onClose: () => void;
  backup: () => void;
  notify: (message: string) => void;
};
async function jsonRequest(path: string, signal: AbortSignal) {
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
}: Props) {
  const [section, setSection] = useState("overview");
  const [connecting, setConnecting] = useState(false);
  const [kind, setKind] = useState<"account" | "folder" | "deck">("account");
  const [value, setValue] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [restorePreview, setRestorePreview] = useState<Collection | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const sources = collection.sources || [];
  const source = sources.find((s) => s.key === section);
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
  const sourceIds = new Set(source ? sourceDeckIds(source, decks) : []);
  const isSavedHere = (id: string) =>
    saved.has(id) && (!source || sourceIds.has(id));
  const rows: SourceEntry[] = source
    ? [
        ...source.entries,
        ...decks
          .filter(
            (d) =>
              sourceIds.has(d.id) && !source.entries.some((e) => e.id === d.id),
          )
          .map(toEntry),
      ]
    : (section === "starter"
        ? catalog.map((d) => saved.get(d.id) || d)
        : section === "manual"
          ? manual
          : decks
      ).map(toEntry);
  const shown = rows.filter((row) => {
    const deck = saved.get(row.id);
    const text = [row.name, ...(deck?.commanders.map((c) => c.name) || [])]
      .join(" ")
      .toLowerCase();
    const display = isSavedHere(row.id) && onDisplayIds.has(row.id);
    return (
      text.includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "shown" && display) ||
        (status === "hidden" && isSavedHere(row.id) && !display) ||
        (status === "new" && !isSavedHere(row.id)))
    );
  });
  const newRows = shown.filter((row) => !isSavedHere(row.id));
  function navigate(next: string) {
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
      const parsed = parseSourceInput(value, kind);
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
        if (sources.length >= 50 && !sources.some((s) => s.key === parsed.key))
          throw new Error("You can link up to 50 sources.");
        const found = await loadSource(parsed.kind, parsed.value, signal);
        signal.throwIfAborted();
        setCollection(
          rememberSource(collection, { ...found, selectedIds: [] }),
        );
        navigate(found.key);
        notify(
          `${found.entries.length} public Commander decks found. Choose which to show.`,
        );
      }
      setValue("");
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
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
              `${saved.get(id)?.name || rows.find((r) => r.id === id)?.name || id}: ${(e as Error).message}`,
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
        saveSnapshots(collection, loaded, true),
        accepted.map((d) => d.id),
        true,
      );
      setCollection(
        source
          ? selectSourceDecks(
              next,
              source.key,
              accepted.map((d) => d.id),
              decks,
            )
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
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose a backup smaller than 5 MB.");
      setRestorePreview(parseCollection(await file.text()));
      setError("");
    } catch (e) {
      report(e);
    }
    event.target.value = "";
  }
  function disconnect() {
    if (!source) return;
    setCollection((c) => disconnectSource(c, source.key, catalog, decks));
    navigate("overview");
    notify("Source disconnected. Saved decks and display choices were kept.");
  }
  async function browsePrecons() {
    const key = "account:archidekt_precons";
    if (sources.some((s) => s.key === key)) {
      navigate(key);
      return;
    }
    const signal = begin("Loading Archidekt’s precon catalog…");
    try {
      if (sources.length >= 50)
        throw new Error("You can link up to 50 sources.");
      const found = await loadSource("account", "Archidekt_Precons", signal);
      signal.throwIfAborted();
      setCollection(rememberSource(collection, { ...found, selectedIds: [] }));
      navigate(key);
    } catch (e) {
      report(e);
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal title="My collection" onClose={onClose} wide>
      <div className="collection-manager">
        <header className="manager-heading">
          <div>
            <h2>Your decks, on display.</h2>
            <p>
              {onDisplay} on display <span>·</span> {sources.length} linked{" "}
              {sources.length === 1 ? "source" : "sources"}
            </p>
          </div>
          <button
            className="button button-gold"
            onClick={() => {
              setConnecting(true);
              setError("");
              setFailures([]);
            }}
            disabled={!!busy}
          >
            <Plus size={16} /> Add decks
          </button>
        </header>
        <div className="manager-body">
          <label className="manager-mobile-nav">
            Collection source
            <select
              value={section}
              disabled={!!busy}
              onChange={(e) => navigate(e.target.value)}
            >
              <option value="overview">Showcase overview</option>
              <option value="all">All saved decks ({decks.length})</option>
              <option value="starter">
                Included precons ({catalog.length})
              </option>
              <option value="manual">Individual decks ({manual.length})</option>
              {sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name} · {s.kind} ({s.entries.length})
                </option>
              ))}
            </select>
          </label>
          <nav className="manager-nav" aria-label="Collection sources">
            <button
              aria-current={
                section === "overview" && !connecting ? "page" : undefined
              }
              disabled={!!busy}
              onClick={() => navigate("overview")}
            >
              <LayoutGrid size={16} />
              <span>Showcase overview</span>
            </button>
            <button
              aria-current={
                section === "all" && !connecting ? "page" : undefined
              }
              disabled={!!busy}
              onClick={() => navigate("all")}
            >
              <Library size={16} />
              <span>All saved decks</span>
              <small>{decks.length}</small>
            </button>
            <button
              aria-current={
                section === "starter" && !connecting ? "page" : undefined
              }
              disabled={!!busy}
              onClick={() => navigate("starter")}
            >
              <Folder size={16} />
              <span>Included precons</span>
              <small>{catalog.length}</small>
            </button>
            <button
              aria-current={
                section === "manual" && !connecting ? "page" : undefined
              }
              disabled={!!busy}
              onClick={() => navigate("manual")}
            >
              <Link2 size={16} />
              <span>Individual decks</span>
              <small>{manual.length}</small>
            </button>
            <span className="manager-nav-label">Linked sources</span>
            {!sources.length && (
              <p className="manager-nav-hint">
                Connect an account or folder, or add deck links individually.
              </p>
            )}
            {sources.map((s) => (
              <button
                key={s.key}
                title={s.name}
                aria-current={
                  section === s.key && !connecting ? "page" : undefined
                }
                disabled={!!busy}
                onClick={() => navigate(s.key)}
              >
                {s.kind === "folder" ? (
                  <Folder size={16} />
                ) : (
                  <UserRound size={16} />
                )}
                <span>
                  {s.name}
                  <small>{s.kind === "folder" ? "Folder" : "Account"}</small>
                </span>
                <small>{s.entries.length}</small>
              </button>
            ))}
          </nav>
          <section
            className="manager-content"
            aria-label="Manage collection decks"
          >
            {connecting ? (
              <form className="manager-connect" onSubmit={connect}>
                <button
                  type="button"
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => {
                    setConnecting(false);
                    setError("");
                  }}
                >
                  <ArrowLeft size={14} /> Back to decks
                </button>
                <h3>Add from Archidekt</h3>
                <p>
                  Choose a public account or folder to follow, or add a deck by
                  its link. Decklists stay on Archidekt.
                </p>
                <div
                  className="manager-kinds"
                  role="group"
                  aria-label="Source type"
                >
                  {(
                    [
                      ["account", "Account", UserRound],
                      ["folder", "Folder", Folder],
                      ["deck", "Deck link", Link2],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={kind === id}
                      disabled={!!busy}
                      onClick={() => setKind(id)}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  ))}
                </div>
                <label htmlFor="collection-source-input">
                  {kind === "account"
                    ? "Username or profile link"
                    : kind === "folder"
                      ? "Folder link or ID"
                      : "Deck link or ID"}
                </label>
                <div className="manager-input-line">
                  <input
                    id="collection-source-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={
                      kind === "account"
                        ? "Username or https://archidekt.com/u/…"
                        : `https://archidekt.com/${kind === "folder" ? "folders" : "decks"}/…`
                    }
                    required
                    disabled={!!busy}
                  />
                  <button className="button button-gold" disabled={!!busy}>
                    {busy || (kind === "deck" ? "Add deck" : "Find decks")}
                  </button>
                </div>
                <p className="manager-note">
                  {kind === "folder"
                    ? "Reads decks directly inside this folder. Link subfolders separately."
                    : kind === "account"
                      ? "Finds public Commander decks across this account. You choose which are on display."
                      : "A local selection of external decks. No connected account needed."}
                </p>
                <div className="manager-connect-foot">
                  <Check size={16} />
                  <span>
                    No sign-in or password. Connections are read-only; your
                    choices are saved in this browser.
                  </span>
                </div>
              </form>
            ) : section === "overview" ? (
              <CollectionOverview
                groups={groups}
                collection={collection}
                decks={decks}
                busy={!!busy}
                navigate={navigate}
                toggle={(key, enabled) =>
                  setCollection((c) => enableGroup(c, key, enabled))
                }
                only={(key) => setCollection((c) => onlyGroup(c, key, groups))}
                enableAll={() =>
                  setCollection((c) => ({ ...c, disabledGroups: [] }))
                }
                browsePrecons={browsePrecons}
              />
            ) : (
              <>
                <div className="manager-section-heading">
                  <div>
                    <h3>
                      {activeGroup?.name ||
                        (section === "starter"
                          ? "Included precons"
                          : section === "manual"
                            ? "Individual decks"
                            : "All saved decks")}
                    </h3>
                    <p>
                      {source
                        ? `${source.kind === "folder" ? "Folder · direct decks only" : "Archidekt account"} · Checked ${new Date(source.checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                        : section === "starter"
                          ? "The original 29 decks from your supplied list, bundled with local artwork. This is not the full precon catalog."
                          : section === "manual"
                            ? "Added by link, or kept after disconnecting a source."
                            : "Saved locally. Show what you own; choose what goes in the picker."}
                    </p>
                  </div>
                  {source && (
                    <a
                      className="icon-button"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open source on Archidekt"
                    >
                      <ExternalLink size={17} />
                    </a>
                  )}
                </div>
                {activeGroup && (
                  <div className="manager-group-control">
                    <label className="overview-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`Enable ${activeGroup.name}`}
                        checked={activeGroup.enabled}
                        disabled={!!busy}
                        onChange={(e) =>
                          setCollection((c) =>
                            enableGroup(c, activeGroup.key, e.target.checked),
                          )
                        }
                      />
                      <span>
                        {activeGroup.enabled
                          ? "Collection enabled"
                          : "Collection off — selections kept"}
                      </span>
                    </label>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() =>
                        setCollection((c) =>
                          onlyGroup(c, activeGroup.key, groups),
                        )
                      }
                    >
                      Only this collection
                    </button>
                  </div>
                )}
                {section === "starter" && (
                  <div className="manager-precon-link">
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={browsePrecons}
                    >
                      Browse Archidekt’s full precon catalog{" "}
                      <ArrowLeft
                        size={12}
                        style={{ transform: "rotate(180deg)" }}
                      />
                    </button>
                  </div>
                )}
                <p className="manager-selection-note">
                  Select individual decks below. Collection switches control
                  whether those selections appear; picker choices are kept when
                  a collection is off.
                </p>
                {source && (
                  <div className="manager-source-actions">
                    <button
                      className="button button-outline"
                      disabled={!!busy}
                      onClick={refreshSource}
                    >
                      <RefreshCw size={14} /> Refresh source
                    </button>
                    <span>New decks wait for your selection.</span>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={disconnect}
                      title="Disconnect source; keep saved decks"
                    >
                      <Unplug size={14} /> Disconnect
                    </button>
                  </div>
                )}
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
                    {source && <option value="new">Not added</option>}
                  </select>
                </div>
                <div className="manager-bulk">
                  <span>
                    {shown.length} {shown.length === 1 ? "deck" : "decks"}
                  </span>
                  {newRows.length > 0 && (
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() =>
                        setSelected((ids) => [
                          ...new Set([...ids, ...newRows.map((d) => d.id)]),
                        ])
                      }
                    >
                      Select new decks
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={!!busy || !shown.some((d) => isSavedHere(d.id))}
                    onClick={() =>
                      setCollection((c) =>
                        setShown(
                          c,
                          shown
                            .filter((d) => isSavedHere(d.id))
                            .map((d) => d.id),
                          true,
                        ),
                      )
                    }
                  >
                    Select saved
                  </button>
                  <button
                    className="text-button"
                    disabled={!!busy || !shown.some((d) => isSavedHere(d.id))}
                    onClick={() =>
                      setCollection((c) =>
                        setShown(
                          c,
                          shown
                            .filter((d) => isSavedHere(d.id))
                            .map((d) => d.id),
                          false,
                        ),
                      )
                    }
                  >
                    Deselect saved
                  </button>
                </div>
                <div className="manager-list">
                  <div className="manager-columns">
                    <span>Deck</span>
                    <span>Selected</span>
                    <span>Picker</span>
                  </div>
                  {shown.map((row) => {
                    const deck = saved.get(row.id);
                    const displaying =
                      isSavedHere(row.id) &&
                      !collection.hidden.includes(row.id);
                    const member = isSavedHere(row.id);
                    const missing =
                      !!source &&
                      !!deck &&
                      !source.entries.some((e) => e.id === row.id);
                    return (
                      <div
                        key={row.id}
                        className={`manager-row ${deck && !displaying ? "is-hidden" : ""}`}
                      >
                        <div className="manager-deck">
                          {deck?.commanders[0].art || row.image ? (
                            <Artwork
                              src={deck?.commanders[0].art || row.image}
                              alt=""
                            />
                          ) : (
                            <div className="manager-art-placeholder">
                              <Library size={20} />
                            </div>
                          )}
                          <div>
                            <a
                              href={
                                deck?.sourceUrl ||
                                `https://archidekt.com/decks/${row.id}`
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              {deck?.name || row.name}
                              <ExternalLink size={11} />
                            </a>
                            <small>
                              {missing
                                ? "No longer listed · saved copy kept"
                                : !member
                                  ? "Not selected for this collection"
                                  : !onDisplayIds.has(row.id) && displaying
                                    ? "Collection off · selection kept"
                                    : deck?.commanders
                                        .map((c) => c.name)
                                        .join(" & ") ||
                                      "Not added · details load when selected"}
                            </small>
                            <Mana
                              colors={deck?.colors || row.colors}
                              size="mini"
                            />
                          </div>
                        </div>
                        <label className="manager-toggle">
                          <input
                            type="checkbox"
                            disabled={!!busy}
                            aria-label={`${member ? "Show" : "Select"} ${row.name}`}
                            checked={
                              member ? displaying : selected.includes(row.id)
                            }
                            onChange={(e) =>
                              member
                                ? setCollection((c) =>
                                    setShown(c, [row.id], e.target.checked),
                                  )
                                : setSelected((ids) =>
                                    e.target.checked
                                      ? [...ids, row.id]
                                      : ids.filter((id) => id !== row.id),
                                  )
                            }
                          />
                          <span>{member ? "Show" : "Add"}</span>
                        </label>
                        <label className="manager-toggle">
                          <input
                            type="checkbox"
                            disabled={!!busy || !displaying}
                            aria-label={`Include ${row.name} in picker`}
                            checked={
                              displaying &&
                              !collection.excluded.includes(row.id)
                            }
                            onChange={(e) =>
                              setCollection((c) => ({
                                ...c,
                                excluded: e.target.checked
                                  ? c.excluded.filter((id) => id !== row.id)
                                  : [...new Set([...c.excluded, row.id])],
                              }))
                            }
                          />
                          <span>Pick</span>
                        </label>
                      </div>
                    );
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
              </>
            )}
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
            className="manager-restore"
            role="region"
            aria-label="Restore collection backup"
          >
            <div>
              <strong>Replace this local collection?</strong>
              <p>
                The backup has {restorePreview.added.length} imported decks and{" "}
                {restorePreview.sources?.length || 0} linked sources. Export
                your current backup first if you want to keep it.
              </p>
            </div>
            <button
              className="button button-gold"
              disabled={!!busy}
              onClick={() => {
                setCollection(restorePreview);
                setRestorePreview(null);
                navigate("all");
                notify("Collection restored from backup.");
              }}
            >
              Restore this backup
            </button>
            <button
              className="icon-button"
              aria-label="Cancel restore"
              onClick={() => setRestorePreview(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </Modal>
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
