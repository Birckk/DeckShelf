import { coverOf } from './domain';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ExternalLink,
  Grip,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Dices,
} from "lucide-react";
import { drawDistinct, randomIndex, type Deck } from "./domain";
import { Artwork, Mana } from "./components";
import {
  CENTERED_START,
  dragTravel,
  helixPose,
  nearestLanding,
  repeatDecks,
  routeTurn,
  stopTravel,
  type Stop,
} from "./helix";
import { PlayerCount, savePlayers, savedPlayers } from "./PlayerCount";
import { usePickerMotion } from "./PickerMotion";
import { PickerBar, useCompactPicker, type PresentationControl } from "./PickerControls";
import { RevealGlow } from "./Atmosphere";

// One spin passes every chosen deck front-centre in order, then reveals them.
type Run = {
  started: number;
  revealAt: number;
  from: Stop;
  stops: (Stop & { slot: number })[];
  travelAt: (ms: number) => number;
  picks: Deck[];
  passed: number;
};
type Motion = {
  travel: number;
  turn: number;
  velocity: number;
  run: Run | null;
  dragging: boolean;
  winner: string | null;
  // Spiral brightness eases toward its target so the reveal never cuts in one frame.
  dim: number;
  // Spiral slots already chosen during this pick, with their player number.
  lit: Map<number, number>;
};

const seatName = (index: number) => `Player ${index + 1}`;
const HOLD = 700;
const fresh = (): Motion => ({
  ...CENTERED_START,
  velocity: 0,
  run: null,
  dragging: false,
  winner: null,
  dim: 1,
  lit: new Map(),
});

