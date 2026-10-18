// Audited against Archidekt's published client on 2026-10-16; see docs/FORMATS.md.
const names = ['Unknown', 'Standard', 'Modern', 'Commander', 'Legacy', 'Vintage', 'Pauper', 'Custom', 'Frontier', 'Future Standard', 'Penny Dreadful', '1v1 Commander', 'Duel Commander', 'Standard Brawl', 'Oathbreaker', 'Pioneer', 'Historic', 'Pauper EDH', 'Alchemy', null, 'Brawl', 'Gladiator', 'Premodern', 'PreDH', 'Timeless', 'Canadian Highlander', 'Competitive Brawl', 'Tiny Leaders Reborn'];

export function archidektFormat(value) {
  const sourceId = Number.isSafeInteger(value) && value >= 0 ? value : null;
  const name = sourceId !== null ? names[sourceId] : null;
  return {
    id: name && sourceId !== 0 ? name.toLowerCase().replaceAll(' ', '-') : sourceId === null ? 'unknown' : `unknown-${sourceId}`,
    name: name && sourceId !== 0 ? name : sourceId === null ? 'Unknown' : `Unknown (${sourceId})`,
    sourceId,
  };
}
export const COMMANDER_FORMAT = archidektFormat(3);
export function formatName(id) {
  for (let sourceId = 1; sourceId < names.length; sourceId++) {
    const format = archidektFormat(sourceId);
    if (format.id === id) return format.name;
  }
  const unknown = /^unknown-(\d+)$/.exec(id);
  return unknown ? `Unknown (${unknown[1]})` : 'Unknown';
}
// An additive v1 migration: never rewrite a legacy snapshot just to label it.
export function formatOf(deck) { return deck.format ?? COMMANDER_FORMAT; }
export function validFormat(value) {
  if (!value || typeof value !== 'object') return false;
  const expected = archidektFormat(value.sourceId);
  return value.sourceId === expected.sourceId && value.id === expected.id && value.name === expected.name;
}
