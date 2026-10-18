export type Color = "W" | "U" | "B" | "R" | "G";
export type Commander = {
  name: string;
  image: string;
  art: string;
  artist: string;
  imageSource?: string;
  artSource?: string;
};
export type Deck = {
  id: string;
  name: string;
  set: string;
  colors: Color[];
  theme: string;
  tags: string[];
  description: string;
  commanders: Commander[];
  sourceUrl: string;
  originalUrl?: string;
  sourceName: string;
  cardCount: number;
  releasedAt: string;
  fetchedAt: string;
};
export type Filters = {
  query: string;
  colors: Color[];
  exact: boolean;
  colorless: boolean;
  set: string;
  tag: string;
  count: string;
};
export const EMPTY_FILTERS: Filters = {
  query: "",
  colors: [],
  exact: false,
  colorless: false,
  set: "",
  tag: "",
  count: "",
};
export const COLORS: { id: Color; name: string }[] = [
  { id: "W", name: "White" },
  { id: "U", name: "Blue" },
  { id: "B", name: "Black" },
  { id: "R", name: "Red" },
  { id: "G", name: "Green" },
];
export function matchesDeck(deck: Deck, f: Filters): boolean {
  const terms = f.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const text = [
    deck.name,
    deck.set,
    deck.theme,
    deck.description,
    ...deck.tags,
    ...deck.commanders.map((c) => c.name),
  ]
    .join(" ")
    .toLocaleLowerCase();
  if (!terms.every((t) => text.includes(t))) return false;
  if (f.colorless && deck.colors.length !== 0) return false;
  if (!f.colorless && f.colors.length) {
    if (!f.colors.every((c) => deck.colors.includes(c))) return false;
    if (f.exact && deck.colors.length !== f.colors.length) return false;
  }
  return (
    (!f.set || deck.set === f.set) &&
    (!f.tag || deck.tags.includes(f.tag)) &&
    (!f.count || deck.colors.length === Number(f.count))
  );
}
export type DescriptionPart = { text: string; card?: true };
// Archidekt descriptions reference cards as [[Card Name]]; split them out so
// the name renders as plain (emphasised) text instead of raw markup.
// Archidekt mirrors Scryfall's card images byte for byte, but only Scryfall's CDN allows
// cross-origin reads, which lets the service worker check and keep artwork for offline use.
const ARCHIDEKT_IMAGE = /^https:\/\/card-images\.archidekt\.com\/(art|grid)\/(front|back)\/([0-9a-f])\/([0-9a-f])\/([0-9a-f-]{36})\.webp$/;
export function cardImage(url: string) {
  return url.replace(ARCHIDEKT_IMAGE, "https://cards.scryfall.io/$1/$2/$3/$4/$5.webp");
}
export function descriptionParts(description: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let last = 0;
  for (const m of description.matchAll(/\[\[([^[\]]+)\]\]/g)) {
    if (m.index > last) parts.push({ text: description.slice(last, m.index) });
    parts.push({ text: m[1], card: true });
    last = m.index + m[0].length;
  }
  if (last < description.length) parts.push({ text: description.slice(last) });
  return parts;
}
export function randomIndex(
  length: number,
  fill: (a: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (a) =>
    crypto.getRandomValues(a),
): number {
  if (!Number.isInteger(length) || length < 1 || length > 10000)
    throw new Error("No eligible decks.");
  // Rejection sampling avoids modulo bias.
  const limit = Math.floor(0x100000000 / length) * length;
  const buffer = new Uint32Array(1);
  do {
    fill(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % length;
}
// Partial Fisher–Yates over randomIndex: every ordered set of distinct decks is
// equally likely, so each deck keeps the same chance of being picked.
export function drawDistinct<T>(
  items: readonly T[],
  count: number,
  fill?: (a: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>,
): T[] {
  const pool = [...items];
  const size = Math.max(0, Math.min(Math.floor(count), pool.length));
  for (let i = 0; i < size; i++) {
    const j = i + randomIndex(pool.length - i, fill);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

export type CardBackStyle = "nest" | "wedges";
export type Collection = {
  cardBack?: CardBackStyle;
  /** Show card backs instead of any commander artwork, so none is fetched. */
  hideArtwork?: true;
  version: 1;
  hidden: string[];
  excluded: string[];
  added: Deck[];
  sources?: CollectionSource[];
  disabledGroups?: string[];
  archivedGroups?: string[];
  pausedGroups?: { keys: string[]; enabled: string[] }[];
  manualIds?: string[];
  // Absent means the original v1 profile: retain its 29-deck baseline.
  starter?: boolean;
  demo?: { snapshotAt: string; decks: Deck[]; removed: boolean };
};
export type SourceEntry = {
  id: string;
  name: string;
  image: string;
  colors: Color[];
};
export type CollectionSource = {
  key: string;
  kind: "account" | "folder";
  value: string;
  name: string;
  url: string;
  checkedAt: string;
  entries: SourceEntry[];
  knownIds: string[];
  selectedIds?: string[];
  ownedIds?: string[];
  folderPath?: string;
  connectionKey?: string;
  connectionName?: string;
};
export const EMPTY_COLLECTION: Collection = {
  version: 1,
  hidden: [],
  excluded: [],
  added: [],
};
function webUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
function imageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (/^\/images\/[a-zA-Z0-9.-]+$/.test(value) || webUrl(value))
  );
}
export function validateSource(value: unknown): value is CollectionSource {
  if (!value || typeof value !== "object") return false;
  const s = value as CollectionSource;
  return (
    [s.folderPath, s.connectionKey, s.connectionName].every(v => v === undefined || (typeof v === "string" && v.length <= 2000)) &&
    ["account", "folder"].includes(s.kind) &&
    typeof s.value === "string" &&
    (s.kind === "folder"
      ? /^\d{1,12}$/.test(s.value)
      : /^[\p{L}\p{N}_.@+ -]{1,100}$/u.test(s.value)) &&
    s.key === `${s.kind}:${s.value.toLowerCase()}` &&
    typeof s.name === "string" &&
    s.url ===
      (s.kind === "folder"
        ? `https://archidekt.com/folders/${s.value}`
        : `https://archidekt.com/u/${encodeURIComponent(s.value)}`) &&
    typeof s.checkedAt === "string" &&
    Number.isFinite(Date.parse(s.checkedAt)) &&
    Array.isArray(s.knownIds) &&
    s.knownIds.length <= 2000 &&
    s.knownIds.every((id) => typeof id === "string" && /^\d{1,12}$/.test(id)) &&
    (s.selectedIds === undefined ||
      (Array.isArray(s.selectedIds) &&
        s.selectedIds.length <= 2000 &&
        s.selectedIds.every(
          (id) => typeof id === "string" && s.knownIds.includes(id),
        ))) &&
    (s.ownedIds === undefined || (Array.isArray(s.ownedIds) && s.ownedIds.length <= 2000 && s.ownedIds.every(id => typeof id === "string" && s.knownIds.includes(id)))) &&
    Array.isArray(s.entries) &&
    s.entries.length <= 1000 &&
    new Set(s.entries.map((e) => e?.id)).size === s.entries.length &&
    s.entries.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        /^\d{1,12}$/.test(e.id) &&
        typeof e.name === "string" &&
        (e.image === "" || imageUrl(e.image)) &&
        Array.isArray(e.colors) &&
        e.colors.every((c) => COLORS.some((v) => v.id === c)) &&
        s.knownIds.includes(e.id),
    )
  );
}
export function validateDeck(value: unknown): value is Deck {
  if (!value || typeof value !== "object") return false;
  const d = value as Deck;
  return (
    typeof d.id === "string" &&
    /^\d{1,12}$/.test(d.id) &&
    [
      "name",
      "set",
      "theme",
      "description",
      "sourceName",
      "releasedAt",
      "fetchedAt",
    ].every(
      (k) => typeof (d as unknown as Record<string, unknown>)[k] === "string",
    ) &&
    webUrl(d.sourceUrl) &&
    (!d.originalUrl || webUrl(d.originalUrl)) &&
    Number.isFinite(d.cardCount) &&
    d.cardCount >= 0 &&
    Array.isArray(d.colors) &&
    d.colors.every((c) => "WUBRG".includes(c) && c.length === 1) &&
    new Set(d.colors).size === d.colors.length &&
    Array.isArray(d.tags) &&
    d.tags.every((t) => typeof t === "string") &&
    Array.isArray(d.commanders) &&
    d.commanders.length > 0 &&
    d.commanders.length < 10 &&
    d.commanders.every(
      (c) =>
        c &&
        typeof c.name === "string" &&
        typeof c.artist === "string" &&
        imageUrl(c.image) &&
        imageUrl(c.art),
    )
  );
}
export function parseCollection(raw: string): Collection {
  const v = JSON.parse(raw) as Collection & { disabledDecks?: string[] };
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.hidden) ||
    !Array.isArray(v.excluded) ||
    !Array.isArray(v.added) ||
    ![...v.hidden, ...v.excluded].every(
      (x) => typeof x === "string" && /^\d{1,12}$/.test(x),
    ) ||
    !v.added.every(validateDeck) ||
    v.added.length > 1000 ||
    (v.starter !== undefined && typeof v.starter !== "boolean") ||
    (v.demo !== undefined &&
      (!v.demo || typeof v.demo.removed !== "boolean" ||
        typeof v.demo.snapshotAt !== "string" || !Number.isFinite(Date.parse(v.demo.snapshotAt)) ||
        !Array.isArray(v.demo.decks) || !v.demo.decks.length || v.demo.decks.length > 1000 ||
        !v.demo.decks.every(validateDeck) ||
        new Set(v.demo.decks.map(d => d.id)).size !== v.demo.decks.length)) ||
    new Set(v.added.map((d) => d.id)).size !== v.added.length ||
    (v.disabledGroups !== undefined &&
      (!Array.isArray(v.disabledGroups) ||
        v.disabledGroups.length > 53 ||
        !v.disabledGroups.every(
          (key) =>
            typeof key === "string" &&
            (key === "starter" ||
              key === "demo" ||
              key === "manual" ||
              v.sources?.some((s) => s?.key === key)),
        ))) ||
    (v.archivedGroups !== undefined &&
      (!Array.isArray(v.archivedGroups) ||
        v.archivedGroups.length > 53 ||
        !v.archivedGroups.every(
          (key) =>
            typeof key === "string" &&
            (key === "starter" ||
              key === "demo" ||
              key === "manual" ||
              v.sources?.some((s) => s?.key === key)),
        ))) ||
    (v.disabledDecks !== undefined && (!Array.isArray(v.disabledDecks) || v.disabledDecks.length > 2000 || !v.disabledDecks.every(id => typeof id === "string" && /^\d{1,12}$/.test(id)))) ||
    (v.pausedGroups !== undefined &&
      (!Array.isArray(v.pausedGroups) || v.pausedGroups.length > 100 ||
        !v.pausedGroups.every(p => p && Array.isArray(p.keys) && p.keys.length > 1 && p.keys.length <= 50 &&
          p.keys.every(key => typeof key === "string" && Array.isArray(v.sources) && v.sources.some(s => s?.key === key)) &&
          Array.isArray(p.enabled) && p.enabled.length <= p.keys.length && p.enabled.every(key => p.keys.includes(key))))) ||
    (v.manualIds !== undefined &&
      (!Array.isArray(v.manualIds) ||
        v.manualIds.length > 2000 ||
        !v.manualIds.every(
          (id) => typeof id === "string" && /^\d{1,12}$/.test(id),
        ))) ||
    (v.sources !== undefined &&
      (!Array.isArray(v.sources) ||
        v.sources.length > 50 ||
        !v.sources.every(validateSource) ||
        new Set(v.sources.map((s) => s.key)).size !== v.sources.length))
  ) {
    throw new Error("This is not a valid DeckShelf collection file.");
  }
  return {
    version: 1,
    ...(v.cardBack === "nest" || v.cardBack === "wedges" ? { cardBack: v.cardBack } : {}),
    ...(v.hideArtwork === true ? { hideArtwork: true as const } : {}),
    ...(v.archivedGroups !== undefined ? { archivedGroups: [...new Set(v.archivedGroups)] } : {}),
    // Fold the brief per-deck disable experiment into ordinary hidden choices.
    hidden: [...new Set([...v.hidden, ...(v.disabledDecks || [])])],
    excluded: [...new Set(v.excluded)],
    added: v.added,
    ...(v.starter !== undefined ? { starter: v.starter } : {}),
    ...(v.demo !== undefined ? { demo: v.demo } : {}),
    ...(v.sources !== undefined ? { sources: v.sources } : {}),
    ...(v.pausedGroups !== undefined ? { pausedGroups: v.pausedGroups } : {}),
    ...(v.disabledGroups !== undefined
      ? { disabledGroups: [...new Set(v.disabledGroups)] }
      : {}),
    ...(v.manualIds !== undefined
      ? { manualIds: [...new Set(v.manualIds)] }
      : {}),
  };
}
