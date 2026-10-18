export type DeckFormat = { id: string; name: string; sourceId: number | null };
export function archidektFormat(value: unknown): DeckFormat;
export const COMMANDER_FORMAT: DeckFormat;
export function formatName(id: string): string;
export function formatOf(deck: { format?: DeckFormat }): DeckFormat;
export function validFormat(value: unknown): value is DeckFormat;
