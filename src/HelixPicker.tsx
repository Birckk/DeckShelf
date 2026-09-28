import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  ArrowRight,
  ExternalLink,
  Grip,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { randomIndex, type Deck } from "./domain";
import { Artwork, Mana } from "./components";
import {
  CENTERED_START,
  dragTravel,
  flightEase,
  helixPose,
  landing,
  repeatDecks,
} from "./helix";

type Flight = {
  started: number;
  duration: number;
  fromTravel: number;
  fromTurn: number;
  toTravel: number;
  toTurn: number;
  deck: Deck;
};
type Motion = {
  travel: number;
  turn: number;
  velocity: number;
  flight: Flight | null;
  dragging: boolean;
  winner: string | null;
};

export default function HelixPicker({
  decks,
  spinning,
  setSpinning,
  openDeck,
  onWinner,
}: {
  decks: Deck[];
  spinning: boolean;
  setSpinning: (v: boolean) => void;
  openDeck: (d: Deck) => void;
  onWinner: (deck: Deck | null) => void;
}) {
  const [winner, setWinner] = useState<Deck | null>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const motion = useRef<Motion>({
    ...CENTERED_START,
    velocity: 0,
    flight: null,
    dragging: false,
    winner: null,
  });
  const preferences = useRef({ paused, reduced });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    last: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const count = decks.length;
  const key = decks.map((d) => d.id).join(",");
  // Visual repetitions never enter the unique pool used by randomIndex.
  const items = useMemo(() => repeatDecks(decks), [decks]);
  preferences.current = { paused, reduced };
  useEffect(() => {
    onWinner(winner);
    return () => onWinner(null);
  }, [winner, onWinner]);
  useEffect(() => {
    motion.current = {
      ...CENTERED_START,
      velocity: 0,
      flight: null,
      dragging: false,
      winner: null,
    };
    setWinner(null);
    setSpinning(false);
    setDragging(false);
    pointer.current = null;
  }, [key, setSpinning]);
  useEffect(() => {
    const scene = stage.current!;
    let width = scene.clientWidth,
      height = scene.clientHeight;
    const resize = new ResizeObserver(() => {
      width = scene.clientWidth;
      height = scene.clientHeight;
    });
    resize.observe(scene);
    let frame = 0,
      previous = 0,
      visible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "100px" },
    );
    observer.observe(scene);
    function tick(now: number) {
      const delta = Math.min((now - (previous || now)) / 1000, 0.05);
      previous = now;
      const m = motion.current;
      const { paused: hold, reduced: quiet } = preferences.current;
      if (!document.hidden && visible) {
        if (m.flight) {
          const flight = m.flight,
            progress = Math.min(1, (now - flight.started) / flight.duration),
            ease = flightEase(progress);
          m.travel =
            flight.fromTravel + (flight.toTravel - flight.fromTravel) * ease;
          m.turn = flight.fromTurn + (flight.toTurn - flight.fromTurn) * ease;
          scene.style.setProperty(
            "--flight",
            String(Math.sin(progress * Math.PI)),
          );
          if (progress === 1) {
            m.winner = flight.deck.id;
            m.flight = null;
            scene.style.setProperty("--flight", "0");
            setWinner(flight.deck);
            setSpinning(false);
          }
        } else if (
          !hold &&
          !quiet &&
          !m.winner &&
          !m.dragging &&
          count > 0 &&
          !document.querySelector("dialog[open]")
        ) {
          m.travel += (0.025 + m.velocity) * delta;
          m.velocity *= Math.exp(-3.4 * delta);
        }
        nodes.current.forEach((node, index) => {
          if (!node || index >= items.length) return;
          const p = helixPose(
            index,
            items.length,
            m.travel,
            m.turn,
            width,
            height,
          );
          node.style.transform = `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.yaw}deg) rotateZ(${p.roll}deg)`;
          node.style.opacity = String(p.opacity * (m.winner ? 0.1 : 1));
          node.style.filter = `brightness(${p.brightness}) blur(${quiet ? 0 : p.blur}px)`;
          node.style.zIndex = String(Math.round(p.depth * 100));
          node.style.pointerEvents =
            p.opacity < 0.2 || !!m.flight || !!m.winner ? "none" : "auto";
          node.tabIndex =
            items.findIndex((d) => d.id === items[index].id) === index &&
            !m.flight &&
            !m.winner &&
            p.opacity > 0.3 &&
            Math.abs(p.y) < height * 0.35
              ? 0
              : -1;
        });
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
    };
  }, [items, count, setSpinning]);
  function explore() {
    motion.current.winner = null;
    setWinner(null);
  }
  function spin() {
    if (spinning || !count) return;
    stage.current?.parentElement?.scrollIntoView({
      block: "start",
      behavior: reduced ? "instant" : "smooth",
    });
    const deck = decks[randomIndex(count)];
    explore();
    const m = motion.current;
    m.velocity = 0;
    if (reduced || count === 1) {
      m.winner = deck.id;
      setWinner(deck);
      return;
    }
    const target = landing(
      items.findIndex((d) => d.id === deck.id),
      items.length,
      m.travel,
      m.turn,
      2 + randomIndex(151) / 100,
    );
    m.flight = {
      started: performance.now(),
      duration: 5200 + randomIndex(2201),
      fromTravel: m.travel,
      fromTurn: m.turn,
      toTravel: target.travel,
      toTurn: target.turn,
      deck,
    };
    setSpinning(true);
  }
  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (spinning || winner || count < 1 || e.button !== 0 || pointer.current)
      return;
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      last: performance.now(),
      moved: false,
    };
    suppressClick.current = false;
    motion.current.velocity = 0;
    motion.current.dragging = true;
  }
  function drag(e: PointerEvent<HTMLDivElement>) {
    const previous = pointer.current;
    if (!previous || previous.id !== e.pointerId) return;
    const dx = e.clientX - previous.x,
      dy = e.clientY - previous.y;
    if (!previous.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!previous.moved) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const dt = Math.max(0.016, (performance.now() - previous.last) / 1000),
      travel = dragTravel(dx, dy, e.currentTarget.clientHeight);
    motion.current.travel += travel;
    motion.current.dragging = true;
    motion.current.velocity = Math.max(-0.8, Math.min(0.8, travel / dt));
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      last: performance.now(),
      moved: true,
    };
    suppressClick.current = true;
  }
  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== e.pointerId) return;
    if (
      e.type === "pointercancel" ||
      performance.now() - pointer.current.last > 100
    )
      motion.current.velocity = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    pointer.current = null;
    motion.current.dragging = false;
    setDragging(false);
  }
  return (
    <section
      className={`helix-picker ${spinning ? "is-spinning" : ""} ${winner ? "has-winner" : ""} ${reduced ? "reduced-motion" : ""}`}
      aria-label="Random deck picker"
    >
      <div className="helix-toolbar">
        <span className="helix-live">
          <span className={paused || reduced || winner ? "resting" : ""} />
          {spinning
            ? "FATE IN MOTION"
            : winner
              ? "YOUR NEXT ADVENTURE"
              : paused || reduced
                ? "A MOMENT OF STILLNESS"
                : "A LIVING COLLECTION"}
        </span>
        <div className="helix-motion-controls">
          <button
            className="text-button"
            disabled={spinning || reduced || !!winner || !count}
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume motion" : "Pause motion"}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </button>
          <label>
            <input
              type="checkbox"
              checked={reduced}
              disabled={spinning}
              onChange={(e) => setReduced(e.target.checked)}
            />
            Reduce motion
          </label>
        </div>
      </div>
      <div className="helix-intro">
        <h2>A twist of fate.</h2>
        <p>
          {count
            ? "Follow the cards. Find a favorite. Or let the universe choose."
            : "No decks in this constellation. Change your filters to bring them back."}
        </p>
      </div>
      <div
        ref={stage}
        className={`helix-stage ${dragging ? "is-dragging" : ""}`}
        aria-label="Moving double helix of commander decks"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) endDrag(e);
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
          motion.current.dragging = false;
          setDragging(false);
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="helix-atmosphere" />
        <div className="helix-axis" />
        <div className="helix-floor" />
        <div className="helix-world">
          {items.map((deck, index) => (
            <button
              key={`${deck.id}-${index}`}
              ref={(node) => {
                nodes.current[index] = node;
              }}
              className="helix-card"
              tabIndex={
                items.findIndex((d) => d.id === items[index].id) === index &&
                !spinning &&
                !winner
                  ? 0
                  : -1
              }
              disabled={spinning || !!winner}
              aria-label={`View ${deck.name}`}
              onFocus={(e) => {
                if (e.currentTarget.matches(":focus-visible")) setPaused(true);
              }}
              onClick={() => openDeck(deck)}
            >
              <Artwork
                src={deck.commanders[0].art}
                alt={deck.commanders[0].name}
                eager
              />
              <span className="helix-card-shade" />
              <span className="helix-card-top">
                COMMANDER <span>✦</span>
              </span>
              <span className="helix-card-caption">
                <strong>{deck.name}</strong>
                <Mana colors={deck.colors} size="mini" />
              </span>
              <span className="helix-card-edge" />
            </button>
          ))}
        </div>
        {winner && (
          <div className="helix-reveal" key={winner.id}>
            <div className="reveal-ring" aria-hidden="true" />
            <div className="reveal-halo" />
            <button
              className="revealed-card"
              aria-label={`View winning deck ${winner.name}`}
              onClick={() => openDeck(winner)}
            >
              <Artwork
                src={winner.commanders[0].image}
                alt={winner.commanders[0].name}
                eager
              />
            </button>
          </div>
        )}
        {!winner && !!count && (
          <div className="helix-gesture">
            <Hand size={13} />
            {spinning
              ? "The strands are turning…"
              : dragging
                ? "Release to let it drift"
                : "Drag to turn. Release to drift."}
          </div>
        )}
        {!count && (
          <div className="helix-empty">
            <Grip size={36} />
            <span>Nothing to choose from yet.</span>
          </div>
        )}
      </div>
      <div className={`helix-dock ${winner ? "with-result" : ""}`}>
        <div
          className={winner ? "helix-selection" : "sr-only"}
          aria-live="polite"
          aria-atomic="true"
        >
          {winner ? (
            <>
              <h3>
                <a
                  href={winner.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open on ${winner.sourceName}`}
                >
                  {winner.name}
                  <ExternalLink size={14} />
                </a>
              </h3>
              <Mana colors={winner.colors} />
            </>
          ) : spinning ? (
            "Choosing your deck…"
          ) : (
            `${count} eligible ${count === 1 ? "deck" : "decks"}`
          )}
        </div>
        <div className="helix-dock-actions">
          <button
            className="button button-gold spin-button"
            onClick={spin}
            disabled={spinning || !count}
            title={
              count
                ? `Each eligible deck has a 1 in ${count} chance.`
                : "Try another filter."
            }
          >
            {spinning ? (
              <span className="loading-dot" />
            ) : winner ? (
              <RotateCcw size={16} />
            ) : (
              <Sparkles size={17} />
            )}
            {spinning
              ? "Choosing your deck…"
              : winner
                ? "Pick again"
                : "Pick a deck"}
            {!spinning && <ArrowRight size={15} />}
          </button>
          {winner && (
            <button
              className="button helix-browse"
              onClick={explore}
              aria-label="Return to the spiral"
            >
              Browse decks
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
