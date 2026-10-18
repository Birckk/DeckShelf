import { type Collection, type CollectionSource, type Deck } from "./domain.ts";

export function parseSourceInput(
  input: string,
  kind: "account" | "folder" | "deck" = "account",
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
    ...(previous?.ownedIds ? { ownedIds: previous.ownedIds } : {}),
    ...((source.folderPath ?? previous?.folderPath) !== undefined ? { folderPath: source.folderPath ?? previous?.folderPath } : {}),
    ...((source.connectionKey ?? previous?.connectionKey) !== undefined ? { connectionKey: source.connectionKey ?? previous?.connectionKey } : {}),
    ...((source.connectionName ?? previous?.connectionName) !== undefined ? { connectionName: source.connectionName ?? previous?.connectionName } : {}),
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

export function importFolderSelection(collection: Collection, sources: CollectionSource[], accepted: Deck[], existing: Deck[], pauseGroups: string[] = []): Collection {
  let next = saveSnapshots(collection, accepted, true);
  const acceptedIds = new Set(accepted.map(deck => deck.id));
  for (const source of sources) {
    const ids = source.entries.map(entry => entry.id).filter(id => acceptedIds.has(id));
    if (!ids.length) continue;
    const previous = next.sources?.find(s => s.key === source.key);
    // Legacy membership is implicit in knownIds. Freeze it before adding discoveries
    // that may already be saved in another, paused collection.
    if (previous && previous.selectedIds === undefined)
      next = { ...next, sources: next.sources!.map(s => s.key === source.key ? { ...s, selectedIds: sourceDeckIds(previous, existing) } : s) };
    const listing = {
      ...source,
      ...(previous?.formatScope === 'all' ? {
        formatScope: 'all' as const,
        // A Commander preview is only a partial listing of this connection.
        ...(source.formatScope !== 'all' ? { entries: [...new Map([...previous.entries, ...source.entries].map(entry => [entry.id, entry])).values()] } : {}),
      } : {}),
      selectedIds: [],
    };
    if (listing.entries.length > 1000) throw new Error('This source has more than 1,000 decks. Link a smaller folder instead.');
    next = rememberSource(next, listing);
    next = selectSourceDecks(next, source.key, ids, existing);
    next = enableGroup(next, source.key, true);
  }
  if ((next.sources?.length || 0) > 50) throw new Error('Choose fewer folders. A collection can link up to 50 sources.');
  if (accepted.length && pauseGroups.length) {
    const enabled = new Set(sources.filter(s => s.entries.some(e => acceptedIds.has(e.id))).map(s => s.key));
    next = { ...next, disabledGroups: [...new Set([...(next.disabledGroups || []), ...pauseGroups.filter(key => !enabled.has(key))])] };
  }
  return next;
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
  const linked = new Set([...sourceGroups.flatMap(g => g.ids), ...(collection.sources || []).flatMap(s => s.ownedIds || [])]);
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
      key: "demo", name: "Official Commander precons", kind: "demo" as const,
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
    enabled: groupActive(collection, g.key),
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
/** Names of the enabled collections each deck is shown from, in sidebar order. */
export function deckCollections(groups: ShowcaseGroup[]): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const group of groups.filter(g => g.enabled)) for (const id of group.ids) names.set(id, [...(names.get(id) || []), group.name]);
  return names;
}
export function groupActive(collection: Collection, key: string): boolean {
  return !collection.disabledGroups?.includes(key) && !collection.archivedGroups?.includes(key);
}
// Hidden collections leave the sidebar and overview grid and stay out of Enable all,
// independently of the temporary pill. Precons keep their v1 `demo.removed` flag.
export function isHidden(collection: Collection, key: string): boolean {
  return key === "demo" ? !!collection.demo?.removed : !!collection.archivedGroups?.includes(key);
}
export function archiveGroups(collection: Collection, keys: string[], disabled: boolean): Collection {
  return { ...collection, archivedGroups: disabled
    ? [...new Set([...(collection.archivedGroups || []), ...keys])]
    : (collection.archivedGroups || []).filter(key => !keys.includes(key)) };
}
// Showing a collection again also switches it on. Its deck choices were never touched.
export function hideGroups(collection: Collection, keys: string[], hidden: boolean): Collection {
  let next = archiveGroups(collection, keys.filter(key => key !== "demo"), hidden);
  if (keys.includes("demo") && next.demo) next = { ...next, demo: { ...next.demo, removed: hidden } };
  return hidden ? next : enableGroups(next, keys, true, true);
}

