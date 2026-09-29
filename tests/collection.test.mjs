import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCollection, validateSource } from "../src/domain.ts";
import {
  parseSourceInput,
  rememberSource,
  saveSnapshots,
  setShown,
  setDeckSelection,
  showcaseGroups,
  showcaseDecks,
  enableGroup,
  onlyGroup,
  selectSourceDecks,
  disconnectSource,
} from "../src/collection.ts";
import { discoverSource } from "../server/sources.mjs";

const deck = JSON.parse(
  readFileSync(new URL("../src/data/decks.json", import.meta.url)),
)[0];
const collection = {
  version: 1,
  hidden: [deck.id],
  excluded: [deck.id],
  added: [deck],
};
const entry = {
  id: deck.id,
  name: deck.name,
  image: deck.commanders[0].art,
  colors: deck.colors,
};
const source = {
  key: "folder:42",
  kind: "folder",
  value: "42",
  name: "Owned decks",
  url: "https://archidekt.com/folders/42",
  checkedAt: "2026-09-29T12:00:00Z",
  entries: [entry],
  knownIds: [deck.id],
};

test("source links detect their kind, normalize duplicates and reject unrelated or unsafe URLs", () => {
  assert.deepEqual(
    parseSourceInput("https://archidekt.com/u/Example", "folder"),
    { kind: "account", value: "Example", key: "account:example" },
  );
  assert.equal(
    parseSourceInput("https://archidekt.com/folders/42/?x=1", "account").key,
    "folder:42",
  );
  assert.equal(
    parseSourceInput("https://archidekt.com/decks/123/a-title", "account").kind,
    "deck",
  );
  assert.equal(
    parseSourceInput(" SomeUser ", "account").key,
    "account:someuser",
  );
  for (const url of [
    "https://evil.com/decks/42",
    "http://archidekt.com/decks/42",
    "https://archidekt.com@evil.com/u/Name",
    "https://a:b@archidekt.com/u/Name",
    "javascript:foo",
  ])
    assert.throws(() => parseSourceInput(url, "account"));
});