export default function HelixPicker({
  decks,
  spinning,
  setSpinning,
  openDeck,
  onWinner,
  scopeControl,
  scopeLabel = "",
  presentation,
}: {
  scopeControl?: ReactNode;
  scopeLabel?: string;
  // Helix or shuffle-and-deal, chosen in the picker bar.
  presentation?: PresentationControl;
  decks: Deck[];
  spinning: boolean;
  setSpinning: (v: boolean) => void;
  openDeck: (d: Deck) => void;
  onWinner: (deck: Deck | null) => void;
}) {
  const [picks, setPicks] = useState<Deck[]>([]);
  const [chain, setChain] = useState<Deck[]>([]);
  const [players, setPlayers] = useState(savedPlayers);
  const winner = picks[0] ?? null;
  const { systemReduced, instantPick, setInstantPick } = usePickerMotion();
  const [paused, setPaused] = useState(systemReduced);
  const [dragging, setDragging] = useState(false);
  const compact = useCompactPicker();
  const stage = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);
  const motion = useRef<Motion>(fresh());
  const preferences = useRef({ paused, reduced: systemReduced });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    last: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const count = decks.length;
  // One deck per player, limited to the eligible pool.
  const seats = Math.max(1, Math.min(players, count));
  const multi = picks.length > 1;
  const key = decks.map((d) => d.id).join(",");
  // Visual repetitions never enter the unique pool used by randomIndex.
  const items = useMemo(() => repeatDecks(decks), [decks]);
  const firstSlots = useMemo(() => {
    const seen = new Set<string>();
    return items.map(deck => { const first = !seen.has(deck.id); seen.add(deck.id); return first; });
  }, [items]);
  preferences.current = { paused, reduced: systemReduced };
  useEffect(() => {
    onWinner(winner);
    return () => onWinner(null);
  }, [winner, onWinner]);
  useEffect(() => {
    motion.current = fresh();
    setPicks([]);
    setChain([]);
    setSpinning(false);
    setDragging(false);
    pointer.current = null;
    return () => setSpinning(false);
  }, [key, setSpinning]);
  // Seats arrive from the spiral's front card, where the last deck landed.
  useLayoutEffect(() => {
    const scene = stage.current, box = reveal.current;
    if (!scene || !box || picks.length < 2) return;
    const from = scene.getBoundingClientRect();
    const cx = from.left + from.width / 2, cy = from.top + from.height / 2;
    box.querySelectorAll<HTMLElement>(".reveal-seat").forEach(seat => {
      const r = seat.getBoundingClientRect();
      seat.style.setProperty("--dx", `${cx - (r.left + r.width / 2)}px`);
      seat.style.setProperty("--dy", `${cy - (r.top + r.height / 2)}px`);
    });
  }, [picks]);
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
        if (m.run) {
          const run = m.run,
            elapsed = Math.min(now - run.started, run.revealAt);
          m.travel = run.travelAt(elapsed);
          m.turn = routeTurn(run.from, run.stops, m.travel);
          scene.style.setProperty(
            "--flight",
            String(Math.sin((elapsed / run.revealAt) * Math.PI)),
          );
          let passed = false;
          while (run.passed < run.stops.length && m.travel >= run.stops[run.passed].travel - 1e-9) {
            if (run.picks.length > 1) m.lit.set(run.stops[run.passed].slot, run.passed + 1);
            run.passed++;
            passed = true;
          }
          if (passed && run.picks.length > 1) setChain(run.picks.slice(0, run.passed));
          if (elapsed >= run.revealAt) {
            m.winner = run.picks[0].id;
            m.run = null;
            scene.style.setProperty("--flight", "0");
            setPicks(run.picks);
            setChain([]);
            setSpinning(false);
          }
        } else if (
          !m.winner &&
          !m.dragging &&
          count > 0 &&
          !document.querySelector("dialog[open]")
        ) {
          m.travel += ((hold ? 0 : 0.025) + (quiet && hold ? 0 : m.velocity)) * delta;
          m.velocity *= Math.exp(-3.4 * delta);
        }
        const dimTarget = m.winner ? 0.1 : 1;
        m.dim = quiet
          ? dimTarget
          : m.dim + (dimTarget - m.dim) * (1 - Math.exp(-7 * delta));
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
          // Chosen decks stay lit and labelled as the spiral turns on.
          const seat = m.lit.get(index);
          if (node.dataset.seat !== (seat ? String(seat) : undefined)) {
            if (seat) node.dataset.seat = String(seat);
            else delete node.dataset.seat;
            node.classList.toggle("is-chosen", !!seat);
          }
          if (p.opacity === 0) {
            if (node.style.visibility !== "hidden") {
              node.style.visibility = "hidden";
              node.tabIndex = -1;
            }
            return;
          }
          node.style.visibility = "visible";
          node.style.transform = `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.yaw}deg) rotateZ(${p.roll}deg)`;
          node.style.opacity = String(p.opacity * m.dim);
          node.style.filter = `brightness(${seat ? Math.max(0.8, p.brightness) : p.brightness}) blur(${quiet || seat ? 0 : p.blur}px)`;
          node.style.zIndex = String(Math.round(p.depth * 100));
          node.style.pointerEvents =
            p.opacity < 0.2 || !!m.run || !!m.winner ? "none" : "auto";
          node.tabIndex =
            firstSlots[index] &&
            !m.run &&
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
  }, [items, firstSlots, count, setSpinning]);
  function explore() {
    motion.current.winner = null;
    motion.current.lit = new Map();
    setPicks([]);
  }
  function choosePlayers(n: number) {
    setPlayers(n);
    savePlayers(n);
  }
  function spin() {
    if (spinning || !count) return;
    stage.current?.parentElement?.scrollIntoView({
      block: "start",
      behavior: instantPick ? "instant" : "smooth",
    });
    const chosen = drawDistinct(decks, seats);
    explore();
    const m = motion.current;
    m.velocity = 0;
    if (instantPick || count === 1) {
      m.winner = chosen[0].id;
      setPicks(chosen);
      return;
    }
    // A long first spin to the first chosen deck, then on to whichever of the
    // others comes up next on the spiral. Seats follow that order: Player 1
    // is still uniformly random, and every deck is equally likely in each seat.
    const ids = items.map(d => d.id);
    const from = { travel: m.travel, turn: m.turn };
    const stops: Run["stops"] = [];
    const visit: Deck[] = [];
    const left = [...chosen];
    let at = nearestLanding(ids, left[0].id, from.travel, from.turn, 2 + randomIndex(151) / 100, 1);
    for (;;) {
      stops.push(at);
      visit.push(left.shift()!);
      if (!left.length) break;
      const options = left.map(deck => nearestLanding(ids, deck.id, at.travel, at.turn, 0.22, 0));
      const next = options.reduce((best, option, i) => option.travel < options[best].travel ? i : best, 0);
      [left[0], left[next]] = [left[next], left[0]];
      at = options[next];
    }
    chosen.splice(0, chosen.length, ...visit);
    const travels = stops.map(s => s.travel);
    // Stop on each deck and hold there briefly. Longer gaps get a little more time.
    const points: number[] = [], arrivals: number[] = [];
    let t = 5200 + randomIndex(2201);
    travels.forEach((travel, i) => {
      if (i) t += Math.min(3200, 1300 + 500 * (travel - travels[i - 1])) + randomIndex(301);
      points.push(travel);
      arrivals.push(t);
      if (i < travels.length - 1) {
        t += HOLD;
        points.push(travel);
        arrivals.push(t);
      }
    });
    m.run = {
      started: performance.now(),
      revealAt: t + (chosen.length > 1 ? HOLD : 0),
      from,
      stops,
      travelAt: stopTravel(from.travel, points, arrivals),
      picks: chosen,
      passed: 0,
    };
    setChain([]);
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
      travel = dragTravel(dx, dy, e.currentTarget.clientHeight, e.currentTarget.clientWidth);
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
  const motionControls = <div className="helix-motion-controls" role="group" aria-label="Picker motion">
    <button
      className="text-button"
      disabled={spinning || !!winner || !count}
      onClick={() => setPaused((p) => !p)}
      aria-label={paused ? "Resume drift" : "Pause drift"}
      title="Stop or resume automatic drift. Dragging still coasts after release."
    >
      {paused ? <Play size={12} /> : <Pause size={12} />}
      <span>{paused ? "Resume drift" : "Pause drift"}</span>
    </button>
    <label title="Show the chosen deck immediately without a spin. Drift is controlled separately.">
      <input
        type="checkbox"
        checked={instantPick}
        disabled={spinning}
        onChange={(e) => setInstantPick(e.target.checked)}
      />
      Instant pick
    </label>
  </div>;
  const playerCount = !!count && (
    <PlayerCount
      value={seats}
      available={count}
      disabled={spinning}
      onChange={choosePlayers}
    />
  );
  const fewer = players > count && count > 0;
  const choosing = seats > 1 ? `Choosing ${seats} decks…` : "Choosing your deck…";

  return (
    <section
      className={`helix-picker ${spinning ? "is-spinning" : ""} ${winner ? "has-winner" : ""} ${chain.length ? "is-chaining" : ""} ${systemReduced ? "reduced-motion" : ""}`}
      aria-label="Random deck picker"
    >
      <PickerBar
        compact={compact}
        presentation={presentation}
        scope={scopeControl}
        players={playerCount}
        motion={motionControls}
        summary={[`${seats} ${seats === 1 ? "player" : "players"}`, scopeLabel].filter(Boolean).join(" · ")}
        disabled={spinning}
      />
        <span className="sr-only" role="status">
          {spinning
            ? seats > 1 ? `Picking ${seats} decks…` : "Picking a deck…"
            : winner
              ? multi ? `${picks.length} decks selected` : "Deck selected"
              : paused
                ? "Motion paused"
                : "Deck picker"}
        </span>
      <div className="helix-intro">
        <h2>What are we playing?</h2>
        <p>
          {count
            ? "Browse your decks or pick one at random."
            : "No matching decks. Adjust your filters or clear your selection."}
        </p>
      </div>
      <div
        ref={stage}
        className={`helix-stage ${dragging ? "is-dragging" : ""}`}
        aria-label="Moving double helix of decks"
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
        <div className="helix-scene">
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
                firstSlots[index] &&
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
                src={coverOf(deck).art}
                alt={coverOf(deck).name}
                colors={deck.colors}
                eager={index < 42}
              />
              <span className="helix-card-shade" />
              <span className="helix-card-caption">
                <strong>{deck.name}</strong>
                <Mana colors={deck.colors} size="mini" />
              </span>
              <span className="helix-card-edge" />
            </button>
          ))}
        </div>
        </div>
        {chain.length > 0 && (
          <ol className="chain-chips" aria-hidden="true">
            {chain.map((deck, index) => (
              <li key={deck.id}>
                <span>{seatName(index)}</span>
                {deck.name}
              </li>
            ))}
          </ol>
        )}
        {winner && (
          <div
            ref={reveal}
            className={`helix-reveal ${multi ? `is-multi seats-${picks.length}` : ""}`}
            key={picks.map(d => d.id).join()}
            style={{ "--seats": picks.length } as CSSProperties}
          >
            <div className="reveal-seats" role={multi ? "list" : undefined}>
              {picks.map((deck, index) => {
                return (
                  <div
                    key={deck.id}
                    className="reveal-seat"
                    role={multi ? "listitem" : undefined}
                    data-seat={index + 1}
                    style={{ "--i": index } as CSSProperties}
                  >
                    {multi && <span className="seat-label">{seatName(index)}</span>}
                    <div className="reveal-card-wrap">
                      <RevealGlow deck={deck} />
                      <button
                        className="revealed-card"
                        aria-label={multi ? `View ${seatName(index)}'s deck ${deck.name}` : `View winning deck ${deck.name}`}
                        onClick={() => openDeck(deck)}
                      >
                        <Artwork
                          src={coverOf(deck).image}
                          alt={coverOf(deck).name}
                          colors={deck.colors}
                          eager
                        />
                      </button>
                    </div>
                    {multi && (
                      <span className="seat-caption">
                        <a href={deck.sourceUrl} target="_blank" rel="noreferrer" title={`Open on ${deck.sourceName}`}>
                          {deck.name}
                        </a>
                        <Mana colors={deck.colors} size="mini" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!winner && !!count && (
          <div className="helix-gesture">
            <Hand size={13} />
            {spinning
              ? seats > 1 ? `Picking ${seats} from your filtered decks…` : "Picking from your filtered decks…"
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
      <div className={`helix-dock ${winner ? "with-result" : ""} ${multi ? "with-seats" : ""}`}>
        <div
          className={winner && !multi ? "helix-selection" : "sr-only"}
          aria-live="polite"
          aria-atomic="true"
        >
          {spinning ? (
            choosing
          ) : multi ? (
            picks.map((deck, index) => `${seatName(index)}: ${deck.name}.`).join(" ")
          ) : winner ? (
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
          ) : (
            `${count} eligible ${count === 1 ? "deck" : "decks"}`
          )}
        </div>
        {!compact && playerCount}
        <div className="helix-dock-actions">
          <button
            className="button button-gold spin-button"
            onClick={spin}
            disabled={spinning || !count}
            title={
              count
                ? seats > 1
                  ? `Each eligible deck has a ${seats} in ${count} chance of being picked.`
                  : `Each eligible deck has a 1 in ${count} chance.`
                : "Try another filter."
            }
          >
            {spinning ? (
              <span className="loading-dot" />
            ) : winner ? (
              <RotateCcw size={16} />
            ) : (
              <Dices size={17} />
            )}
            {spinning
              ? choosing
              : winner
                ? "Pick again"
                : seats > 1 ? `Pick ${seats} decks` : "Pick a deck"}
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
        {fewer && !winner && (
          <p className="player-note">
            Only {count} {count === 1 ? "deck matches" : "decks match"}, so this picks {count}.
          </p>
        )}
        {!compact && motionControls}
      </div>
    </section>
  );
}
