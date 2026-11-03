import { type KeyboardEvent } from "react";
import { User } from "lucide-react";

const MAX_PLAYERS = 4;
const SEATS = Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1);
const KEY = "deckshelf.picker-players";

export function savedPlayers() {
  try {
    const saved = Number(localStorage.getItem(KEY));
    return Number.isInteger(saved) && saved >= 1 && saved <= MAX_PLAYERS ? saved : 1;
  } catch {
    return 1;
  }
}
export function savePlayers(players: number) {
  try { localStorage.setItem(KEY, String(players)); } catch { /* The count still applies this session. */ }
}

const players = (n: number) => `${n} ${n === 1 ? "player" : "players"}`;

// How many decks one pick draws: one per player, 1–4, never more than the pool.
export function PlayerCount({
  value,
  available,
  disabled,
  onChange,
}: {
  value: number;
  available: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const limit = Math.max(1, Math.min(MAX_PLAYERS, available));
  const tooFew = (n: number) => n > limit;
  function arrows(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.max(1, Math.min(limit, value + step));
    onChange(next);
    (e.currentTarget.querySelector(`[data-seat="${next}"]`) as HTMLElement | null)?.focus();
  }
  return (
    <div className="player-count" role="radiogroup" aria-label="Players" onKeyDown={arrows}>
      {SEATS.map(n => (
        <button
          key={n}
          data-seat={n}
          role="radio"
          aria-checked={value === n}
          aria-label={players(n)}
          title={tooFew(n) ? `Only ${available} ${available === 1 ? "deck matches" : "decks match"}` : players(n)}
          tabIndex={value === n ? 0 : -1}
          disabled={disabled || tooFew(n)}
          className={n <= value ? "is-seated" : ""}
          onClick={() => onChange(n)}
        >
          <User size={15} strokeWidth={n <= value ? 2.4 : 1.6} />
        </button>
      ))}
      <span className="player-count-label" aria-hidden="true">{players(value)}</span>
    </div>
  );
}
