import { useState } from "react";

// PROTOTYPE (#128): compare where the shelf menu lives, in the running app.
// Dev server only. Delete this file and its uses once the owner has picked one.
export type MenuPlacement = "label" | "chevron" | "icon" | "icon-left";
const KEY = "deckshelf.dev.shelf-menu";
const VARIANTS: { id: MenuPlacement; label: string }[] = [
  { id: "label", label: "A Name by the logo" },
  { id: "chevron", label: "B Chevron by the logo" },
  { id: "icon", label: "C People icon on the right" },
  { id: "icon-left", label: "D People icon by the logo" },
];
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
// The browser tests run against today's menu until a pick is made.
const automated = typeof navigator !== "undefined" && navigator.webdriver;

export function useOpenVariant() {
  const [variant, setVariant] = useState<MenuPlacement>(() => {
    const saved = read(KEY);
    return VARIANTS.some(item => item.id === saved) ? saved as MenuPlacement : automated ? "label" : "icon-left";
  });
  return {
    variant,
    choose: (next: MenuPlacement) => { setVariant(next); try { localStorage.setItem(KEY, next); } catch { /* This tab only. */ } },
  };
}

export function OpenVariantBar({ variant, choose }: ReturnType<typeof useOpenVariant>) {
  if (!import.meta.env.DEV || automated) return null;
  return <div style={{ position: "fixed", zIndex: 90, left: 8, bottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, maxWidth: "calc(100vw - 16px)", padding: 6, border: "1px dashed #f2ddb0", borderRadius: 6, background: "#17181bf2", fontSize: 12, color: "#e7e1d5" }}>
    {VARIANTS.map(item => <button key={item.id} type="button" onClick={() => choose(item.id)}
      style={{ padding: "4px 8px", borderRadius: 4, background: item.id === variant ? "#f2ddb0" : "transparent", color: item.id === variant ? "#17181b" : "inherit" }}>{item.label}</button>)}
  </div>;
}
