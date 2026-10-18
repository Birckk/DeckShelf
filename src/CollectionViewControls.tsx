import { useEffect, useId, useState } from "react";
import { ArrowDownUp, ChevronDown, SlidersHorizontal } from "lucide-react";
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

export function compareCollectionDecks(sort: string, a: { name: string; colors: string[]; releasedAt?: string }, b: { name: string; colors: string[]; releasedAt?: string }) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "release") return (b.releasedAt || "").localeCompare(a.releasedAt || "");
  if (sort === "colors") return a.colors.length - b.colors.length || a.name.localeCompare(b.name);
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
      <label className="sort-label">
        <ArrowDownUp size={13} />
        <span className="sr-only">Sort decks</span>
        <select aria-label="Sort decks" value={sort} onChange={e => onSort(e.target.value)}>
          <option value="collection">Collection order</option>
          <option value="name">Name: A–Z</option>
          <option value="release">Newest releases</option>
          <option value="colors">Number of colors</option>
        </select>
        <ChevronDown size={12} />
      </label>
    </div>
  </div>;
}
