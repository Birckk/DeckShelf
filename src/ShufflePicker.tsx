import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Dices, RotateCcw } from "lucide-react";
import { coverOf, type Deck } from "./domain";
import { Artwork, Mana } from "./components";
import { CardBackArt } from "./placeholders/CardBackArt";
import { PlayerCount, savedPlayers, savePlayers } from "./PlayerCount";
import { usePickerMotion } from "./PickerMotion";
import { PickerBar, useCompactPicker, type PresentationControl } from "./PickerControls";
import { RevealGlow } from "./Atmosphere";
import { createShuffleDeal } from "./shuffle";
import "./shuffle-picker.css";

type Phase = "ready" | "gather" | "shuffle" | "deal" | "flip" | "result";
// Shuffle and deal (#76): the eligible decks gather from a collection grid into one
// pile, shuffle, and deal one card per player into a row of seats, then flip.
export default function ShufflePicker({ decks, spinning, setSpinning, openDeck, onWinner, scopeControl, scopeLabel = "", presentation }: {
  scopeControl?: ReactNode; scopeLabel?: string; presentation?: PresentationControl;
  decks: Deck[]; spinning: boolean; setSpinning: (value: boolean) => void;
  openDeck: (deck: Deck) => void; onWinner: (deck: Deck | null) => void;
}) {
  const [players, setPlayers] = useState(savedPlayers);
  const { instantPick, setInstantPick, systemReduced } = usePickerMotion();
  const compact = useCompactPicker();
  const [phase, setPhase] = useState<Phase>("ready");
  const [run, setRun] = useState<ReturnType<typeof createShuffleDeal> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scene = useRef<HTMLElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const poolKey = decks.map(d => d.id).join(',');
  const seats = Math.max(1, Math.min(players, decks.length));
  const complete = phase === "result";
  const revealing = phase === "flip" || complete;
  function cancel() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffect(() => {
    cancel(); setRun(null); setPhase("ready"); setSpinning(false);
    return () => { cancel(); setSpinning(false); };
  }, [poolKey, setSpinning]);
  const winner = complete ? run?.picks[0] ?? null : null;
  useEffect(() => { onWinner(winner); return () => onWinner(null); }, [winner, onWinner]);
  useEffect(() => {
    if (instantPick && run && phase !== "ready" && phase !== "result") {
      cancel(); setPhase("result"); setSpinning(false);
    }
  }, [instantPick, run, phase, setSpinning]);
  useLayoutEffect(() => {
    if (phase !== "deal" || !table.current) return;
    const box = table.current.getBoundingClientRect();
    table.current.querySelectorAll<HTMLElement>(".reveal-seat").forEach(seat => {
      const card = seat.querySelector<HTMLElement>(".shuffle-dealt")!;
      // Each card flies from the pile at the table's centre to its own seat. The
      // untransformed wrapper gives a stable destination while the card animates.
      const rect = seat.querySelector<HTMLElement>(".shuffle-card")!.getBoundingClientRect();
      card.style.setProperty("--dx", (box.left + box.width / 2 - rect.left - rect.width / 2) + "px");
      card.style.setProperty("--dy", (box.top + box.height / 2 - rect.top - rect.height / 2) + "px");
    });
  }, [phase]);
  // Back from a result to the decks on the table, like the helix's Browse decks.
  function back() {
    cancel(); setRun(null); setPhase("ready");
  }
  function pick() {
    if (spinning || !decks.length) return;
    cancel();
    // Phones in landscape scroll the stage into view, as the helix does.
    scene.current?.scrollIntoView({ block: "start", behavior: instantPick ? "instant" : "smooth" });
    // Same unique eligible decks and drawDistinct/randomIndex as the helix.
    const next = createShuffleDeal(decks, seats);
    setRun(next);
    if (instantPick || decks.length === 1) { setPhase("result"); return; }
    setSpinning(true); setPhase("gather");
    const later = (ms: number, nextPhase: Phase) => timers.current.push(setTimeout(() => {
      setPhase(nextPhase);
      if (nextPhase === "result") setSpinning(false);
    }, ms));
    later(1100, "shuffle"); later(2200, "deal"); later(3100, "flip"); later(3700, "result");
  }
  const gathered = run?.gathered ?? decks;
  const dealing = phase === "deal" || revealing;
  const choosing = seats > 1 ? `Choosing ${seats} decks…` : "Choosing your deck…";
  const playerCount = !!decks.length && <PlayerCount value={seats} available={decks.length} disabled={spinning} onChange={n => { setPlayers(n); savePlayers(n); }} />;
  const motion = <div className="helix-motion-controls" role="group" aria-label="Picker motion">
    <label title="Show the chosen decks immediately without the shuffle.">
      <input type="checkbox" checked={instantPick} disabled={spinning} onChange={e => setInstantPick(e.target.checked)} />
      Instant pick
    </label>
  </div>;
  return <section ref={scene} className={`shuffle-picker phase-${phase} ${instantPick ? 'is-instant' : ''} ${systemReduced ? 'reduced-motion' : ''}`} aria-label="Shuffle and deal picker">
    <PickerBar
      compact={compact}
      presentation={presentation}
      scope={scopeControl}
      players={playerCount}
      motion={motion}
      summary={[`${seats} ${seats === 1 ? "player" : "players"}`, scopeLabel].filter(Boolean).join(" · ")}
      disabled={spinning}
    />
    <div className="shuffle-heading"><h2>What are we playing?</h2><p>{decks.length ? `${decks.length} eligible ${decks.length === 1 ? 'deck' : 'decks'} · one per player` : "No matching decks. Adjust your filters or clear your selection."}</p></div>
    <div className="shuffle-table" ref={table}>
      {!dealing && !!decks.length && <div className="shuffle-gather" aria-hidden="true">
        {gathered.map((deck, i) => <div key={deck.id} className="gather-card" style={{ '--i': i, '--x': (i % 8 - 3.5) * 118, '--y': (Math.floor(i / 8) % 3 - 1) * 155, '--angle': (i % 5 - 2) * 3, '--delay': `${Math.min(i * 12, 350)}ms` } as CSSProperties}>
          {phase === "ready" ? <Artwork src={coverOf(deck).image} alt="" colors={deck.colors} /> : <CardBackArt colors={[]} />}
        </div>)}
      </div>}
      {dealing && run && <ol className={`shuffle-seats seats-${run.picks.length}`} aria-label="Picked decks" style={{ '--seats': run.picks.length } as CSSProperties}>
        {run.picks.map((deck, i) => <li className="reveal-seat" key={deck.id} style={{ '--i': i } as CSSProperties}>
          {run.picks.length > 1 && <span className="seat-label">Player {i + 1}</span>}
          <div className="shuffle-card">
            {revealing && <RevealGlow deck={deck} />}
            <div className="shuffle-dealt">
              <div className="shuffle-flipper">
                <div className="shuffle-back" aria-hidden="true"><CardBackArt colors={[]} /></div>
                <button className="shuffle-front" disabled={!complete} tabIndex={complete ? 0 : -1} aria-hidden={!complete} aria-label={run.picks.length > 1 ? `View Player ${i + 1}'s deck ${deck.name}` : `View winning deck ${deck.name}`} onClick={() => openDeck(deck)}>
                  <Artwork src={coverOf(deck).image} alt={coverOf(deck).name} colors={deck.colors} eager />
                </button>
              </div>
            </div>
          </div>
          <span className="shuffle-caption" style={{ visibility: revealing ? 'visible' : 'hidden' }} aria-hidden={!complete}><span>{deck.name}</span><Mana colors={deck.colors} size="mini" /></span>
        </li>)}
      </ol>}
    </div>
    <div className="shuffle-status" role="status" aria-live="polite" aria-atomic="true">
      {complete ? run?.picks.map((deck, i) => run.picks.length > 1 ? `Player ${i + 1}: ${deck.name}.` : `Deck selected: ${deck.name}.`).join(' ') : phase === 'gather' ? 'Gathering eligible decks…' : phase === 'shuffle' ? 'Shuffling…' : phase === 'deal' ? 'Dealing one deck per player…' : phase === 'flip' ? 'Revealing decks…' : ''}
    </div>
    <div className={`helix-dock shuffle-dock ${complete ? "with-result" : ""}`}>
      {!compact && playerCount}
      <div className="helix-dock-actions">
        {complete && <button className="button helix-browse shuffle-back-button" onClick={back} aria-label="Back to the decks" title="Back to the decks"><ArrowLeft size={17} /></button>}
        <button className="button button-gold spin-button" onClick={pick} disabled={spinning || !decks.length}>
          {spinning ? <span className="loading-dot" /> : complete ? <RotateCcw size={16} /> : <Dices size={17} />}
          {spinning ? choosing : complete ? 'Pick again' : seats > 1 ? `Pick ${seats} decks` : 'Pick a deck'}
          {!spinning && <ArrowRight size={15} />}
        </button>
      </div>
      {players > decks.length && decks.length > 0 && <p className="player-note">Only {decks.length} {decks.length === 1 ? 'deck matches' : 'decks match'}, so this picks {decks.length}.</p>}
      {!compact && motion}
    </div>
  </section>;
}
