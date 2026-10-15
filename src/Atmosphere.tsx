import {
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { cardImage, type Deck } from "./domain";

const light: Record<string, string> = {
  W: "218, 193, 136",
  U: "62, 133, 205",
  B: "146, 105, 164",
  R: "210, 88, 61",
  G: "74, 152, 113",
};
export function Atmosphere({
  deck,
  revealed,
}: {
  deck: Deck | null;
  revealed: boolean;
}) {
  const [layers, setLayers] = useState<Deck[]>([]);
  useEffect(() => {
    if (!deck) {
      setLayers([]);
      return;
    }
    setLayers((previous) =>
      previous.at(-1)?.id === deck.id
        ? [...previous.slice(0, -1), deck]
        : [...previous.slice(-1), deck],
    );
  }, [deck]);
  return (
    <div
      className={`archive-atmosphere ${revealed ? "is-revealed" : ""}`}
      aria-hidden="true"
    >
      {layers.map((item, index) => (
        <div
          key={item.id}
          className={`atmosphere-layer ${index === layers.length - 1 ? "active" : ""}`}
          style={
            {
              "--aura-one": light[item.colors[0]] || "159, 163, 176",
              "--aura-two": light[item.colors.at(-1) || ""] || "159, 163, 176",
            } as CSSProperties
          }
        >
          <img src={cardImage(item.commanders[0].art)} crossOrigin="anonymous" alt="" />
          <div className="atmosphere-colors" />
        </div>
      ))}
      <div className="atmosphere-vignette" />
    </div>
  );
}
export function tiltCard(event: PointerEvent<HTMLElement>) {
  if (
    event.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const el = event.currentTarget,
    rect = el.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  el.style.setProperty("--tilt-x", `${(0.5 - y) * 2}deg`);
  el.style.setProperty("--tilt-y", `${(x - 0.5) * 2}deg`);
}
export function resetTilt(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}
