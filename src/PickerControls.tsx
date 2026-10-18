import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export type Presentation = "helix" | "shuffle";
export type PresentationControl = { value: Presentation; onChange: (value: Presentation) => void };
const PRESENTATIONS: [Presentation, string][] = [["helix", "Helix"], ["shuffle", "Shuffle"]];
const PRESENTATION_KEY = "deckshelf.picker-presentation";
export function savedPresentation(): Presentation {
  try { return localStorage.getItem(PRESENTATION_KEY) === "shuffle" ? "shuffle" : "helix"; } catch { return "helix"; }
}
export function savePresentation(value: Presentation) {
  try { localStorage.setItem(PRESENTATION_KEY, value); } catch { /* The choice still applies this session. */ }
}

// Phones and phones in landscape (the phone and short tiers in layout.css).
const COMPACT = "(max-width: 550px), (max-height: 500px)";

export function useCompactPicker() {
  const [compact, setCompact] = useState(() => matchMedia(COMPACT).matches);
  useEffect(() => {
    const media = matchMedia(COMPACT);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}

// One bar at the top of every picker presentation. Wide screens show the
// presentation dropdown on the left and the pick format on the right; phones fold
// those, the player count and the motion options into one Options menu (where the
// presentation is two buttons), so the stage keeps only the Pick button below.
export function PickerBar({
  compact,
  presentation,
  scope,
  players,
  motion,
  summary,
  disabled,
}: {
  compact: boolean;
  presentation?: PresentationControl;
  scope?: ReactNode;
  players?: ReactNode;
  motion?: ReactNode;
  summary: string;
  disabled: boolean;
}) {
  if (!compact)
    return (
      <div className="picker-bar">
        {presentation && (
          <label className="format-select picker-presentation">
            <span>Picker</span>
            <select aria-label="Picker" value={presentation.value} disabled={disabled} onChange={e => presentation.onChange(e.target.value as Presentation)}>
              {PRESENTATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
        <div className="picker-bar-scope">{scope}</div>
      </div>
    );
  return (
    <div className="picker-bar">
      <PickerOptions summary={summary} disabled={disabled}>
        {presentation && (
          <div className="picker-option picker-presentation" role="group" aria-label="Picker presentation">
            {PRESENTATIONS.map(([value, label]) => (
              <button key={value} aria-pressed={presentation.value === value} disabled={disabled} onClick={() => presentation.onChange(value)}>{label}</button>
            ))}
          </div>
        )}
        {players && <div className="picker-option">{players}</div>}
        {scope && <div className="picker-option">{scope}</div>}
        {motion && <div className="picker-option">{motion}</div>}
      </PickerOptions>
    </div>
  );
}

function PickerOptions({ summary, disabled, children }: { summary: string; disabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const shown = open && !disabled;
  useEffect(() => {
    if (!shown) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", key);
    };
  }, [shown]);
  return (
    <div className="picker-options" ref={root}>
      <button
        ref={trigger}
        className="picker-options-trigger"
        aria-expanded={shown}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span className="sr-only">Picker options: </span>
        <span className="picker-options-summary">{summary}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={id} className="picker-options-panel" role="group" aria-label="Picker options" hidden={!shown}>
        {children}
      </div>
    </div>
  );
}