test("collection switches keep selections and picker exclusions and apply to every view pool", () => {
  const c = { ...collection, hidden: [], sources: [source] };
  const paused = enableGroup(
    enableGroup(c, "starter", false),
    source.key,
    false,
  );
  assert.deepEqual(showcaseDecks(paused, [deck], [deck]), []);
  assert.deepEqual(paused.hidden, c.hidden);
  assert.deepEqual(paused.excluded, c.excluded);
  assert.deepEqual(
    showcaseDecks(enableGroup(paused, source.key, true), [deck], [deck]),
    [deck],
  );
  assert.deepEqual(
    showcaseDecks({ ...paused, disabledGroups: [] }, [deck], [deck]),
    [deck],
  );
});
test("overlapping collections form a unique union and Only this uses one group", () => {
  const personal = { ...deck, id: "777" };
  const second = {
    ...source,
    key: "folder:43",
    value: "43",
    url: "https://archidekt.com/folders/43",
    knownIds: [deck.id, "777"],
    entries: [entry, { ...entry, id: "777" }],
  };
  const c = {
    ...collection,
    hidden: [],
    added: [personal],
    sources: [source, second],
  };
  const all = [deck, personal];
  assert.deepEqual(
    showcaseDecks(enableGroup(c, source.key, false), [deck], all),
    all,
  );
  const only = onlyGroup(c, source.key, showcaseGroups(c, [deck], all));
  assert.deepEqual(showcaseDecks(only, [deck], all), [deck]);
  assert.deepEqual(
    showcaseDecks({ ...only, hidden: [deck.id] }, [deck], all),
    [],
  );
});
test("opening the precon catalog does not implicitly select existing bundled precons", () => {
  const c = {
    ...collection,
    hidden: [],
    sources: [{ ...source, selectedIds: [] }],
    disabledGroups: ["starter"],
  };
  assert.deepEqual(showcaseDecks(c, [deck], [deck]), []);
  const chosen = selectSourceDecks(c, source.key, [deck.id], [deck]);
  assert.deepEqual(showcaseDecks(chosen, [deck], [deck]), [deck]);
  const refreshed = rememberSource(chosen, {
    ...source,
    entries: [entry, { ...entry, id: "999" }],
    knownIds: [deck.id, "999"],
  });
  assert.deepEqual(refreshed.sources[0].selectedIds, [deck.id]);
  assert.deepEqual(refreshed.disabledGroups, ["starter"]);
  assert.deepEqual(parseCollection(JSON.stringify(refreshed)), refreshed);
});
test("individual links can include a deck also present in a disabled source or included group", () => {
  const c = {
    ...collection,
    hidden: [],
    sources: [source],
    manualIds: [deck.id],
    disabledGroups: ["starter", source.key],
  };
  assert.deepEqual(showcaseDecks(c, [deck], [deck]), [deck]);
  assert.deepEqual(
    showcaseDecks(enableGroup(c, "manual", false), [deck], [deck]),
    [],
  );
  assert.deepEqual(parseCollection(JSON.stringify(c)), c);
});
test("disconnecting a paused source keeps its snapshot without unexpectedly showing it", () => {
  const personal = { ...deck, id: "777" };
  const s = {
    ...source,
    knownIds: ["777"],
    entries: [{ ...entry, id: "777" }],
    selectedIds: ["777"],
  };
  const c = {
    version: 1,
    hidden: [],
    excluded: ["777"],
    added: [personal],
    sources: [s],
    disabledGroups: [s.key],
  };
  const next = disconnectSource(c, s.key, [], [personal]);
  assert.deepEqual(next.added, [personal]);
  assert.deepEqual(next.hidden, ["777"]);
  assert.deepEqual(next.excluded, ["777"]);
  assert.deepEqual(next.disabledGroups, []);
  assert.deepEqual(
    showcaseGroups(next, [], [personal]).find((g) => g.key === "manual").ids,
    ["777"],
  );
});
test("legacy source selections survive refresh and invalid group settings are rejected", () => {
  const c = rememberSource(rememberSource(collection, source), source);
  assert.deepEqual(parseCollection(JSON.stringify(c)), c);
  for (const change of [
    { disabledGroups: ["unknown"] },
    { disabledGroups: [false] },
    { manualIds: ["not-id"] },
    { sources: [{ ...source, selectedIds: ["999"] }] },
  ])
    assert.throws(() => parseCollection(JSON.stringify({ ...c, ...change })));
});
test("source backup round trips and legacy backups preserve all existing choices", () => {
  assert.deepEqual(parseCollection(JSON.stringify(collection)), collection);
  const linked = rememberSource(collection, source);
  assert.deepEqual(parseCollection(JSON.stringify(linked)), linked);
  assert.equal(validateSource(source), true);
  for (const change of [
    { key: "wrong" },
    { url: "https://evil.com" },
    { entries: [entry, entry] },
    { knownIds: [] },
    { checkedAt: "not a date" },
    { entries: [{ ...entry, image: "javascript:bad" }] },
  ])
    assert.throws(() =>
      parseCollection(
        JSON.stringify({ ...linked, sources: [{ ...source, ...change }] }),
      ),
    );
});
test("refresh retains history, hidden choices and picker exclusions, and deduplicates snapshots", () => {
  let c = rememberSource(collection, source);
  c = rememberSource(c, { ...source, entries: [], knownIds: [] });
  assert.deepEqual(c.sources[0].knownIds, [deck.id]);
  assert.equal(c.sources.length, 1);
  c = saveSnapshots(c, [{ ...deck, name: "Updated name" }]);
  assert.equal(c.added.length, 1);
  assert.equal(c.added[0].name, "Updated name");
  assert.deepEqual(c.hidden, [deck.id]);
  assert.deepEqual(c.excluded, [deck.id]);
  c = saveSnapshots(c, [deck], true);
  assert.deepEqual(c.hidden, []);
  assert.deepEqual(c.excluded, [deck.id]);
  assert.deepEqual({ ...c, sources: [] }.added, [deck]);
});
test("bulk display edits only the requested decks and never resets picker inclusion", () => {
  const c = setShown(
    { ...collection, hidden: ["999", deck.id] },
    [deck.id],
    true,
  );
  assert.deepEqual(c.hidden, ["999"]);
  assert.deepEqual(c.excluded, [deck.id]);
  assert.deepEqual(setShown(c, [deck.id, deck.id], false).hidden, [
    "999",
    deck.id,
  ]);
});

