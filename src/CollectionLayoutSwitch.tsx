import { GalleryVerticalEnd, LayoutGrid, List, Grid2X2 } from "lucide-react";
import "./collection-layout-switch.css";

export type CollectionLayout = "grid" | "art" | "list";
type Layout = CollectionLayout | "compact";
export function CollectionLayoutSwitch({ value, onChange, compact = false }: {
  value: Layout;
  onChange?: (layout: Layout) => void;
  compact?: boolean;
}) {
  const options = [
    { id: "grid", label: "Details", Icon: LayoutGrid },
    { id: "art", label: "Cards only", Icon: GalleryVerticalEnd },
    ...(compact ? [{ id: "compact" as const, label: "Compact", Icon: Grid2X2 }] : []),
    { id: "list", label: "List", Icon: List },
  ] as const;
  return <div className="collection-layout-switch" role="group" aria-label="Collection layout">
    {options.map(({ id, label, Icon }) => <button key={id} type="button"
      id={`layout-${id}`} data-layout={id} title={label} aria-label={label}
      aria-pressed={value === id} onClick={() => onChange?.(id)}>
      <Icon size={14} /><span>{label}</span>
    </button>)}
  </div>;
}

