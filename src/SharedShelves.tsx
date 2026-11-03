import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, Check, ChevronDown, Folder, Library, Plus, UserRound, X } from "lucide-react";
import { Artwork } from "./components";
import { shelfId, shelfRef, type KeptShelf, type ShelfRef } from "./shelves";
import { parseShelfInput, type SharedSource } from "./share-links";
import "./shelves.css";

const kindLabel = (kind: SharedSource["kind"]) => kind === "account" ? "Archidekt account" : "Archidekt folder";
const decks = (count: number) => `${count} ${count === 1 ? "deck" : "decks"}`;

// Opens someone's public collection read-only, exactly as a share link would.
export function OpenShelfForm({ onOpen, autoFocus = false, label = "Open a collection" }: { onOpen: (source: SharedSource) => void; autoFocus?: boolean; label?: string }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try { onOpen(parseShelfInput(value)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Enter an Archidekt username or link."); }
  };
  return <form className="shelf-open" onSubmit={submit} noValidate>
    <label htmlFor={id}>{label}</label>
    <div className="shelf-open-line">
      <input id={id} value={value} onChange={event => { setValue(event.target.value); setError(""); }} placeholder="Archidekt username or link"
        autoFocus={autoFocus} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={!!error} aria-describedby={`${id}-note`} />
      <button type="submit" aria-label="Open this collection" title="Open this collection"><ArrowRight size={16} /></button>
    </div>
    <small id={`${id}-note`} className={error ? "shelf-open-error" : ""} role={error ? "alert" : undefined}>{error || "Read-only. Nothing is added to your collection."}</small>
  </form>;
}

// A dropdown that closes on Escape or on anything outside it.
function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (event.target instanceof Node && !root.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { close(); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
}

// Bookmarked shelves first, then recently viewed ones that aren't bookmarked.
const otherShelves = (kept: KeptShelf[], recent: ShelfRef[]) => {
  const keptIds = new Set(kept.map(shelf => shelfId(shelf.source)));
  return { bookmarked: kept.map(shelf => shelfRef(shelf, shelf.keptAt)), viewed: recent.filter(ref => !keptIds.has(shelfId(ref))) };
};

// One switcher beside the brand: your own collection, bookmarked shelves and recently viewed ones.
export function ShelfSwitcher({ current, viewing, kept, recent = [], personalCount, disabled, onPersonal, onOpen, onForget, onForgetRecent, actions, showOpen = false }: {
  current: { id: string; name: string } | null;
  viewing: { source: SharedSource & { name: string }; count: number } | null;
  kept: KeptShelf[]; recent?: ShelfRef[]; personalCount: number; disabled: boolean;
  onPersonal: () => void; onOpen: (source: SharedSource) => void; onForget: (id: string) => void; onForgetRecent?: (id: string) => void;
  actions?: ReactNode; showOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), root, trigger);
  const go = (run: () => void) => { setOpen(false); run(); };
  const keptIds = new Set(kept.map(shelf => shelfId(shelf.source)));
  // With the recent list, the shelf being viewed is already its first entry.
  const unkept = viewing && !keptIds.has(shelfId(viewing.source)) && !recent.length ? viewing : null;
  const viewed = recent.filter(ref => !keptIds.has(shelfId(ref))).slice(0, 5);
  const row = (id: string | null, name: string, count: number, kind: SharedSource["kind"] | null, run: () => void, note?: string, forget: ((id: string) => void) | null = onForget, marked = false) =>
    <li key={id || "mine"} className={current?.id === id || (!current && !id) ? "is-current" : ""}>
      <button type="button" aria-current={current?.id === id || (!current && !id) ? "true" : undefined} onClick={() => go(run)}>
        {marked ? <BookmarkCheck size={15} /> : kind === null ? <Library size={15} /> : kind === "account" ? <UserRound size={15} /> : <Folder size={15} />}
        <span>{name}<small>{note || decks(count)}</small></span>
        {(current?.id === id || (!current && !id)) && <Check size={15} className="shelf-current-mark" />}
      </button>
      {id && forget && <button type="button" className="shelf-forget" aria-label={`Remove ${name} from the switcher`} title="Remove from the switcher. Your own collection is not changed." onClick={() => forget(id)}><X size={14} /></button>}
    </li>;
  return <div className="shelf-switch" ref={root}>
    <button ref={trigger} type="button" className="shelf-switch-trigger" disabled={disabled} aria-expanded={open} aria-haspopup="true"
      aria-label={`Showing ${current?.name || "Mine"}. Switch collection`} onClick={() => setOpen(value => !value)}>
      <span>{current?.name || "Mine"}</span><ChevronDown size={14} />
    </button>
    {open && <div className="shelf-switch-menu" role="group" aria-label="Collections">
      {/* The shown shelf's actions, so its bar can stay hidden. */}
      {actions && current && <div className="shelf-switch-actions" onClick={() => setOpen(false)}>
        <small>{current.name} · read-only</small><div>{actions}</div>
      </div>}
      <ul>
        {row(null, "Mine", personalCount, null, onPersonal, `Your saved collection · ${decks(personalCount)}`)}
        {kept.map(shelf => row(shelfId(shelf.source), shelf.source.name, shelf.decks.length, shelf.source.kind, () => onOpen(shelf.source), `Bookmarked · ${decks(shelf.decks.length)}`, onForget, true))}
        {unkept && row(shelfId(unkept.source), unkept.source.name, unkept.count, unkept.source.kind, () => onOpen(unkept.source), `Not bookmarked · ${decks(unkept.count)}`, null)}
      </ul>
      {viewed.length > 0 && <><h4>Recently viewed</h4><ul>
        {viewed.map(ref => row(shelfId(ref), ref.name, ref.count, ref.kind, () => onOpen(ref), `Viewed · ${decks(ref.count)}`, onForgetRecent ?? null))}
      </ul></>}
      {showOpen && <div className="shelf-switch-open"><OpenShelfForm onOpen={source => go(() => onOpen(source))} /></div>}
    </div>}
  </div>;
}

// PROTOTYPE (#128): every collection as a chip under the header, one click apart.
export function ShelfStrip({ currentId, kept, recent, disabled, onPersonal, onOpen, onAdd }: {
  currentId: string; kept: KeptShelf[]; recent: ShelfRef[]; disabled: boolean;
  onPersonal: () => void; onOpen: (source: SharedSource) => void; onAdd: () => void;
}) {
  const { bookmarked, viewed } = otherShelves(kept, recent);
  if (!bookmarked.length && !viewed.length && !currentId) return null;
  const chip = (id: string, label: string, run: () => void, icon: ReactNode, quiet = false) =>
    <button key={id || "mine"} type="button" className={`shelf-chip ${quiet ? "is-quiet" : ""}`} disabled={disabled} aria-current={id === currentId ? "true" : undefined} onClick={run}>{icon}<span>{label}</span></button>;
  return <nav className="shelf-strip" aria-label="Switch collection">
    {chip("", "Mine", onPersonal, <Library size={14} />)}
    {bookmarked.map(ref => chip(shelfId(ref), ref.name, () => onOpen(ref), <BookmarkCheck size={14} />))}
    {viewed.map(ref => chip(shelfId(ref), ref.name, () => onOpen(ref), <UserRound size={14} />, true))}
    <button type="button" className="shelf-chip is-add" disabled={disabled} aria-label="Open someone's collection" title="Open someone's collection" onClick={onAdd}><Plus size={14} /></button>
  </nav>;
}

// PROTOTYPE (#128): the same list in the My collection sidebar, on your shelf and on a friend's.
export function ShelfList({ currentId, kept, recent, personalCount, onPersonal, onOpen }: {
  currentId: string; kept: KeptShelf[]; recent: ShelfRef[]; personalCount: number;
  onPersonal: () => void; onOpen: (source: SharedSource) => void;
}) {
  const { bookmarked, viewed } = otherShelves(kept, recent);
  const row = (id: string, name: string, count: number, run: () => void, icon: ReactNode) =>
    <li key={id || "mine"}><button type="button" aria-current={id === currentId ? "true" : undefined} onClick={run}>{icon}<span>{name}</span><small>{count}</small></button></li>;
  return <nav className="shelf-list" aria-label="Switch collection">
    <h3>Collections</h3>
    <ul>
      {row("", "Mine", personalCount, onPersonal, <Library size={15} />)}
      {bookmarked.map(ref => row(shelfId(ref), ref.name, ref.count, () => onOpen(ref), <BookmarkCheck size={15} />))}
    </ul>
    {viewed.length > 0 && <><h4>Recently viewed</h4><ul>
      {viewed.map(ref => row(shelfId(ref), ref.name, ref.count, () => onOpen(ref), <UserRound size={15} />))}
    </ul></>}
  </nav>;
}

// Other people's collections, in My collection: bookmarks first, then recently viewed.
export function OtherCollections({ kept, recent, currentId = "", openRef, onOpen, onBookmark, onUnbookmark, onForget }: {
  kept: KeptShelf[]; recent: ShelfRef[]; currentId?: string; openRef?: RefObject<HTMLElement | null>;
  onOpen: (source: SharedSource) => void; onBookmark: (ref: ShelfRef) => void; onUnbookmark: (ref: ShelfRef) => void; onForget: (id: string) => void;
}) {
  const { bookmarked, viewed } = otherShelves(kept, recent);
  const tile = (ref: ShelfRef, marked: boolean) => {
    const Icon = ref.kind === "account" ? UserRound : Folder;
    return <article key={shelfId(ref)} className={`collection-box recent-shelf ${shelfId(ref) === currentId ? "is-current" : ""}`}>
      <button className="collection-box-cover" aria-label={`Open ${ref.name}`} onClick={() => onOpen(ref)}>
        {ref.art.length ? <span className="collection-box-art" aria-hidden="true">{ref.art.map(src => <Artwork key={src} src={src} alt="" colors={[]} />)}</span>
          : <span className="collection-box-empty"><Icon size={28} /><span>No artwork</span></span>}
        <span className="collection-box-open" aria-hidden="true"><ArrowUpRight size={17} /></span>
      </button>
      <div className="collection-box-body">
        <div className="overview-group-top"><button className="overview-group-title" onClick={() => onOpen(ref)}>{ref.name}</button>
          <span className="recent-shelf-actions">
            <button className={`icon-button shelf-forget ${marked ? "is-marked" : ""}`} aria-pressed={marked} aria-label={marked ? `Remove the bookmark for ${ref.name}` : `Bookmark ${ref.name}`} title={marked ? "Remove bookmark" : "Bookmark"}
              onClick={() => marked ? onUnbookmark(ref) : onBookmark(ref)}>{marked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
            {!marked && <button className="icon-button shelf-forget" aria-label={`Remove ${ref.name} from recently viewed`} title="Remove from this list" onClick={() => onForget(shelfId(ref))}><X size={14} /></button>}
          </span></div>
        <small>{kindLabel(ref.kind)} · {decks(ref.count)} · {marked ? "Bookmarked" : "Viewed"}</small>
      </div>
    </article>;
  };
  return <section className="recent-shelves" aria-label="Other collections" ref={openRef}>
    <div className="overview-intro"><div><h3>Other collections</h3></div></div>
    <div className="recent-shelves-grid">
      {bookmarked.map(ref => tile(ref, true))}
      {viewed.map(ref => tile(ref, false))}
      <article className="collection-box shelf-add-tile"><OpenShelfForm label="Open someone's collection" onOpen={onOpen} /></article>
    </div>
  </section>;
}
