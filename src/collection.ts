import { formatOf, parseCollection, type Collection, type CollectionSource, type Deck, type SourceEntry } from "./domain.ts";

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
    ...previous,
    ...source,
    ...((previous?.pendingIds || source.pendingIds) ? { pendingIds: [...new Set([...(previous?.pendingIds || []), ...(source.pendingIds || [])])] } : {}),
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

export function importFolderSelection(collection: Collection, sources: CollectionSource[], accepted: Deck[], existing: Deck[], pauseGroups: string[] = [], requestedIds: string[] = accepted.map(deck => deck.id)): Collection {
  let next = saveSnapshots(materializeIndependentDecks(collection), accepted, true);
  const acceptedIds = new Set(accepted.map(deck => deck.id));
  for (const source of sources) {
    const ids = source.entries.map(entry => entry.id).filter(id => acceptedIds.has(id));
    const membership = next.sources?.find(s => s.key === source.key)?.membership ?? source.membership;
    const pendingIds = membership === 'follow' ? source.knownIds.filter(id => requestedIds.includes(id) && !acceptedIds.has(id)) : [];
    if (!ids.length && !pendingIds.length) continue;
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
      // Adding the folder again keeps an earlier on/off choice for new decks.
      ...(membership ? { membership } : {}),
      ...(pendingIds.length ? { pendingIds: [...new Set([...(source.pendingIds || []), ...pendingIds])] } : {}),
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

// Shared Save adds only new decks. Existing snapshots and source/individual membership
// stay intact, so removing this connection cannot remove a visitor's earlier decks.
export function saveSharedCollection(collection: Collection, source: CollectionSource, decks: Deck[], existing: Deck[]): Collection {
  const previous = collection.sources?.find(item => item.key === source.key);
  // Make inferred Individual decks explicit before a later source refresh can list
  // them. This preserves membership rather than assigning those decks to the source.
  const individualIds = showcaseGroups(collection, existing).find(group => group.key === 'manual')!.ids;
  const preserved = individualIds.some(id => !collection.manualIds?.includes(id))
    ? { ...collection, manualIds: [...new Set([...(collection.manualIds || []), ...individualIds])] }
    : collection;
  const finish = (result: Collection) => {
    try { parseCollection(JSON.stringify(result)); }
    catch { throw new Error('This shared collection exceeds the saved collection limits. Your collection is unchanged.'); }
    return result;
  };

  const known = new Set([
    ...existing.map(deck => deck.id), ...collection.added.map(deck => deck.id),
    ...(collection.demo?.decks || []).map(deck => deck.id),
    ...(collection.manualIds || []), ...collection.hidden, ...collection.excluded,
    ...(collection.sources || []).flatMap(item => [...item.knownIds, ...(item.ownedIds || [])]),
  ]);
  const listed = new Set(source.entries.map(entry => entry.id));
  const fresh = decks.filter(deck => listed.has(deck.id) && !known.has(deck.id));
  if (previous?.ownedIds !== undefined && !fresh.length) return finish(preserved);
  const ids = fresh.map(deck => deck.id);
  const accepted = new Set(ids);
  const entries = source.entries.filter(entry => accepted.has(entry.id));
  const savedSource: CollectionSource = previous ? {
    ...previous,
    // A Commander-only source that gains other formats now lists them all; nothing is dropped.
    ...(fresh.some(deck => formatOf(deck).id !== 'commander') ? { formatScope: 'all' as const } : {}),
    entries: [...previous.entries, ...entries],
    knownIds: [...previous.knownIds, ...ids],
    ...(previous.selectedIds !== undefined ? { selectedIds: [...previous.selectedIds, ...ids] } : {}),
    ownedIds: [...new Set([...effectiveSourceOwnership(previous), ...ids])],
  } : { ...source, membership: 'selected', entries, knownIds: ids, selectedIds: ids, ownedIds: ids };
  if (savedSource.entries.length > 1000 || savedSource.knownIds.length > 2000)
    throw new Error('This source has too much history. Save a smaller folder instead.');
  const sources = previous
    ? collection.sources!.map(item => item.key === source.key ? savedSource : item)
    : [...(collection.sources || []), savedSource];
  if (sources.length > 50) throw new Error('A collection can link up to 50 sources.');
  return finish({ ...saveSnapshots(preserved, fresh), sources });
}

export type SharedFolder = { source: CollectionSource; path: string; root: boolean };

// A shared account or folder tree saves like Add decks: one source per folder, grouped under
// the account so Library shows the tree. Each folder goes through the same add-only
// Save as a single source; folders with nothing new are skipped, as Add decks skips them.
export function saveSharedShelf(collection: Collection, source: CollectionSource, decks: Deck[], folders: SharedFolder[] | undefined): Collection {
  if (!folders?.length) return saveSharedCollection(collection, source, decks, collectionDecks(collection));
  let next = collection;
  for (const folder of folders) {
    const listed = new Set(folder.source.entries.map(entry => entry.id));
    const folderDecks = decks.filter(deck => listed.has(deck.id));
    if (!folderDecks.length) continue;
    const tagged = { ...folder.source, folderPath: folder.path, connectionKey: source.key, connectionName: source.name };
    const after = saveSharedCollection(next, tagged, folderDecks, collectionDecks(next));
    const isNew = !next.sources?.some(item => item.key === tagged.key);
    if (isNew && !after.sources?.find(item => item.key === tagged.key)?.entries.length) continue;
    next = after;
  }
  return next;
}

export type ShowcaseGroup = {
  key: string;
  name: string;
  kind: "demo" | "manual" | "account" | "folder";
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
/** The Archidekt page behind a Library heading, so every source and folder heading can link out.
 * A folder opens itself; a parent folder with no saved decks of its own opens the closest folder or
 * account above it. Sections that aren't Archidekt sources (Individual decks, All decks) have none. */
export function archidektPage(section: string, sources: CollectionSource[]): string | undefined {
  const own = sources.find(s => s.key === section);
  if (own) return own.url;
  if (!section.startsWith("scope:")) return undefined;
  // Overview boxes open a connection as scope:connection:<key>; the folder tree uses scope:<key>.
  for (let path = section.slice("scope:".length).replace(/^connection:/, ""); ; path = path.slice(0, path.lastIndexOf("/"))) {
    // Tree keys join the connection and each folder name with "/" (see sourceTree in CollectionNavigator).
    const folder = sources.find(s => s.key === path || s.connectionKey && [s.connectionKey, ...(s.folderPath?.split(" / ") || [])].join("/") === path);
    if (folder) return folder.url;
    const root = /^(account|folder):([^/]+)$/.exec(path);
    if (root) return root[1] === "folder" ? `https://archidekt.com/folders/${root[2]}` : `https://archidekt.com/u/${encodeURIComponent(root[2])}`;
    if (!path.includes("/")) return undefined;
  }
}

export function showcaseGroups(
  collection: Collection,
  decks: Deck[],
): ShowcaseGroup[] {
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
        (!demoIds.has(d.id) && !linked.has(d.id)),
    )
    .map((d) => d.id);
  return [
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
  decks: Deck[],
): Deck[] {
  const ids = new Set(
    showcaseGroups(collection, decks)
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

// Adding decks to a collection that is off (#94): switch it on, and show it again if hidden.
export function switchOn(collection: Collection, key: string): Collection {
  return isHidden(collection, key) ? hideGroups(collection, [key], false) : enableGroup(collection, key, true);
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
            ...(s.pendingIds ? { pendingIds: s.pendingIds.filter(id => !ids.includes(id)) } : {}),
            ...(s.excludedIds ? { excludedIds: s.excludedIds.filter(id => !ids.includes(id)) } : {}),
            selectedIds: [...new Set([...sourceDeckIds(s, decks), ...ids])],
            ownedIds: [...new Set([...(s.ownedIds || []), ...sourceDeckIds(s, decks), ...ids])],
          }
        : s,
    ),
  };
}
// Legacy sources implicitly own their known IDs until an explicit ownership list
// is recorded. Use the same meaning when saving and removing a connection.
function effectiveSourceOwnership(source: CollectionSource): string[] {
  return source.ownedIds ?? source.knownIds;
}

// Removing a source keeps snapshots and visibility choices still held by precons,
// another source listing or Individual decks, even when they are deselected.
// An explicit ownership list limits deletion: discovering an ID during refresh
// does not grant that source ownership of its saved snapshot or hidden choice.
export function removeSources(collection: Collection, keys: string[]): Collection {
  const sources = collection.sources || [];
  const gone = sources.filter(s => keys.includes(s.key));
  const kept = sources.filter(s => !keys.includes(s.key));
  const individualIds = showcaseGroups(collection, collectionDecks(collection)).find(group => group.key === 'manual')!.ids;
  const stillUsed = new Set([...individualIds, ...(collection.demo?.decks || []).map(deck => deck.id), ...(collection.manualIds || []), ...kept.flatMap(s => [...s.knownIds, ...(s.ownedIds || [])])]);
  const ids = new Set(gone.flatMap(effectiveSourceOwnership).filter(id => !stillUsed.has(id)));
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

export function collectionDecks(collection: Collection): Deck[] {
  return [...new Map([
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
  return addDemo({ version: 1, hidden: [], excluded: [], added: [] }, snapshot);
}

// A refresh only replaces metadata. Local visibility and picker choices survive.
// A folder listing already names each deck with its format, art, colours, tags and
// card count, so the deck can join the shelf straight away. The full deck (commanders,
// colour identity, set, description) replaces it through fillDeck: in the background
// in the Windows app, and on the website when someone opens the deck.
export function listingDeck(entry: SourceEntry): Deck {
  return {
    format: formatOf(entry),
    // The listing gives the featured card's art crop; Archidekt keeps the whole card beside it.
    cover: entry.image
      ? { kind: "featured", name: "", artist: "", image: entry.image.replace(/^(https:\/\/card-images\.archidekt\.com\/)art\//, "$1grid/"), art: entry.image }
      : { kind: "fallback", name: "No cover selected", artist: "", image: "", art: "" },
    id: entry.id,
    name: entry.name,
    set: "",
    colors: entry.colors,
    theme: "",
    tags: entry.tags || [],
    description: "",
    commanders: [],
    sourceUrl: `https://archidekt.com/decks/${entry.id}`,
    sourceName: "Archidekt",
    cardCount: entry.cardCount || 0,
    releasedAt: "",
    fetchedAt: "",
    partial: true,
    ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
  };
}
// The website's refresh reads listings only. A deck still on listing data takes the newer
// listing; a full deck that Archidekt shows as edited since goes back to listing data and
// loads again when opened. A full deck saved without an edit time takes the listing's, so
// later edits are noticed. Theme and original link stay, as with any refreshed snapshot.
export function refreshFromListing(collection: Collection, entries: SourceEntry[]): Collection {
  const listed = new Map(entries.map(entry => [entry.id, entry]));
  let changed = false;
  const added = collection.added.map(deck => {
    const entry = listed.get(deck.id);
    if (!entry) return deck;
    const edited = !!entry.updatedAt && (!deck.updatedAt || Date.parse(entry.updatedAt) > Date.parse(deck.updatedAt));
    if (deck.partial || (edited && deck.updatedAt)) {
      const fresh = mergeSnapshot(deck, listingDeck(entry));
      if (JSON.stringify(fresh) === JSON.stringify(deck)) return deck;
      changed = true;
      return fresh;
    }
    if (!edited) return deck;
    changed = true;
    return { ...deck, updatedAt: entry.updatedAt };
  });
  return changed ? { ...collection, added } : collection;
}
// Only a deck still waiting for its details changes, so a refresh or removal
// that happened while it loaded wins.
export function fillDeck(collection: Collection, deck: Deck): Collection {
  return collection.added.some((d) => d.id === deck.id && d.partial)
    ? saveSnapshots(collection, [deck])
    : collection;
}
export function dropPartialDecks(collection: Collection, ids: string[]): Collection {
  const drop = new Set(collection.added.filter((d) => d.partial && ids.includes(d.id)).map((d) => d.id));
  return drop.size ? { ...collection, added: collection.added.filter((d) => !drop.has(d.id)) } : collection;
}

/** A fresh snapshot keeps the theme and original link the saved copy already had. */
export function mergeSnapshot(saved: Deck | undefined, fresh: Deck): Deck {
  // A full deck keeps the listing edit time it was loaded against.
  const updatedAt = fresh.updatedAt || saved?.updatedAt;
  return {
    ...fresh,
    ...(updatedAt ? { updatedAt } : {}),
    theme: saved?.theme || fresh.theme,
    ...(saved?.originalUrl ? { originalUrl: saved.originalUrl } : {}),
  };
}
export function saveSnapshots(
  collection: Collection,
  decks: Deck[],
  show = false,
): Collection {
  const ids = new Set(decks.map((d) => d.id));
  const previous = new Map(collection.added.map((d) => [d.id, d]));
  // A Map keeps the first insertion's position, so a refreshed deck keeps its place.
  for (const d of decks) previous.set(d.id, mergeSnapshot(previous.get(d.id), d));
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
    return { ...source,
      ...(source.pendingIds ? { pendingIds: source.pendingIds.filter(id => !wanted.has(id)) } : {}),
      excludedIds: selected ? (source.excludedIds || []).filter(id => !wanted.has(id)) : [...new Set([...(source.excludedIds || []), ...ids.filter(id => available.has(id))])],
      ownedIds: [...new Set([...(source.ownedIds || []), ...current, ...(selected ? ids.filter(id => available.has(id)) : [])])], selectedIds: selected
      ? [...new Set([...current, ...ids.filter(id => available.has(id))])]
      : current.filter(id => !wanted.has(id)) };
  }) };
  return selected ? setShown(next, ids, true) : next;
}

// Unsaved Follow rows can be excluded without claiming source ownership or a snapshot.
export function setPendingSourceSelection(collection: Collection, keys: string[], ids: string[], selected: boolean): Collection {
  return { ...collection, sources: collection.sources?.map(source => {
    if (!keys.includes(source.key) || sourceMembership(source) !== 'follow') return source;
    const wanted = ids.filter(id => source.pendingIds?.includes(id) || source.excludedIds?.includes(id));
    if (!wanted.length) return source;
    return { ...source,
      pendingIds: selected ? [...new Set([...(source.pendingIds || []), ...wanted])] : (source.pendingIds || []).filter(id => !wanted.includes(id)),
      excludedIds: selected ? (source.excludedIds || []).filter(id => !wanted.includes(id)) : [...new Set([...(source.excludedIds || []), ...wanted])],
    };
  }) };
}

export const SOURCE_TTL = 24 * 60 * 60 * 1000;
// Sources saved before Follow existed follow when every deck in them was picked;
// hand-picked folders stay fixed. An explicit choice always wins.
export function sourceMembership(source: CollectionSource): "follow" | "selected" {
  if (source.membership) return source.membership;
  const picked = source.selectedIds ?? source.knownIds;
  return source.knownIds.every(id => picked.includes(id)) ? 'follow' : 'selected';
}
// Save inferred Individual membership before new source ownership can mask it.
function materializeIndependentDecks(collection: Collection): Collection {
  const ids = showcaseGroups(collection, collectionDecks(collection)).find(group => group.key === 'manual')!.ids;
  const manualIds = [...new Set([...(collection.manualIds || []), ...ids])];
  return ids.every(id => collection.manualIds?.includes(id)) ? collection : { ...collection, manualIds };
}
export function sourceDue(source: CollectionSource, now = Date.now()): boolean {
  return now >= Date.parse(source.refresh?.retryAt || "1970-01-01") && now - Date.parse(source.checkedAt) >= SOURCE_TTL;
}
export function sourceRefreshFailure(collection: Collection, key: string, error: string, now = Date.now()): Collection {
  return { ...collection, sources: collection.sources?.map(source => {
    if (source.key !== key) return source;
    const failures = Math.min(20, (source.refresh?.failures || 0) + 1);
    return { ...source, refresh: { failures, error: error.slice(0, 2000),
      retryAt: new Date(now + Math.min(SOURCE_TTL, 60000 * 2 ** (failures - 1))).toISOString() } };
  }) };
}
// Apply only complete discovery. Existing snapshots and local choices survive.
export function refreshSourceMembership(collection: Collection, found: CollectionSource, loaded: Deck[]): Collection {
  const previous = collection.sources?.find(source => source.key === found.key);
  if (!previous) return collection;
  collection = materializeIndependentDecks(collection);
  const membership = sourceMembership(previous);
  const fresh = found.entries.filter(entry => !previous.knownIds.includes(entry.id));
  const available = new Set([...collection.added, ...loaded].map(deck => deck.id));
  const pending = previous.pendingIds || [];
  const excluded = new Set(previous.excludedIds || []);
  const additions = membership === 'follow' ? [...new Set([...fresh.map(entry => entry.id), ...pending])]
    .filter(id => available.has(id) && found.entries.some(entry => entry.id === id) &&
      (!previous.knownIds.includes(id) || !(previous.ownedIds || []).includes(id)) && !excluded.has(id)) : [];
  const before = new Map(previous.entries.map(entry => [entry.id, entry]));
  const listed = new Set(found.entries.map(entry => entry.id));
  const updated: CollectionSource = { ...previous, name: found.name, entries: found.entries, checkedAt: found.checkedAt,
    knownIds: [...new Set([...previous.knownIds, ...found.knownIds])], membership,
    selectedIds: [...new Set([...(previous.selectedIds ?? previous.knownIds), ...additions])],
    ownedIds: [...new Set([...(previous.ownedIds ?? previous.selectedIds ?? previous.knownIds), ...additions])],
    pendingIds: [...new Set([...fresh.map(entry => entry.id), ...pending])].filter(id => !excluded.has(id) && !additions.includes(id) && !(previous.ownedIds ?? previous.selectedIds ?? previous.knownIds).includes(id)),
    refresh: { failures: 0 },
    lastChange: { at: found.checkedAt, added: fresh.map(entry => entry.id),
      unlisted: previous.knownIds.filter(id => !listed.has(id)),
      renamed: found.entries.filter(entry => before.has(entry.id) && before.get(entry.id)!.name !== entry.name).map(entry => entry.id) } };
  if (updated.knownIds.length > 2000) throw new Error('Source history is full. Saved decks are unchanged.');
  return { ...saveSnapshots(collection, loaded.filter(deck => !collection.added.some(saved => saved.id === deck.id))),
    sources: collection.sources!.map(source => source.key === found.key ? updated : source) };
}
