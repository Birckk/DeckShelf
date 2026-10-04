import { type Collection, type CollectionSource, type Deck } from "./domain.ts";

export function parseSourceInput(
  input: string,
  kind: "account" | "folder" | "deck",
) {
  let value = input.trim();
  if (/^https?:/i.test(value)) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["archidekt.com", "www.archidekt.com"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error("Use a public https://archidekt.com link.");
    const match = /^\/(u|folders|decks)\/([^/]+)(?:\/.*)?$/.exec(url.pathname);
    if (!match)
      throw new Error("Use an Archidekt profile, folder, or deck link.");
    kind =
      match[1] === "u" ? "account" : match[1] === "folders" ? "folder" : "deck";
    value = decodeURIComponent(match[2]);
  }
  if (
    !(kind === "account" ? /^[\p{L}\p{N}_.@+ -]{1,100}$/u : /^\d{1,12}$/).test(
      value,
    )
  )
    throw new Error(
      kind === "account"
        ? "Enter an Archidekt username or public profile link."
        : "Enter a public Archidekt link or its numeric ID.",
    );
  return { kind, value, key: `${kind}:${value.toLowerCase()}` };
}

export function rememberSource(
  collection: Collection,
  source: CollectionSource,
): Collection {
  const previous = collection.sources?.find((s) => s.key === source.key);
  const updated = {
    ...source,
    ...(previous?.selectedIds !== undefined
      ? { selectedIds: previous.selectedIds }
      : {}),
    knownIds: [...new Set([...(previous?.knownIds || []), ...source.knownIds])],
  };
  if (previous && previous.selectedIds === undefined)
    delete updated.selectedIds;
  if (updated.knownIds.length > 2000)
    throw new Error(
      "This source has too much history. Disconnect it and link it again; saved decks will remain.",
    );
  return {
    ...collection,
    sources: [
      ...(collection.sources || []).filter((s) => s.key !== source.key),
      updated,
    ],
  };
}

export type ShowcaseGroup = {
  key: string;
  name: string;
  kind: "included" | "demo" | "manual" | "account" | "folder";
  ids: string[];
  available: number;
  enabled: boolean;
};
export function sourceDeckIds(
  source: CollectionSource,
  decks: Deck[],
): string[] {
  const savedIds = new Set(decks.map((d) => d.id));
  return (source.selectedIds ?? source.knownIds).filter((id) =>
    savedIds.has(id),
  );
}
export function showcaseGroups(
  collection: Collection,
  catalog: Deck[],
  decks: Deck[],
): ShowcaseGroup[] {
  const seedIds = new Set(catalog.map((d) => d.id));
  const sourceGroups = (collection.sources || []).map((s) => ({
    key: s.key,
    name:
      s.key === "account:archidekt_precons"
        ? "Archidekt precon catalog"
        : s.name,
    kind: s.kind,
    ids: sourceDeckIds(s, decks),
    available: s.entries.length,
  }));
  const linked = new Set(sourceGroups.flatMap((g) => g.ids));
  const demoIds = new Set(collection.demo?.decks.map(d => d.id) || []);
  const manual = collection.added
    .filter(
      (d) =>
        collection.manualIds?.includes(d.id) ||
        (!seedIds.has(d.id) && !demoIds.has(d.id) && !linked.has(d.id)),
    )
    .map((d) => d.id);
  return [
    ...(collection.starter !== false ? [{
      key: "starter",
      name: "Included precons",
      kind: "included" as const,
      ids: [...seedIds],
      available: catalog.length,
    }] : []),
    ...(collection.demo && !collection.demo.removed ? [{
      key: "demo", name: "Commander precons demo", kind: "demo" as const,
      ids: collection.demo.decks.map(d => d.id), available: collection.demo.decks.length,
    }] : []),
    {
      key: "manual",
      name: "Individual decks",
      kind: "manual" as const,
      ids: manual,
      available: manual.length,
    },
    ...sourceGroups,
  ].map((g) => ({
    ...g,
    enabled: !collection.disabledGroups?.includes(g.key),
  }));
}
export function showcaseDecks(
  collection: Collection,
  catalog: Deck[],
  decks: Deck[],
): Deck[] {
  const ids = new Set(
    showcaseGroups(collection, catalog, decks)
      .filter((g) => g.enabled)
      .flatMap((g) => g.ids),
  );
  return decks.filter(
    (d) => ids.has(d.id) && !collection.hidden.includes(d.id),
  );
}
export function enableGroup(
  collection: Collection,
  key: string,
  enabled: boolean,
): Collection {
  return {
    ...collection,
    disabledGroups: enabled
      ? (collection.disabledGroups || []).filter((k) => k !== key)
      : [...new Set([...(collection.disabledGroups || []), key])],
  };
}
export function onlyGroup(
  collection: Collection,
  key: string,
  groups: ShowcaseGroup[],
): Collection {
  return {
    ...collection,
    disabledGroups: groups.filter((g) => g.key !== key).map((g) => g.key),
  };
}
export function selectSourceDecks(
  collection: Collection,
  key: string,
  ids: string[],
  decks: Deck[],
): Collection {
  return {
    ...collection,
    sources: (collection.sources || []).map((s) =>
      s.key === key
        ? {
            ...s,
            selectedIds: [...new Set([...sourceDeckIds(s, decks), ...ids])],
          }
        : s,
    ),
  };
}
export function disconnectSource(
  collection: Collection,
  key: string,
  catalog: Deck[],
  decks: Deck[],
): Collection {
  const visible = new Set(
    showcaseDecks(collection, catalog, decks).map((d) => d.id),
  );
  const next = {
    ...collection,
    sources: (collection.sources || []).filter((s) => s.key !== key),
    disabledGroups: (collection.disabledGroups || []).filter((k) => k !== key),
    manualIds: [...new Set([...(collection.manualIds || []),
      ...(collection.sources || []).filter(s => s.key === key).flatMap(s => sourceDeckIds(s, decks)),
    ])],
  };
  // Orphaned snapshots become individual decks, but a paused source must not reveal them.
  const newlyVisible = showcaseDecks(next, catalog, decks)
    .filter((d) => !visible.has(d.id))
    .map((d) => d.id);
  return setShown(next, newlyVisible, false);
}

