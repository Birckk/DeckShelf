import { validateDeck, type Deck } from "./domain.ts";

// Decks added from a folder listing load their full details in the background.
// Two at a time is what imports have always used and Archidekt has not limited it.
export const FILL_CONCURRENCY = 2;

export class DeckLoadError extends Error {
  // False when trying again cannot help: the deck is private, gone or has no commander.
  retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

export async function loadFullDeck(id: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<Deck> {
  let response: Response;
  try {
    response = await request(`/api/decks/${id}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]) });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new DeckLoadError("Could not reach Archidekt.", true);
  }
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok || !data) throw new DeckLoadError(data?.error || "Could not load this deck.", data?.retry !== false);
  if (!validateDeck(data) || data.id !== id) throw new DeckLoadError("The source returned incomplete deck information.", false);
  return data;
}

// A sliding pool: the next deck starts as soon as one finishes, never more than
// `concurrency` at once. Each result is reported as it arrives.
export async function fillDecks(
  ids: string[],
  load: (id: string, signal: AbortSignal) => Promise<Deck>,
  { signal, onDeck, onError, concurrency = FILL_CONCURRENCY }: {
    signal: AbortSignal;
    onDeck: (deck: Deck) => void;
    onError: (id: string, error: unknown) => void;
    concurrency?: number;
  },
) {
  let next = 0;
  async function worker() {
    while (next < ids.length && !signal.aborted) {
      const id = ids[next++];
      try {
        const deck = await load(id, signal);
        if (!signal.aborted) onDeck(deck);
      } catch (error) {
        if (!signal.aborted) onError(id, error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
}
