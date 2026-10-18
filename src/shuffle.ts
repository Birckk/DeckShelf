import { drawDistinct, type Deck } from "./domain.ts";

// Snapshot the eligible pool and choose before any presentation begins. The
// gathered cards and animation never feed back into the fair draw.
export function createShuffleDeal(decks: readonly Deck[], players: number, fill?: (a: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>) {
  return { gathered: [...decks], picks: drawDistinct(decks, players, fill) };
}

