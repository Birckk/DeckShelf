import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import CollectionGuide from "./CollectionGuide";
import "./first-visit.css";

/** The one-time "New? ✕" offer beside Help: New? opens the tour; ✕ ends the offer. */
export default function FirstVisitHint({ disabled, onStart, onDismiss }: {
  disabled: boolean; onStart: () => void; onDismiss: () => void;
}) {
  return <div className="first-visit-new" role="group" aria-label="Quick tour">
    <button disabled={disabled} title="Take the quick tour" aria-label="New here? Take the quick tour" onClick={onStart}>New?</button>
    <button disabled={disabled} className="first-visit-dismiss" title="Dismiss" aria-label="Dismiss quick tour" onClick={onDismiss}><X size={12} strokeWidth={2.5} /></button>
  </div>;
}

/** The three-page guide in a small popover under the header buttons, so the collection stays in view. */
export function TourPopover({ present, onPrecons, onClose }: {
  present: boolean; onPrecons: () => void; onClose: (returnFocus: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    // Clicking or tabbing elsewhere puts it away, like a menu.
    const outside = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node)) onClose(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [onClose]);
  return <div
    ref={panel}
    className="first-visit-tour"
    role="dialog"
    aria-label="Quick tour"
    tabIndex={-1}
    onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(true); } }}
    onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) onClose(false); }}
  >
    <div className="first-visit-tour-head">
      <span>Quick tour</span>
      <button aria-label="Close quick tour" title="Close" onClick={() => onClose(true)}><X size={16} /></button>
    </div>
    <CollectionGuide present={present} onPrecons={onPrecons} />
  </div>;
}
