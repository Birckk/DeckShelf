import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Folder, Library, Search, UserRound, UserRoundSearch, X } from "lucide-react";
import { Artwork } from "./components";
import { shelfId, type KeptShelf, type ShelfRef } from "./shelves";
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

const finePointer = () => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;

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

// PROTOTYPE (#128): the header icon variant.
export function OpenShelfIcon({ disabled, onOpen }: { disabled: boolean; onOpen: (source: SharedSource) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), root, trigger);
  return <span className="shelf-open-icon" ref={root}>
    <button ref={trigger} className="button button-outline header-icon" disabled={disabled} aria-expanded={open} aria-label="Open someone's collection" title="Open someone's collection" onClick={() => setOpen(value => !value)}><UserRoundSearch size={18} /></button>
    {open && <div className="shelf-switch-menu"><OpenShelfForm autoFocus={finePointer()} onOpen={source => { setOpen(false); onOpen(source); }} /></div>}
  </span>;
}

// One switcher beside the brand: your own collection, kept shelves and recently viewed ones.
export function ShelfSwitcher({ current, viewing, kept, recent = [], personalCount, disabled, onPersonal, onOpen, onForget, onForgetRecent, actions, openForm = null }: {
  current: { id: string; name: string } | null;
  viewing: { source: SharedSource & { name: string }; count: number } | null;
  kept: KeptShelf[]; recent?: ShelfRef[]; personalCount: number; disabled: boolean;
  onPersonal: () => void; onOpen: (source: SharedSource) => void; onForget: (id: string) => void; onForgetRecent?: (id: string) => void;
  actions?: ReactNode; openForm?: "box" | "row" | null;
}) {
  const [open, setOpen] = useState(false);
  const [rowOpen, setRowOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => { setOpen(false); setRowOpen(false); }, root, trigger);
  const go = (run: () => void) => { setOpen(false); setRowOpen(false); run(); };
  const form = (focus: boolean) => <OpenShelfForm autoFocus={focus} onOpen={source => go(() => onOpen(source))} />;
  const keptIds = new Set(kept.map(shelf => shelfId(shelf.source)));
  // With the recent list, the shelf being viewed is already its first entry.
  const unkept = viewing && !keptIds.has(shelfId(viewing.source)) && !recent.length ? viewing : null;
  const viewed = recent.filter(ref => !keptIds.has(shelfId(ref))).slice(0, 5);
  const row = (id: string | null, name: string, count: number, kind: SharedSource["kind"] | null, run: () => void, note?: string, forget: ((id: string) => void) | null = onForget) =>
    <li key={id || "mine"} className={current?.id === id || (!current && !id) ? "is-current" : ""}>
      <button type="button" aria-current={current?.id === id || (!current && !id) ? "true" : undefined} onClick={() => go(run)}>
        {kind === null ? <Library size={15} /> : kind === "account" ? <UserRound size={15} /> : <Folder size={15} />}
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
      {openForm === "box" && form(finePointer())}
      <ul>
        {row(null, "Mine", personalCount, null, onPersonal, `Your saved collection · ${decks(personalCount)}`)}
        {kept.map(shelf => row(shelfId(shelf.source), shelf.source.name, shelf.decks.length, shelf.source.kind, () => onOpen(shelf.source), `Kept · ${decks(shelf.decks.length)}`))}
        {unkept && row(shelfId(unkept.source), unkept.source.name, unkept.count, unkept.source.kind, () => onOpen(unkept.source), `Not kept · ${decks(unkept.count)}`, null)}
      </ul>
      {viewed.length > 0 && <><h4>Recently viewed</h4><ul>
        {viewed.map(ref => row(shelfId(ref), ref.name, ref.count, ref.kind, () => onOpen(ref), `Viewed · ${decks(ref.count)}`, onForgetRecent ?? null))}
      </ul></>}
      {openForm === "row" && (rowOpen ? form(true) : <button type="button" className="shelf-open-row" onClick={() => setRowOpen(true)}><Search size={15} />Open a collection…</button>)}
      {kept.length > 0 && <p>Kept collections are separate snapshots. Saving one into yours is a separate step.</p>}
    </div>}
  </div>;
}

// Shared shelves you opened, listed at the end of My collection's overview.
export function RecentShelves({ list, kept = [], onOpen, onForget, onClear }: {
  list: ShelfRef[]; kept?: string[]; onOpen: (source: SharedSource) => void; onForget: (id: string) => void; onClear: () => void;
}) {
  if (!list.length) return null;
  return <section className="recent-shelves" aria-label="Recently viewed">
    <div className="overview-intro"><div><h3>Recently viewed</h3></div><button className="text-button" onClick={onClear}><X size={14} />Clear list</button></div>
    <div className="recent-shelves-grid">
      {list.map(ref => {
        const Icon = ref.kind === "account" ? UserRound : Folder;
        return <article key={shelfId(ref)} className="collection-box recent-shelf">
          <button className="collection-box-cover" aria-label={`Open ${ref.name}`} onClick={() => onOpen(ref)}>
            {ref.art.length ? <span className="collection-box-art" aria-hidden="true">{ref.art.map(src => <Artwork key={src} src={src} alt="" colors={[]} />)}</span>
              : <span className="collection-box-empty"><Icon size={28} /><span>No artwork</span></span>}
            <span className="collection-box-open" aria-hidden="true"><ArrowUpRight size={17} /></span>
          </button>
          <div className="collection-box-body">
            <div className="overview-group-top"><button className="overview-group-title" onClick={() => onOpen(ref)}>{ref.name}</button>
              <button className="icon-button shelf-forget" aria-label={`Remove ${ref.name} from recently viewed`} title="Remove from this list" onClick={() => onForget(shelfId(ref))}><X size={14} /></button></div>
            <small>{kindLabel(ref.kind)} · {decks(ref.count)} · {kept.includes(shelfId(ref)) ? "Kept" : "Read-only"}</small>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
