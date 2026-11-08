import type { Deck } from "./domain";

// The precon snapshot is the largest file in the app and most visits never need it,
// so it loads on demand. main.tsx loads it before the first render when there is no
// saved collection, since a new shelf starts with the precons. The service worker
// precaches it with every other built file, so it is still there offline.
export type PreconSnapshot = { snapshotAt: string; decks: Deck[] };
let snapshot: PreconSnapshot | undefined;

export async function loadPrecons(): Promise<PreconSnapshot> {
  snapshot ??= (await import("./data/precons.json")).default as PreconSnapshot;
  return snapshot;
}

/** The snapshot if it has loaded already. */
export function loadedPrecons(): PreconSnapshot | undefined {
  return snapshot;
}
