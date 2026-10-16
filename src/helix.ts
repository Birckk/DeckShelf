export const TAU = Math.PI * 2;
export const CENTERED_START = { travel: 0.5, turn: 0 } as const;
// Seven decks occupy 21 rows after repetition: keep that spacing for every pool.
const ROWS_PER_WINDOW = 21;
const loopLength = (slots: number) =>
  Math.max(1, Math.ceil(slots / 2) / ROWS_PER_WINDOW);
export const modulo = (n: number, size = 1) => ((n % size) + size) % size;

// Keep the desktop screw unchanged; narrower stages need more room between rows
// and less perspective magnification, independent of how many decks are eligible.
const narrowness = (width: number) => Math.max(0, Math.min(1, (600 - width) / 300));
const travelSpan = (width: number, height: number) => height + 370 + 100 * narrowness(width);

// One degree of freedom: both drag directions advance the same fixed screw.
// A full travel cycle contains two turns and one stage's worth of vertical travel.
export function dragTravel(dx: number, dy: number, height: number, width = Infinity) {
  return (dx * 0.009) / (TAU * 2) + dy / travelSpan(width, height);
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
    x: Math.sin(angle) * Math.min(310, width * (0.32 + 0.10 * narrowness(width))),
    y: (progress - 0.5) * travelSpan(width, height),
    z: (depth - 0.5) * (290 - 110 * narrowness(width)),
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
  turns = 1,
) {
  return {
    travel:
      travel +
      minimumTravel +
      modulo(
        0.5 - Math.floor(index / 2) / ROWS_PER_WINDOW - travel - minimumTravel,
        loopLength(slots),
      ),
    turn: turn + TAU * turns + modulo(-(index % 2) * Math.PI - turn, TAU),
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

// The closest copy of a deck ahead of the helix, at least minimumTravel away.
export function nearestLanding(
  ids: readonly string[],
  id: string,
  travel: number,
  turn: number,
  minimumTravel: number,
  turns: number,
) {
  let best = { travel: Infinity, turn, slot: -1 };
  for (let slot = 0; slot < ids.length; slot++) {
    if (ids[slot] !== id) continue;
    const target = landing(slot, ids.length, travel, turn, minimumTravel, turns);
    if (target.travel < best.travel) best = { ...target, slot };
  }
  return best;
}

export type Stop = { travel: number; turn: number };
// A multi-deck run passes each stop front-centre in order: turn follows travel
// within each segment, so the helix is exactly aligned whenever it reaches one.
export function routeTurn(from: Stop, stops: readonly Stop[], travel: number) {
  let previous = from;
  for (const stop of stops) {
    if (travel <= stop.travel) {
      const span = stop.travel - previous.travel;
      return previous.turn + (stop.turn - previous.turn) * (span > 0 ? (travel - previous.travel) / span : 1);
    }
    previous = stop;
  }
  return previous.turn;
}

const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
// Travel over time for a pick: an eased spin to each stop in turn. A repeated
// point holds still there. arrivals[i] is when points[i] is reached, in ms.
export function stopTravel(from: number, points: readonly number[], arrivals: readonly number[]) {
  return (ms: number) => {
    const i = arrivals.findIndex(at => ms <= at);
    if (i < 0) return points.at(-1)!;
    const t0 = i ? arrivals[i - 1] : 0, p0 = i ? points[i - 1] : from;
    return p0 + (points[i] - p0) * flightEase(clamp01((ms - t0) / (arrivals[i] - t0)));
  };
}
