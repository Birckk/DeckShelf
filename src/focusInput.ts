// Records whether the last input was a pointer or keyboard navigation; focus.css reads it to decide
// whether to draw the focus ring. Only keys that move focus count: Escape closing a dialog, or a
// letter typed after a click, doesn't make someone a keyboard user. Until the first input the
// attribute is absent, which draws the ring, so a keyboard user never misses it.
const navigationKeys = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

export function trackFocusInput() {
  const root = document.documentElement;
  window.addEventListener("pointerdown", () => { root.dataset.input = "pointer"; }, true);
  window.addEventListener("keydown", event => { if (navigationKeys.has(event.key)) root.dataset.input = "keyboard"; }, true);
}
