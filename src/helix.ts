export const TAU = Math.PI * 2;
export const CENTERED_START = { travel: 0.5, turn: 0 } as const;
// Seven decks occupy 21 rows after repetition: keep that spacing for every pool.
const ROWS_PER_WINDOW = 21;
const loopLength = (slots: number) =>
  Math.max(1, Math.ceil(slots / 2) / ROWS_PER_WINDOW);
export const modulo = (n: number, size = 1) => ((n % size) + size) % size;

// One degree of freedom: both drag directions advance the same fixed screw.
// A full travel cycle contains two turns and one stage's worth of vertical travel.
export function dragTravel(dx: number, dy: number, height: number) {
  return (dx * 0.009) / (TAU * 2) + dy / (height + 370);
}

export function helixPose(
  index: number,
  slots: number,
  travel: number,
  turn: number,
  width: number,
  height: number,
) {
  const loop = loopLength(slots);
  // A larger pool extends the loop beyond the viewport instead of compressing it.
  // Wrapping happens outside the faded edges, so every deck still passes through.
  const overflow = (loop - 1) / 2;
  const progress =
    modulo(Math.floor(index / 2) / ROWS_PER_WINDOW + travel + overflow, loop) -
    overflow;
  const angle = progress * TAU * 2 + (index % 2) * Math.PI + turn;
  const depth = (Math.cos(angle) + 1) / 2;
  const edge = Math.max(0, Math.min(1, progress * 10, (1 - progress) * 10));
  return {
    x: Math.sin(angle) * Math.min(310, width * 0.32),
    y: (progress - 0.5) * (height + 370),
    z: (depth - 0.5) * 290,
    yaw: -Math.sin(angle) * 42,
    roll: Math.sin(angle * 0.5) * 7,
    opacity: edge * (0.25 + depth * 0.75),
    brightness: 0.36 + depth * 0.64,
    blur: (1 - depth) * 2.1,
    depth,
  };
}
export function landing(
  index: number,
  slots: number,
  travel: number,
  turn: number,
  minimumTravel = 2,
) {
  return {
    travel:
      travel +
      minimumTravel +
      modulo(
        0.5 - Math.floor(index / 2) / ROWS_PER_WINDOW - travel - minimumTravel,
        loopLength(slots),
      ),
    turn: turn + TAU + modulo(-(index % 2) * Math.PI - turn, TAU),
  };
}
export const flightEase = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

// Each strand gets complete A, B, C... cycles, offset by one deck.
// Interleaving the original sequence assigned only A to one strand in a two-deck pool.
export function repeatDecks<T>(decks: readonly T[]): T[] {
  if (!decks.length) return [];
  const rows = Math.ceil(ROWS_PER_WINDOW / decks.length) * decks.length;
  return Array.from(
    { length: rows * 2 },
    (_, i) => decks[(Math.floor(i / 2) + (i % 2)) % decks.length],
  );
}
