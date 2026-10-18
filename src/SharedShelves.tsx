import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, Folder, Library, UserRound, X } from "lucide-react";
import { Artwork } from "./components";
import { shelfId, type KeptShelf, type ShelfRef } from "./shelves";
import type { SharedSource } from "./share-links";
import "./shelves.css";

const kindLabel = (kind: SharedSource["kind"]) => kind === "account" ? "Archidekt account" : "Archidekt folder";
const decks = (count: number) => `${count} ${count === 1 ? "deck" : "decks"}`;

// One switcher beside the brand: your own collection, kept shelves and recently viewed ones.
export function ShelfSwitcher({ current, viewing, kept, recent = [], personalCount, disabled, onPersonal, onOpen, onForget, onForgetRecent, actions }: {
  current: { id: string; name: string } | null;
  viewing: { source: SharedSource & { name: string }; count: number } | null;
  kept: KeptShelf[]; recent?: ShelfRef[]; personalCount: number; disabled: boolean;
  onPersonal: () => void; onOpen: (source: SharedSource) => void; onForget: (id: string) => void; onForgetRecent?: (id: string) => void;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const go = (run: () => void) => { setOpen(false); run(); };
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
      <ul>
        {row(null, "Mine", personalCount, null, onPersonal, `Your saved collection · ${decks(personalCount)}`)}
        {kept.map(shelf => row(shelfId(shelf.source), shelf.source.name, shelf.decks.length, shelf.source.kind, () => onOpen(shelf.source), `Kept · ${decks(shelf.decks.length)}`))}
        {unkept && row(shelfId(unkept.source), unkept.source.name, unkept.count, unkept.source.kind, () => onOpen(unkept.source), `Not kept · ${decks(unkept.count)}`, null)}
      </ul>
      {viewed.length > 0 && <><h4>Recently viewed</h4><ul>
        {viewed.map(ref => row(shelfId(ref), ref.name, ref.count, ref.kind, () => onOpen(ref), `Viewed · ${decks(ref.count)}`, onForgetRecent ?? null))}
      </ul></>}
      <p>Kept collections are separate snapshots. Saving one into yours is a separate step.</p>
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
