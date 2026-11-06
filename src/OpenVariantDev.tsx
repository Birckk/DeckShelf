import { useState } from "react";

// PROTOTYPE (#128): compare where a friend's shelf keeps its actions, in the running app.
// Dev server only. Delete this file and its uses once the owner has picked one.
export type BarVariant = "quiet" | "crumb" | "dock";
const KEY = "deckshelf.dev.friend-shelf";
const VARIANTS: { id: BarVariant; label: string }[] = [
  { id: "quiet", label: "A Quiet header" },
  { id: "crumb", label: "B Their art and a bookmark" },
  { id: "dock", label: "C Corner dock" },
];
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
// The browser tests run against the dock, which keeps every action on the page, until a pick is made.
const automated = typeof navigator !== "undefined" && navigator.webdriver;

export function useOpenVariant() {
  const [variant, setVariant] = useState<BarVariant>(() => {
    const saved = read(KEY);
    return VARIANTS.some(item => item.id === saved) ? saved as BarVariant : automated ? "dock" : "quiet";
  });
  return {
    variant,
    choose: (next: BarVariant) => { setVariant(next); try { localStorage.setItem(KEY, next); } catch { /* This tab only. */ } },
  };
}

export function OpenVariantBar({ variant, choose }: ReturnType<typeof useOpenVariant>) {
  if (!import.meta.env.DEV || automated) return null;
  return <div style={{ position: "fixed", zIndex: 90, left: 8, bottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, maxWidth: "calc(100vw - 16px)", padding: 6, border: "1px dashed #f2ddb0", borderRadius: 6, background: "#17181bf2", fontSize: 12, color: "#e7e1d5" }}>
    {VARIANTS.map(item => <button key={item.id} type="button" onClick={() => choose(item.id)}
      style={{ padding: "4px 8px", borderRadius: 4, background: item.id === variant ? "#f2ddb0" : "transparent", color: item.id === variant ? "#17181b" : "inherit" }}>{item.label}</button>)}
  </div>;
}
