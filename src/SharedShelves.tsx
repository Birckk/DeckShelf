import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, ChevronDown, Folder, Library, Plus, UserRound, X } from "lucide-react";
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

// One switcher beside the brand, only for moving around: your collection, bookmarks, recent shelves.
export function ShelfSwitcher({ current, viewing, kept, recent = [], personalCount, disabled, art, onPersonal, onOpen, onBookmark, onUnbookmark }: {
  current: { id: string; name: string } | null;
  viewing: { source: SharedSource & { name: string }; count: number } | null;
  kept: KeptShelf[]; recent?: ShelfRef[]; personalCount: number; disabled: boolean;
  // PROTOTYPE (#128, option B): a square of the shelf's own commander art before its name.
  art?: string;
  onPersonal: () => void; onOpen: (source: SharedSource) => void; onBookmark: (source: SharedSource & { name: string }) => void; onUnbookmark: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); setAdding(false); };
  useDismiss(open, close, root, trigger);
  // The row that was clicked goes away with the menu, so focus returns to the switcher.
  const go = (run: () => void) => { close(); run(); requestAnimationFrame(() => trigger.current?.focus()); };
  const keptIds = new Set(kept.map(shelf => shelfId(shelf.source)));
  // On someone's shelf, that shelf leads the menu, so its bookmark is the first thing under the name.
  const currentId = viewing ? shelfId(viewing.source) : "";
  const viewed = recent.filter(ref => !keptIds.has(shelfId(ref)) && shelfId(ref) !== currentId).slice(0, 5);
  const row = (source: (SharedSource & { name: string }) | null, name: string, count: number) => {
    const id = source && shelfId(source);
    const isCurrent = current?.id === id || (!current && !id);
    const marked = !!id && keptIds.has(id);
    return <li key={id || "mine"} className={isCurrent ? "is-current" : ""}>
      <button type="button" aria-current={isCurrent ? "true" : undefined} onClick={() => go(() => source ? onOpen(source) : onPersonal())}>
        {!source ? <Library size={15} /> : source.kind === "account" ? <UserRound size={15} /> : <Folder size={15} />}
        <span>{name}<small>{decks(count)}{isCurrent && source ? " · Read-only" : ""}</small></span>
      </button>
      {source && <button type="button" className={`shelf-forget ${marked ? "is-marked" : ""}`} aria-pressed={marked} aria-label={marked ? `Remove the bookmark for ${name}` : `Bookmark ${name}`} title={marked ? "Remove bookmark" : "Bookmark"}
        onClick={() => marked ? onUnbookmark(id!) : onBookmark(source)}>{marked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>}
    </li>;
  };
  return <div className="shelf-switch" ref={root}>
    <button ref={trigger} type="button" className="shelf-switch-trigger" disabled={disabled} aria-expanded={open} aria-haspopup="true"
      aria-label={current ? `Showing ${current.name}, read-only. Switch collection` : "Showing Mine. Switch collection"} onClick={() => open ? close() : setOpen(true)}>
      {art && <img className="shelf-switch-art" src={art} alt="" />}
      <span>{current?.name || "Mine"}</span><ChevronDown size={14} />
    </button>
    {open && <div className="shelf-switch-menu" role="group" aria-label="Collections">
      <ul>
        {viewing && row(viewing.source, viewing.source.name, viewing.count)}
        {row(null, "Mine", personalCount)}
        {kept.filter(shelf => shelfId(shelf.source) !== currentId).map(shelf => row(shelf.source, shelf.source.name, shelf.decks.length))}
      </ul>
      {viewed.length > 0 && <><h4>Recently viewed</h4><ul>
        {viewed.map(ref => row(ref, ref.name, ref.count))}
      </ul></>}
      {adding
        ? <div className="shelf-switch-open"><OpenShelfForm autoFocus onOpen={source => go(() => onOpen(source))} /></div>
        : <button type="button" className="shelf-open-row" onClick={() => setAdding(true)}><Plus size={15} />Open a collection…</button>}
    </div>}
  </div>;
}

// Other people's collections, in My collection: bookmarks first, then recently viewed.
export function OtherCollections({ kept, recent, currentId = "", onOpen, onBookmark, onUnbookmark, onForget }: {
  kept: KeptShelf[]; recent: ShelfRef[]; currentId?: string;
  onOpen: (source: SharedSource) => void; onBookmark: (source: SharedSource & { name: string }) => void; onUnbookmark: (id: string) => void; onForget: (id: string) => void;
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
              onClick={() => marked ? onUnbookmark(shelfId(ref)) : onBookmark(ref)}>{marked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
            {!marked && <button className="icon-button shelf-forget" aria-label={`Remove ${ref.name} from recently viewed`} title="Remove from this list" onClick={() => onForget(shelfId(ref))}><X size={14} /></button>}
          </span></div>
        <small>{kindLabel(ref.kind)} · {decks(ref.count)} · {marked ? "Bookmarked" : "Viewed"}</small>
      </div>
    </article>;
  };
  return <section className="recent-shelves" aria-label="Other collections">
    <div className="overview-intro"><div><h3>Other collections</h3></div></div>
    <div className="recent-shelves-grid">
      {bookmarked.map(ref => tile(ref, true))}
      {viewed.map(ref => tile(ref, false))}
      <article className="collection-box shelf-add-tile"><OpenShelfForm label="Open someone's collection" onOpen={onOpen} /></article>
    </div>
  </section>;
}
