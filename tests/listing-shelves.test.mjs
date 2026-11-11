import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCollection, validateDeck, validateSource } from "../src/domain.ts";
import { listingDeck, mergeSnapshot, refreshFromListing } from "../src/collection.ts";
import { sourceRefresher } from "../src/sourceRefresh.ts";
import { fetchAllDecks } from "../src/fetchMode.ts";
import { discoverSource } from "../server/sources.mjs";
import { archidektFormat } from "../shared/formats.mjs";

// The website draws shelves from Archidekt's folder listings and reads a deck in full only when
// it is opened; the Windows app still reads every deck (src/fetchMode.ts, issue #169).

const commander = archidektFormat(3);
const art = "https://card-images.archidekt.com/art/front/9/0/909e62fa-4585-495e-812b-5df56af24610.webp";
const entry = (id, extra = {}) => ({ format: commander, id, name: `Deck ${id}`, image: art, colors: ["B"], ...extra });
const full = (id, extra = {}) => ({
  ...listingDeck(entry(id)), partial: undefined, cover: undefined, set: "Test", cardCount: 100, fetchedAt: "2026-10-18T00:00:00.000Z",
  commanders: [{ name: "Ghoulcaller Gisa", image: "https://example.com/g.webp", art: "https://example.com/a.webp", artist: "A" }], ...extra,
});
const folderSource = (value, entries, extra = {}) => ({
  key: `folder:${value}`, kind: "folder", value, name: `Folder ${value}`, url: `https://archidekt.com/folders/${value}`,
  checkedAt: "2026-11-11T00:00:00.000Z", entries, knownIds: entries.map(e => e.id), ...extra,
});

test("the website is the default; only the Windows app's preload asks for every deck", async () => {
  assert.equal(fetchAllDecks, false);
  globalThis.deckshelfDesktop = { fetchAllDecks: true };
  try { assert.equal((await import("../src/fetchMode.ts?desktop")).fetchAllDecks, true); }
  finally { delete globalThis.deckshelfDesktop; }
});

test("a listing deck carries the listing's tags, card count and edit time", () => {
  const deck = listingDeck(entry("1001", { tags: ["Tokens", "Lifegain"], cardCount: 100, updatedAt: "2026-11-01T10:00:00.123456Z" }));
  assert.equal(deck.partial, true);
  assert.deepEqual(deck.tags, ["Tokens", "Lifegain"]);
  assert.equal(deck.cardCount, 100);
  assert.equal(deck.updatedAt, "2026-11-01T10:00:00.123456Z");
  // The whole featured card for card views, its art crop for art views.
  assert.equal(deck.cover.art, art);
  assert.equal(deck.cover.image, art.replace("/art/", "/grid/"));
  assert.equal(listingDeck(entry("1003", { image: "https://example.com/custom.jpg" })).cover.image, "https://example.com/custom.jpg");
  assert.equal(validateDeck(deck), true);
  assert.equal(validateDeck({ ...deck, updatedAt: "yesterday" }), false);
  // Older saved entries without the new fields still make valid decks.
  assert.deepEqual(listingDeck(entry("1002")).tags, []);
  assert.equal("updatedAt" in listingDeck(entry("1002")), false);
});

test("saved sources accept listing tags, card counts and edit times, and reject damaged ones", () => {
  const good = folderSource("5", [entry("1001", { tags: ["Tokens"], cardCount: 99, updatedAt: "2026-11-01T10:00:00Z" })]);
  assert.equal(validateSource(good), true);
  for (const bad of [{ tags: "Tokens" }, { tags: [1] }, { cardCount: -1 }, { cardCount: 1.5 }, { updatedAt: "soon" }])
    assert.equal(validateSource(folderSource("5", [entry("1001", bad)])), false, JSON.stringify(bad));
});

test("a full deck keeps the listing edit time it was loaded against", () => {
  const listed = listingDeck(entry("1001", { updatedAt: "2026-11-01T00:00:00Z" }));
  const loaded = mergeSnapshot({ ...listed, theme: "Mine" }, full("1001"));
  assert.equal(loaded.partial, undefined);
  assert.equal(loaded.updatedAt, "2026-11-01T00:00:00Z");
  assert.equal(loaded.theme, "Mine");
});

test("a listing refresh updates listing decks and sends only edited full decks back to listing data", () => {
  const collection = parseCollection(JSON.stringify({ version: 1, hidden: [], excluded: [], added: [
    listingDeck(entry("1001")),
    { ...full("1002", { updatedAt: "2026-10-01T00:00:00Z" }), theme: "Kept theme" },
    full("1003", { updatedAt: "2026-10-01T00:00:00Z" }),
    full("1004"),
    full("1005", { updatedAt: "2026-10-01T00:00:00Z" }),
  ] }));
  const next = refreshFromListing(collection, [
    entry("1001", { name: "Renamed", tags: ["Tokens"] }),
    entry("1002", { updatedAt: "2026-11-01T00:00:00Z" }),
    entry("1003", { updatedAt: "2026-10-01T00:00:00.000000Z" }),
    entry("1004", { updatedAt: "2026-11-01T00:00:00Z" }),
  ]);
  const byId = Object.fromEntries(next.added.map(deck => [deck.id, deck]));
  assert.equal(byId["1001"].name, "Renamed");
  assert.deepEqual(byId["1001"].tags, ["Tokens"]);
  // Edited on Archidekt since it was loaded: back to listing data, theme kept.
  assert.equal(byId["1002"].partial, true);
  assert.equal(byId["1002"].theme, "Kept theme");
  assert.equal(byId["1002"].updatedAt, "2026-11-01T00:00:00Z");
  // The same edit time in another spelling is not an edit.
  assert.equal(byId["1003"], collection.added[2]);
  // A full deck saved without an edit time keeps its details and learns the listing's.
  assert.equal(byId["1004"].partial, undefined);
  assert.equal(byId["1004"].updatedAt, "2026-11-01T00:00:00Z");
  // Not in this listing: untouched.
  assert.equal(byId["1005"], collection.added[4]);
  assert.equal(parseCollection(JSON.stringify(next)).added.length, 5);
  assert.equal(refreshFromListing(next, [entry("1003", { updatedAt: "2026-10-01T00:00:00Z" })]), next);
});

