import { GalleryVerticalEnd, Grid2X2, LayoutGrid, List } from "lucide-react";
import "./collection-layout-switch.css";

export type CollectionLayout = "grid" | "art" | "compact" | "list";
export function CollectionLayoutSwitch({ value, onChange }: {
  value: CollectionLayout;
  onChange?: (layout: CollectionLayout) => void;
}) {
  const options = [
    { id: "grid", label: "Details", Icon: LayoutGrid },
    { id: "art", label: "Cards only", Icon: GalleryVerticalEnd },
    { id: "compact", label: "Compact", Icon: Grid2X2 },
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

