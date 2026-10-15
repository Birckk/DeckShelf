import { useEffect, useSyncExternalStore } from "react";
import { Menu } from "lucide-react";

// The Windows app's slim title bar (desktop/main.mjs and desktop/preload.cjs). Windows draws the
// window buttons on its right; the menu button opens File, View, Go and Help. Browsers have
// neither the overlay nor the bridge, and the bar also steps aside in full screen.
const overlay = (navigator as Navigator & { windowControlsOverlay?: EventTarget & { visible: boolean } }).windowControlsOverlay;
const desktop = (window as Window & { deckshelfDesktop?: { openMenu(): void; onCommand(listener: (command: string) => void): () => void } }).deckshelfDesktop;

export function onMenuCommand(listener: (command: string) => void) {
  return desktop ? desktop.onCommand(listener) : () => {};
}

function subscribe(listener: () => void) {
  overlay?.addEventListener("geometrychange", listener);
  return () => overlay?.removeEventListener("geometrychange", listener);
}

export function WindowBar() {
  const shown = useSyncExternalStore(subscribe, () => !!desktop && !!overlay?.visible);
  useEffect(() => {
    document.documentElement.classList.toggle("window-bar-shown", shown);
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="window-bar">
      <button className="window-bar-menu" aria-label="Menu" title="Menu" aria-haspopup="menu" onClick={() => desktop!.openMenu()}>
        <Menu size={17} />
      </button>
    </div>
  );
}
