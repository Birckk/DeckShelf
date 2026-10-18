import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

// Instant pick is shared by both presentations for the session, so switching
// between helix and shuffle keeps it. Like before, it starts on when the system
// asks for reduced motion and is not saved across reloads.
let instant: boolean | null = null;
const listeners = new Set<() => void>();
function setInstant(value: boolean) {
  instant = value;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function usePickerMotion() {
  const [systemReduced, setReduced] = useState(() => matchMedia(REDUCED).matches);
  if (instant === null) instant = systemReduced;
  const instantPick = useSyncExternalStore(subscribe, () => instant!);
  useEffect(() => {
    const media = matchMedia(REDUCED);
    // Turning reduced motion on mid-pick ends the animation at once.
    const update = () => { setReduced(media.matches); if (media.matches) setInstant(true); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return { systemReduced, instantPick, setInstantPick: setInstant };
}
