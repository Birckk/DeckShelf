import { useState } from "react";

// PROTOTYPE (#128): compare where a friend's shelf keeps its actions, in the running app.
// Dev server only. Delete this file and its uses once the owner has picked one.
export type BarVariant = "bar" | "header" | "row" | "none";
const KEY = "deckshelf.dev.bar-variant";
const HIDDEN_KEY = "deckshelf.dev.bar-hidden";
const VARIANTS: { id: BarVariant; label: string }[] = [
  { id: "bar", label: "A Slim bar you can hide" },
  { id: "header", label: "B Icons beside the name" },
  { id: "row", label: "C Icons in the deck row" },
  { id: "none", label: "D No bar, no icons" },
];
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
// The browser tests run against the bar until a pick is made.
const automated = typeof navigator !== "undefined" && navigator.webdriver;

export function useOpenVariant() {
  const [variant, setVariant] = useState<BarVariant>(() => {
    const saved = read(KEY);
    return VARIANTS.some(item => item.id === saved) ? saved as BarVariant : automated ? "bar" : "header";
  });
  const [hidden, setHidden] = useState(() => read(HIDDEN_KEY) === "true");
  return {
    variant, hidden,
    choose: (next: BarVariant) => { setVariant(next); localStorage.setItem(KEY, next); },
    hide: (next: boolean) => { setHidden(next); localStorage.setItem(HIDDEN_KEY, String(next)); },
  };
}

export function OpenVariantBar({ variant, choose }: ReturnType<typeof useOpenVariant>) {
  if (!import.meta.env.DEV || automated) return null;
  return <div style={{ position: "fixed", zIndex: 90, left: 8, bottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, maxWidth: "calc(100vw - 16px)", padding: 6, border: "1px dashed #f2ddb0", borderRadius: 6, background: "#17181bf2", fontSize: 12, color: "#e7e1d5" }}>
    {VARIANTS.map(item => <button key={item.id} type="button" onClick={() => choose(item.id)}
      style={{ padding: "4px 8px", borderRadius: 4, background: item.id === variant ? "#f2ddb0" : "transparent", color: item.id === variant ? "#17181b" : "inherit" }}>{item.label}</button>)}
  </div>;
}