export type HiddenEntry = { key: string; name: string; keys: string[]; scope: boolean; count: number };
// One row per hidden connection, or per hidden folder when the rest of its connection is visible.
export function hiddenEntries(collection: Collection, groups: ShowcaseGroup[]): HiddenEntry[] {
  const sources = collection.sources || [];
  const entries: HiddenEntry[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!isHidden(collection, source.key)) continue;
    const connection = source.connectionKey ? sources.filter(s => s.connectionKey === source.connectionKey) : [source];
    const all = connection.length > 1 && connection.every(s => isHidden(collection, s.key));
    if (all) {
      if (seen.has(source.connectionKey!)) continue;
      seen.add(source.connectionKey!);
      entries.push({ key: `scope:connection:${source.connectionKey}`, name: source.connectionName || source.name, keys: connection.map(s => s.key), scope: true,
        count: new Set(connection.flatMap(s => s.knownIds)).size });
    } else entries.push({ key: source.key, keys: [source.key], scope: false, count: source.knownIds.length,
      name: source.folderPath && source.connectionName ? `${source.connectionName} / ${source.folderPath}` : source.name });
  }
  for (const group of groups) if (!["account", "folder"].includes(group.kind) && isHidden(collection, group.key))
    entries.push({ key: group.key, name: group.name, keys: [group.key], scope: false, count: group.available });
  if (collection.demo?.removed)
    entries.push({ key: "demo", name: "Official Commander precons", keys: ["demo"], scope: false, count: collection.demo.decks.length });
  return entries;
}
export function enableGroup(
  collection: Collection,
  key: string,
  enabled: boolean,
): Collection {
  return {
    ...collection,
    ...(collection.pausedGroups ? { pausedGroups: collection.pausedGroups.filter(p => !p.keys.includes(key)) } : {}),
    disabledGroups: enabled
      ? (collection.disabledGroups || []).filter((k) => k !== key)
      : [...new Set([...(collection.disabledGroups || []), key])],
  };
}
// A parent pill pauses its current subset; explicit bulk actions replace that subset.
export function enableGroups(collection: Collection, keys: string[], enabled: boolean, all = false): Collection {
  if (keys.length === 1) return enableGroup(collection, keys[0], enabled);
  const same = (p: { keys: string[] }) => p.keys.length === keys.length && p.keys.every(key => keys.includes(key));
  const previous = collection.pausedGroups?.find(same);
  const active = keys.filter(key => !collection.disabledGroups?.includes(key));
  const restore = enabled ? (all ? keys : previous?.enabled ?? keys) : [];
  let pausedGroups = (collection.pausedGroups || []).filter(p => !same(p) &&
    // Editing a subtree supersedes a remembered enclosing pause.
    !keys.some(key => p.keys.includes(key) && !p.keys.every(k => keys.includes(k))));
  if (all) pausedGroups = pausedGroups.filter(p => !p.keys.some(key => keys.includes(key)));
  else if (!enabled && active.length) pausedGroups = [...pausedGroups, { keys: [...keys], enabled: active }].slice(-100);
  else if (!enabled && previous) pausedGroups.push(previous);
  return { ...collection, pausedGroups, disabledGroups: [...new Set([
    ...(collection.disabledGroups || []).filter(key => !keys.includes(key)),
    ...keys.filter(key => !restore.includes(key)),
  ])] };
}

export function onlyGroup(
  collection: Collection,
  key: string,
  groups: ShowcaseGroup[],
): Collection {
  return {
    ...collection,
    pausedGroups: [],
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
            ownedIds: [...new Set([...(s.ownedIds || []), ...sourceDeckIds(s, decks), ...ids])],
          }
        : s,
    ),
  };
}
// Removing a source also removes its saved decks, unless another source or Individual decks still has them.
export function removeSources(collection: Collection, keys: string[]): Collection {
  const sources = collection.sources || [];
  const gone = sources.filter(s => keys.includes(s.key));
  const kept = sources.filter(s => !keys.includes(s.key));
  const stillUsed = new Set([...(collection.manualIds || []), ...kept.flatMap(s => [...(s.selectedIds ?? s.knownIds), ...(s.ownedIds || [])])]);
  const ids = new Set(gone.flatMap(s => [...s.knownIds, ...(s.ownedIds || [])]).filter(id => !stillUsed.has(id)));
  const touches = (p: { keys: string[] }) => p.keys.some(key => keys.includes(key));
  return {
    ...collection,
    sources: kept,
    added: collection.added.filter(d => !ids.has(d.id)),
    hidden: collection.hidden.filter(id => !ids.has(id)),
    disabledGroups: (collection.disabledGroups || []).filter(k => !keys.includes(k)),
    archivedGroups: (collection.archivedGroups || []).filter(k => !keys.includes(k)),
    ...(collection.pausedGroups ? { pausedGroups: collection.pausedGroups.filter(p => !touches(p)) } : {}),
  };
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

// The bundled snapshot is the baseline; updating adds precons Archidekt listed since, newest first.
// They show straight away unless the user has already unticked some precons, then they wait to be ticked.
export function updateDemo(collection: Collection, found: Deck[], checkedAt: string): Collection {
  if (!collection.demo) return collection;
  const known = new Set(collection.demo.decks.map(d => d.id));
  const fresh = found.filter(d => !known.has(d.id)).slice(0, 1000 - known.size);
  const curated = collection.demo.decks.some(d => collection.hidden.includes(d.id));
  return {
    ...collection,
    demo: { ...collection.demo, snapshotAt: checkedAt, decks: [...fresh, ...collection.demo.decks] },
    hidden: curated ? [...new Set([...collection.hidden, ...fresh.map(d => d.id)])] : collection.hidden,
  };
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

// Source membership stays independent when several sources contain the same deck.
export function setSourceSelection(collection: Collection, keys: string[], ids: string[], selected: boolean, decks: Deck[]): Collection {
  const wanted = new Set(ids);
  const next = { ...collection, sources: (collection.sources || []).map(source => {
    if (!keys.includes(source.key)) return source;
    const current = sourceDeckIds(source, decks);
    const available = new Set(source.knownIds);
    return { ...source, ownedIds: [...new Set([...(source.ownedIds || []), ...current, ...(selected ? ids.filter(id => available.has(id)) : [])])], selectedIds: selected
      ? [...new Set([...current, ...ids.filter(id => available.has(id))])]
      : current.filter(id => !wanted.has(id)) };
  }) };
  return selected ? setShown(next, ids, true) : next;
}
