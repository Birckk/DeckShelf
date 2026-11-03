import { useState } from "react";

// PROTOTYPE (#128): compare how you move between collections, in the running app.
// Dev server only. Delete this file and its uses once the owner has picked one.
export type NavVariant = "menu" | "strip" | "sidebar";
const NAV_KEY = "deckshelf.dev.nav-variant";
const VARIANTS: { id: NavVariant; label: string }[] = [
  { id: "menu", label: "A Menu by the logo" },
  { id: "strip", label: "B Strip under the header" },
  { id: "sidebar", label: "C In My collection only" },
];
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

export function useOpenVariant() {
  const [nav, setNav] = useState<NavVariant>(() => {
    const saved = read(NAV_KEY);
    return VARIANTS.some(item => item.id === saved) ? saved as NavVariant : "menu";
  });
  return { nav, chooseNav: (next: NavVariant) => { setNav(next); localStorage.setItem(NAV_KEY, next); } };
}

export function OpenVariantBar({ nav, chooseNav }: ReturnType<typeof useOpenVariant>) {
  if (!import.meta.env.DEV || navigator.webdriver) return null;
  return <div style={{ position: "fixed", zIndex: 90, left: 8, bottom: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, maxWidth: "calc(100vw - 16px)", padding: 6, border: "1px dashed #f2ddb0", borderRadius: 6, background: "#17181bf2", fontSize: 12, color: "#e7e1d5" }}>
    {VARIANTS.map(item => <button key={item.id} type="button" onClick={() => chooseNav(item.id)}
      style={{ padding: "4px 8px", borderRadius: 4, background: item.id === nav ? "#f2ddb0" : "transparent", color: item.id === nav ? "#17181b" : "inherit" }}>{item.label}</button>)}
  </div>;
}
