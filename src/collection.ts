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
    knownIds: [...new Set([...(previous?.knownIds || []), ...source.knownIds])],
  };
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