test("refresh keeps the collection order and failed imports cannot clear snapshots", () => {
  const second = { ...deck, id: "999", name: "Second" };
  const c = { ...collection, added: [deck, second] };
  assert.deepEqual(
    saveSnapshots(c, [{ ...deck, name: "Updated" }]).added.map((d) => d.id),
    [deck.id, "999"],
  );
  assert.deepEqual(saveSnapshots(c, []), c);
});
const row = (id, extra = {}) => ({
  id,
  name: `Deck ${id}`,
  deckFormat: 3,
  private: false,
  owner: { username: "Example" },
  parentFolderId: 42,
  featured: "https://card-images.archidekt.com/test.webp",
  colors: { U: 10 },
  ...extra,
});
test("account discovery reads every page, filters formats, and never follows upstream next URLs", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () =>
        calls.length === 1
          ? {
              count: 3,
              next: "https://evil.com/secret",
              results: [row(1), row(2, { deckFormat: 2 })],
            }
          : { count: 3, next: null, results: [row(3)] },
    };
  });
  const result = await discoverSource("account", "Example");
  assert.deepEqual(
    result.entries.map((d) => d.id),
    ["1", "3"],
  );
  assert.ok(
    calls.every((url) => url.startsWith("https://archidekt.com/api/decks/v3/")),
  );
  assert.ok(calls[1].includes("page=2"));
  assert.ok(validateSource(result));
});
test("folder discovery only reads direct public Commander decks, with no recursive surprise", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => ({
        id: 42,
        name: "Game night",
        count: 3,
        next: null,
        subfolders: [{ id: 43 }],
        decks: [row(1), row(2, { private: true }), row(3, { deckFormat: 2 })],
      }),
    };
  });
  const result = await discoverSource("folder", "42");
  assert.deepEqual(result.knownIds, ["1"]);
  assert.equal(result.name, "Game night");
  assert.equal(calls.length, 1);
  assert.ok(validateSource(result));
});
test("incomplete, repeated, private or misrouted discovery fails instead of replacing saved state", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404 }));
  await assert.rejects(discoverSource("folder", "42"), /not public/);
  globalThis.fetch.mock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({
      results: [row(1, { owner: { username: "SomeoneElse" } })],
      next: null,
    }),
  }));
  await assert.rejects(
    discoverSource("account", "Example"),
    /different account/,
  );
  globalThis.fetch.mock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ results: [row(1)], next: "anything" }),
  }));
  await assert.rejects(discoverSource("account", "Example"), /repeated/);
  globalThis.fetch.mock.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ id: 42, private: true, decks: [] }),
  }));
  await assert.rejects(discoverSource("folder", "42"), /unexpected/);
  await assert.rejects(
    discoverSource("folder", "../../secret"),
    /username or folder/,
  );
});

test("bulk selection handles saved and new decks while preserving choices outside the results", () => {
  const original = {
    ...collection,
    hidden: [deck.id, "outside"],
    disabledGroups: ["starter"],
  };
  const rows = [
    { id: deck.id, saved: true },
    { id: "new", saved: false },
  ];
  const selected = setDeckSelection(
    original,
    ["pending-outside", "new"],
    rows,
    true,
  );
  assert.deepEqual(selected.collection.hidden, ["outside"]);
  assert.deepEqual(selected.pending, ["pending-outside", "new"]);
  assert.deepEqual(selected.collection.added, original.added);
  assert.deepEqual(selected.collection.excluded, original.excluded);
  assert.deepEqual(selected.collection.disabledGroups, original.disabledGroups);
  const cleared = setDeckSelection(
    selected.collection,
    selected.pending,
    rows,
    false,
  );
  assert.deepEqual(cleared.collection.hidden, ["outside", deck.id]);
  assert.deepEqual(cleared.pending, ["pending-outside"]);
  assert.deepEqual(setDeckSelection(original, ["new"], [], false), {
    collection: original,
    pending: ["new"],
  });
});
