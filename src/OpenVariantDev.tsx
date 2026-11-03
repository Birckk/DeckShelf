import { useState } from "react";

// PROTOTYPE (#128): compare ways into someone else's collection in the running app.
// Dev server only. Delete this file and its uses once the owner has picked one.
export type OpenVariant = "box" | "row" | "icon" | "overview";
const KEY = "deckshelf.dev.open-variant";
const BROWSE_KEY = "deckshelf.dev.open-browse";
const VARIANTS: { id: OpenVariant; label: string }[] = [
  { id: "box", label: "A Box in the Mine menu" },
  { id: "row", label: "B Row in the Mine menu" },
  { id: "icon", label: "C Header icon" },
  { id: "overview", label: "D In My collection" },
];
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

export function useOpenVariant() {
  const [variant, setVariant] = useState<OpenVariant>(() => {
    const saved = read(KEY);
    return VARIANTS.some(item => item.id === saved) ? saved as OpenVariant : "box";
  });
  const [browse, setBrowse] = useState(() => read(BROWSE_KEY) !== "off");
  return {
    variant, browse,
    choose: (next: OpenVariant) => { setVariant(next); localStorage.setItem(KEY, next); },
    toggleBrowse: (next: boolean) => { setBrowse(next); localStorage.setItem(BROWSE_KEY, next ? "on" : "off"); },
  };
}

export function OpenVariantBar({ variant, browse, choose, toggleBrowse }: ReturnType<typeof useOpenVariant>) {
  if (!import.meta.env.DEV || navigator.webdriver) return null;
  return <div style={{ position: "fixed", zIndex: 90, left: 8, bottom: 8, right: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, width: "fit-content", padding: 6, border: "1px dashed #f2ddb0", borderRadius: 6, background: "#17181bf2", fontSize: 12, color: "#e7e1d5" }}>
    {VARIANTS.map(item => <button key={item.id} type="button" onClick={() => choose(item.id)}
      style={{ padding: "4px 8px", borderRadius: 4, background: item.id === variant ? "#f2ddb0" : "transparent", color: item.id === variant ? "#17181b" : "inherit" }}>{item.label}</button>)}
    <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 6px" }}>
      <input type="checkbox" checked={browse} onChange={event => toggleBrowse(event.target.checked)} />Just browse in Add decks
    </label>
  </div>;
}