export function collectionDecks(collection: Collection, legacy: Deck[]): Deck[] {
  return [...new Map([
    ...(collection.starter !== false ? legacy : []),
    ...(collection.demo && !collection.demo.removed ? collection.demo.decks : []),
    ...collection.added,
  ].map(d => [d.id, d])).values()];
}

export function addDemo(collection: Collection, snapshot: { snapshotAt: string; decks: Deck[] }): Collection {
  return enableGroup({ ...collection, demo: collection.demo
    ? { ...collection.demo, removed: false }
    : { snapshotAt: snapshot.snapshotAt, decks: snapshot.decks, removed: false } }, "demo", true);
}

export function removeDemo(collection: Collection): Collection {
  return collection.demo ? { ...collection, demo: { ...collection.demo, removed: true } } : collection;
}

export function freshCollection(snapshot: { snapshotAt: string; decks: Deck[] }): Collection {
  return addDemo({ version: 1, hidden: [], excluded: [], added: [], starter: false }, snapshot);
}

// A refresh only replaces metadata. Local visibility and picker choices survive.
export function saveSnapshots(
  collection: Collection,
  decks: Deck[],
  show = false,
): Collection {
  const ids = new Set(decks.map((d) => d.id));
  const previous = new Map(collection.added.map((d) => [d.id, d]));
  for (const d of decks) {
    previous.set(d.id, {
      ...d,
      theme: previous.get(d.id)?.theme || d.theme,
      ...(previous.get(d.id)?.originalUrl
        ? { originalUrl: previous.get(d.id)!.originalUrl }
        : {}),
    });
  }
  const added = [...previous.values()];
  if (added.length > 1000)
    throw new Error("A local collection can hold up to 1,000 imported decks.");
  return {
    ...collection,
    added,
    hidden: show
      ? collection.hidden.filter((id) => !ids.has(id))
      : collection.hidden,
  };
}

export function setShown(
  collection: Collection,
  ids: string[],
  show: boolean,
): Collection {
  const selected = new Set(ids);
  return {
    ...collection,
    hidden: show
      ? collection.hidden.filter((id) => !selected.has(id))
      : [...new Set([...collection.hidden, ...ids])],
  };
}

// Bulk actions affect only the current results. Unsaved source entries stay staged.
export function setDeckSelection(
  collection: Collection,
  pending: string[],
  rows: { id: string; saved: boolean }[],
  selected: boolean,
): { collection: Collection; pending: string[] } {
  const ids = new Set(rows.map((row) => row.id));
  return {
    collection: setShown(
      collection,
      rows.filter((row) => row.saved).map((row) => row.id),
      selected,
    ),
    pending: selected
      ? [
          ...new Set([
            ...pending,
            ...rows.filter((row) => !row.saved).map((row) => row.id),
          ]),
        ]
      : pending.filter((id) => !ids.has(id)),
  };
}
