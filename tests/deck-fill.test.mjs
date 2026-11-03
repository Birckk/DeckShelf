import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCollection, validateDeck } from "../src/domain.ts";
import { dropPartialDecks, fillDeck, importFolderSelection, listingDeck, saveSnapshots } from "../src/collection.ts";
import { archidektFormat } from "../shared/formats.mjs";
import { DeckLoadError, FILL_CONCURRENCY, fillDecks, loadFullDeck } from "../src/deckFill.ts";

const commander = archidektFormat(3);
const entry = (id, extra = {}) => ({ format: commander, id, name: `Deck ${id}`, image: "https://card-images.archidekt.com/art/front/9/0/909e62fa-4585-495e-812b-5df56af24610.webp", colors: ["B"], ...extra });
const full = (id, extra = {}) => ({
  ...listingDeck(entry(id)), partial: undefined, cover: undefined, set: "Test", cardCount: 100, fetchedAt: "2026-10-18T00:00:00.000Z",
  commanders: [{ name: "Ghoulcaller Gisa", image: "https://example.com/g.webp", art: "https://example.com/a.webp", artist: "A" }], ...extra,
});
const ids = n => Array.from({ length: n }, (_, i) => String(1000 + i));

test("a listed deck joins the shelf as a valid deck still loading its details", () => {
  const deck = listingDeck(entry("1001"));
  assert.equal(deck.partial, true);
  assert.equal(validateDeck(deck), true);
  assert.deepEqual(deck.commanders, []);
  assert.equal(deck.cover.art, entry("1001").image);
  assert.equal(validateDeck(listingDeck(entry("1002", { image: "" }))), true);
  // Only a deck still loading may be a Commander deck without commanders.
  assert.equal(validateDeck({ ...deck, partial: undefined }), false);
  assert.equal(validateDeck({ ...deck, partial: false }), false);
  const saved = parseCollection(JSON.stringify({ version: 1, hidden: [], excluded: [], added: [deck] }));
  assert.equal(saved.added[0].partial, true);
});

test("folder import adds listed decks at once and filling replaces only decks still loading", () => {
  const source = { key: "folder:1", kind: "folder", value: "1", name: "Folder", url: "https://archidekt.com/folders/1", checkedAt: "2026-10-18T00:00:00.000Z", entries: [entry("1001"), entry("1002")], knownIds: ["1001", "1002"] };
  let c = importFolderSelection({ version: 1, hidden: [], excluded: [], added: [] }, [source], [listingDeck(entry("1001")), listingDeck(entry("1002"))], []);
  assert.deepEqual(c.added.map(d => [d.id, d.partial]), [["1001", true], ["1002", true]]);
  c = { ...c, added: c.added.map(d => d.id === "1001" ? { ...d, theme: "Zombies" } : d) };
  c = fillDeck(c, full("1001"));
  assert.equal(c.added[0].partial, undefined);
  assert.equal(c.added[0].commanders[0].name, "Ghoulcaller Gisa");
  assert.equal(c.added[0].theme, "Zombies");
  // A refresh that landed first, or a removal, wins over a late fill.
  const refreshed = saveSnapshots(c, [full("1002", { name: "Refreshed" })]);
  assert.equal(fillDeck(refreshed, full("1002", { name: "Late" })), refreshed);
  const removed = { ...c, added: c.added.filter(d => d.id !== "1002") };
  assert.equal(fillDeck(removed, full("1002")), removed);
  // Dropping a deck that can never load leaves complete decks alone.
  assert.deepEqual(dropPartialDecks(c, ["1001", "1002"]).added.map(d => d.id), ["1001"]);
  assert.equal(dropPartialDecks(refreshed, ["1002"]), refreshed);
});

test("filling runs as a sliding pool: the next deck starts when any one finishes", async () => {
  const list = ids(7);
  let active = 0, peak = 0;
  /** @type {string[]} */
  const filled = [];
  const started = [];
  // The slow deck holds its slot until 1002 lands, so lockstep pairs could never finish.
  let releaseSlow;
  const slow = new Promise(r => { releaseSlow = r; });
  await fillDecks(list, async id => {
    started.push(id); active++; peak = Math.max(peak, active);
    await (id === "1000" ? slow : new Promise(r => setTimeout(r, 1)));
    active--;
    return full(id);
  }, { signal: new AbortController().signal, onDeck: d => { filled.push(d.id); if (d.id === "1002") releaseSlow(); }, onError: assert.fail });
  assert.equal(FILL_CONCURRENCY, 2);
  assert.equal(peak, FILL_CONCURRENCY);
  assert.deepEqual([...filled].sort(), list);
  // In lockstep pairs 1002 would wait for slow 1000; here it starts after 1001 alone.
  assert.ok(filled.indexOf("1002") < filled.indexOf("1000"));
});

test("filling reports each failure without stopping the rest and stops on abort", async () => {
  /** @type {string[]} */
  const filled = [];
  const errors = [];
  await fillDecks(ids(5), async id => {
    if (id === "1001") throw new DeckLoadError("That deck has no assigned commander.", false);
    return full(id);
  }, { signal: new AbortController().signal, onDeck: d => filled.push(d.id), onError: (id, e) => errors.push([id, e.retry]) });
  assert.deepEqual(errors, [["1001", false]]);
  assert.deepEqual(filled.sort(), ["1000", "1002", "1003", "1004"]);

  const controller = new AbortController();
  const started = [];
  const reported = [];
  await fillDecks(ids(6), async (id, signal) => {
    started.push(id);
    if (id === "1001") controller.abort();
    await new Promise(r => setTimeout(r, 5));
    signal.throwIfAborted();
    return full(id);
  }, { signal: controller.signal, onDeck: d => reported.push(d.id), onError: id => reported.push(id) });
  assert.deepEqual(started, ["1000", "1001"]);
  assert.deepEqual(reported, []);
});

test("loading a full deck tells a lasting failure from a passing one", async () => {
  const signal = new AbortController().signal;
  const reply = (status, body, type = "application/json") => async () => ({ ok: status === 200, status, headers: new Headers({ "content-type": type }), json: async () => body });
  assert.equal((await loadFullDeck("1000", signal, reply(200, full("1000")))).id, "1000");
  const failure = async request => { try { await loadFullDeck("1000", signal, request); } catch (e) { return e; } };
  assert.equal((await failure(reply(502, { error: "Use a public deck from Archidekt.", retry: false }))).retry, false);
  assert.equal((await failure(reply(502, { error: "Archidekt is unavailable right now.", retry: true }))).retry, true);
  // Older servers and missing servers say nothing: keep the deck and try later.
  assert.equal((await failure(reply(502, { error: "Archidekt is unavailable right now." }))).retry, true);
  assert.equal((await failure(reply(404, null, "text/html"))).retry, true);
  assert.equal((await failure(async () => { throw new TypeError("Failed to fetch"); })).retry, true);
  assert.equal((await failure(reply(200, { ...full("1000"), id: "999" }))).retry, false);
});
