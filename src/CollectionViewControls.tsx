import { useEffect, useId, useState } from "react";
import { ArrowDownUp, ArrowUpDown, ChevronDown, SlidersHorizontal } from "lucide-react";
import { CollectionLayoutSwitch, type CollectionLayout } from "./CollectionLayoutSwitch";
import "./collection-view-controls.css";

const COLLECTION_SIZES = [150, 210, 280];
/* Compact shows square artwork only, so the same S/M/L steps fit more decks per row. */
const COMPACT_SIZES = [110, 150, 200];
export const collectionTileSize = (layout: CollectionLayout, size: number) =>
  (layout === "compact" ? COMPACT_SIZES : COLLECTION_SIZES)[size];
type Display = { layout: CollectionLayout; size: number };

export function useCollectionDisplay(key: string, fallback: Display["layout"] = "art") {
  const [display, setDisplay] = useState<Display>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      return {
        layout: ["grid", "art", "compact", "list"].includes(saved?.layout) ? saved.layout : fallback,
        size: Number.isInteger(saved?.size) && saved.size >= 0 && saved.size <= 2 ? saved.size : 1,
      };
    } catch {
      return { layout: fallback, size: 1 };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(display));
    } catch {
      /* Session controls still work when storage is unavailable. */
    }
  }, [key, display]);
  return [display, setDisplay] as const;
}

/*
 * Sort fields with their orders, natural first: [value, direction label]. Table headers use the
 * same values, so a header click and the menu plus direction button always agree.
 */
const SORT_FIELDS = [
  { field: "collection", label: "Collection order", orders: [["collection", ""]] },
  { field: "name", label: "Name", orders: [["name", "A–Z"], ["name-desc", "Z–A"]] },
  { field: "commander", label: "Commander", orders: [["commander", "A–Z"], ["commander-desc", "Z–A"]] },
  { field: "release", label: "Release", orders: [["release", "Newest"], ["release-asc", "Oldest"]] },
  { field: "colors", label: "Colors", orders: [["colors", "Fewest"], ["colors-desc", "Most"]] },
] as const;
const sortField = (sort: string) => SORT_FIELDS.find(f => f.orders.some(([value]) => value === sort)) || SORT_FIELDS[0];

type Sortable = { name: string; colors: string[]; releasedAt?: string; commanders?: { name: string }[] };
export function compareCollectionDecks(sort: string, a: Sortable, b: Sortable) {
  const byName = a.name.localeCompare(b.name);
  if (sort === "name") return byName;
  if (sort === "name-desc") return -byName;
  if (sort === "commander" || sort === "commander-desc") {
    // Decks not yet added have no commander to compare; they stay at the end.
    const first = a.commanders?.[0]?.name, second = b.commanders?.[0]?.name;
    if (!first !== !second) return first ? -1 : 1;
    const order = (first || "").localeCompare(second || "") || byName;
    return sort === "commander" ? order : -order;
  }
  if (sort === "release" || sort === "release-asc") {
    // Decks without a release date stay at the end in both directions.
    if (!a.releasedAt !== !b.releasedAt) return a.releasedAt ? -1 : 1;
    const order = (b.releasedAt || "").localeCompare(a.releasedAt || "");
    return sort === "release" ? order : -order;
  }
  if (sort === "colors") return a.colors.length - b.colors.length || byName;
  if (sort === "colors-desc") return b.colors.length - a.colors.length || byName;
  return 0;
}

export default function CollectionViewControls({ display, onChange, sort, onSort }: {
  display: Display;
  onChange: (display: Display) => void;
  sort: string;
  onSort: (sort: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toolsId = useId();
  return <div className={`collection-view-controls collection-display-toolbar shared-view-controls ${expanded ? "options-open" : ""}`}>
    <CollectionLayoutSwitch value={display.layout} onChange={layout => onChange({ ...display, layout })} />
    <button type="button" className="display-options-toggle" aria-label="Size and sort" title="Size and sort"
      aria-expanded={expanded} aria-controls={toolsId} onClick={() => setExpanded(value => !value)}><SlidersHorizontal size={15} /></button>
    <div className="display-tools" id={toolsId}>
      <label className="collection-size-control">
        <span>Size</span>
        <input type="range" aria-label="Collection item size" aria-valuetext={["Small", "Medium", "Large"][display.size]}
          min="0" max="2" step="1" value={display.size} onChange={e => onChange({ ...display, size: Number(e.target.value) })} />
        <span className="size-value">{["S", "M", "L"][display.size]}</span>
      </label>
      <SortControl sort={sort} onSort={onSort} />
    </div>
  </div>;
}

/* Sort by a field, with a separate button that flips its direction in that field's own words. */
function SortControl({ sort, onSort }: { sort: string; onSort: (sort: string) => void }) {
  const field = sortField(sort);
  const current = field.orders.findIndex(([value]) => value === sort);
  const other = field.orders[1 - current];
  return <span className="sort-field">
    <label className="sort-label">
      <ArrowDownUp size={13} />
      <span className="sr-only">Sort decks</span>
      <select aria-label="Sort decks" value={field.field} onChange={e => onSort(SORT_FIELDS.find(f => f.field === e.target.value)!.orders[0][0])}>
        {SORT_FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
      </select>
      <ChevronDown size={12} />
    </label>
    {other && <button type="button" className="sort-direction" aria-label={`Sort order: ${field.orders[current][1]}`}
      title={`Switch to ${other[1]}`} onClick={() => onSort(other[0])}>
      {field.orders[current][1]}<ArrowUpDown size={12} aria-hidden="true" />
    </button>}
  </span>;
}