function refresherFor(collection, read, fetchAll) {
  let current = collection;
  const calls = [];
  const refresher = sourceRefresher({
    collection: () => current, update: change => { current = change(current); }, checking: () => {},
    allowed: () => true, visible: () => true, pause: async () => {}, fetchAll,
    read: async (path) => { calls.push(path); return read(path); },
  });
  return { refresher, calls, get collection() { return current; } };
}

const accountCollection = () => parseCollection(JSON.stringify({ version: 1, hidden: [], excluded: [],
  added: [{ ...full("1001", { updatedAt: "2026-10-01T00:00:00Z" }), theme: "Mine" }],
  sources: [{ key: "account:tester", kind: "account", value: "tester", name: "tester", url: "https://archidekt.com/u/tester",
    checkedAt: "2026-01-01T00:00:00.000Z", entries: [entry("1001")], knownIds: ["1001"], membership: "follow" }] }));

test("on the website a followed account is checked through its folder listings, with no deck reads", async () => {
  const tree = { name: "tester", folders: [
    { source: folderSource("5", [entry("1001", { updatedAt: "2026-11-01T00:00:00Z" })]), path: "Home", root: true },
    { source: folderSource("6", [entry("1002", { tags: ["Tokens"], cardCount: 100, updatedAt: "2026-11-02T00:00:00Z" })]), path: "Home / Tokens", root: false },
  ] };
  const run = refresherFor(accountCollection(), path => {
    if (path.startsWith("/api/source-folders?")) return tree;
    throw new Error(`Unexpected request ${path}`);
  }, false);
  assert.equal(await run.refresher.refresh("account:tester", true), true);
  assert.equal(run.calls.length, 1);
  assert.match(run.calls[0], /^\/api\/source-folders\?kind=account&value=tester&refresh=1&formats=commander$/);
  const added = Object.fromEntries(run.collection.added.map(deck => [deck.id, deck]));
  assert.equal(added["1002"].partial, true);
  assert.deepEqual(added["1002"].tags, ["Tokens"]);
  assert.equal(added["1001"].partial, true, "edited since it was loaded");
  assert.equal(added["1001"].theme, "Mine");
  const source = run.collection.sources[0];
  assert.deepEqual(source.knownIds, ["1001", "1002"]);
  assert.equal(source.refresh.failures, 0);
});

test("on the website every new deck joins from the listing at once, past the old ten-per-check cap", async () => {
  const entries = Array.from({ length: 15 }, (_, i) => entry(String(2000 + i)));
  const collection = parseCollection(JSON.stringify({ version: 1, hidden: [], excluded: [], added: [],
    sources: [{ ...folderSource("5", []), membership: "follow" }] }));
  const run = refresherFor(collection, path => {
    assert.match(path, /^\/api\/sources\?.*cached=1/);
    return folderSource("5", entries);
  }, false);
  assert.equal(await run.refresher.refresh("folder:5"), true);
  assert.equal(run.calls.length, 1);
  assert.equal(run.collection.added.length, 15);
  assert.ok(run.collection.added.every(deck => deck.partial));
});

test("the Windows app keeps reading the source search and new decks in full", async () => {
  const run = refresherFor(accountCollection(), path => {
    if (path.startsWith("/api/sources?")) return { ...accountCollection().sources[0], entries: [entry("1001"), entry("1002")], knownIds: ["1001", "1002"], membership: undefined };
    if (path === "/api/decks/1002") return full("1002");
    throw new Error(`Unexpected request ${path}`);
  }, true);
  assert.equal(await run.refresher.refresh("account:tester"), true);
  assert.deepEqual(run.calls.map(path => path.split("?")[0]), ["/api/sources", "/api/decks/1002"]);
  assert.match(run.calls[0], /cached=1/);
  const added = Object.fromEntries(run.collection.added.map(deck => [deck.id, deck]));
  assert.equal(added["1002"].partial, undefined);
  assert.equal(added["1001"].partial, undefined, "the desktop check leaves saved decks alone");
});

test("folder listings pass on each deck's tags, card count and edit time", async () => {
  const row = (id, extra) => ({ id, name: `Deck ${id}`, deckFormat: 3, private: false, parentFolderId: 5, featured: art,
    colors: { W: 0, U: 0, B: 52, R: 0, G: 0 }, ...extra });
  const page = { id: 5, name: "Folder", private: false, count: 3, next: null, decks: [
    row(1, { size: 100, updatedAt: "2026-10-04T18:34:09.490534Z", tags: ["Tokens", { name: "Lifegain" }, { tag: { name: "Tribal" } }, "Tokens"] }),
    row(2, { size: "100", updatedAt: "not a date", tags: null }),
    row(3, {}),
  ] };
  const found = await discoverSource("folder", "5", { request: async () => ({ ok: true, json: async () => page }) });
  assert.deepEqual(found.entries[0].tags, ["Tokens", "Lifegain", "Tribal"]);
  assert.equal(found.entries[0].cardCount, 100);
  assert.equal(found.entries[0].updatedAt, "2026-10-04T18:34:09.490534Z");
  for (const plain of found.entries.slice(1))
    assert.deepEqual(Object.keys(plain).sort(), ["colors", "format", "id", "image", "name"]);
  assert.equal(validateSource(found), true);
});
