import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Dices } from "lucide-react";
import type { Deck } from "./domain";
import { tiltCard, resetTilt } from "./Atmosphere";
import { Artwork } from "./components";

export default function CardStudio({
  decks,
  openDeck,
  chooseDeck,
  onFocusDeck,
}: {
  decks: Deck[];
  openDeck: (deck: Deck) => void;
  chooseDeck: () => void;
  onFocusDeck: (deck: Deck) => void;
}) {
  const [selected, setSelected] = useState(decks[0]?.id);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const index = Math.max(
    0,
    decks.findIndex((deck) => deck.id === selected),
  );
  const deck = decks[index];
  const count = decks.length;
  useEffect(() => {
    if (deck) onFocusDeck(deck);
  }, [deck, onFocusDeck]);
  function step(direction: number) {
    setSelected(decks[(index + direction + count) % count].id);
  }
  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || count < 2 || pointer.current) return;
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    suppressClick.current = false;
  }
  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    if (
      Math.abs(e.clientX - p.x) > 8 &&
      Math.abs(e.clientX - p.x) > Math.abs(e.clientY - p.y)
    ) {
      p.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    suppressClick.current = p.moved;
    if (e.type !== "pointercancel" && p.moved && Math.abs(e.clientX - p.x) > 40)
      step(e.clientX < p.x ? 1 : -1);
    pointer.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  if (!deck) return null;
  return (
    <section
      className="card-studio"
      aria-label="Commander card carousel"
      aria-roledescription="carousel"
      onKeyDown={(e) => {
        if (
          count < 2 ||
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
        )
          return;
        e.preventDefault();
        if (e.key === "Home") setSelected(decks[0].id);
        else if (e.key === "End") setSelected(decks[count - 1].id);
        else step(e.key === "ArrowRight" ? 1 : -1);
      }}
    >
      <div
        className="studio-stage"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId))
            pointer.current = null;
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        <div className="studio-light" aria-hidden="true" />
        {decks.map((item, i) => {
          let offset = (i - index + count) % count;
          if (offset > count / 2) offset -= count;
          const distance = Math.abs(offset);
          const active = offset === 0;
          return (
            <button
              key={item.id}
              className={`studio-card ${active ? "is-current" : ""}`}
              style={
                {
                  "--offset": offset,
                  "--scale": Math.pow(0.84, distance),
                  "--layer": 10 - distance,
                  "--visibility": distance > 3 ? 0 : distance === 3 ? 0.6 : 1,
                } as CSSProperties
              }
              aria-label={`${active ? "View" : "Show"} ${item.name}`}
              aria-hidden={distance > 3 || undefined}
              tabIndex={active ? 0 : -1}
              disabled={distance > 3}
              onPointerMove={active ? tiltCard : undefined}
              onPointerLeave={resetTilt}
              onClick={() => (active ? openDeck(item) : setSelected(item.id))}
            >
              <Artwork
                src={item.commanders[0].image}
                alt={item.commanders[0].name}
                eager={distance <= 3}
              />
            </button>
          );
        })}
      </div>
      <div className="studio-caption" aria-live="polite" aria-atomic="true">
        <button onClick={() => openDeck(deck)}>
          <h2>{deck.name}</h2>
          <ExternalLink size={18} />
        </button>
        <p>{deck.commanders.map((c) => c.name).join(" & ")}</p>
      </div>
      <div className="studio-controls">
        <span className="studio-hint">
          Drag to browse <span>·</span> Use ← → keys
        </span>
        <div className="studio-pagination">
          <button
            aria-label="Previous deck"
            onClick={() => step(-1)}
            disabled={count < 2}
          >
            <ChevronLeft size={22} />
          </button>
          <span>
            <strong>{String(index + 1).padStart(2, "0")}</strong> /{" "}
            {String(count).padStart(2, "0")}
          </span>
          <button
            aria-label="Next deck"
            onClick={() => step(1)}
            disabled={count < 2}
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <button className="button button-gold studio-pick" onClick={chooseDeck}>
          <Dices size={21} />
          Pick a deck <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}
