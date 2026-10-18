// A local, read-only MCP server: lets an agent find a public Archidekt library and
// pick a deck with the same rules and odds as the app. It never changes a saved collection.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fetchDeck } from './api.mjs';
import { createDeckCache, defaultCacheFile } from './deck-cache.mjs';
import { accountExists, discoverFolders, discoverSource, readFolderPage } from './sources.mjs';
import { archidektFormat, formatName, formatOf } from '../shared/formats.mjs';
import { parseSourceInput } from '../src/collection.ts';
import { EMPTY_FILTERS, matchesDeck, randomIndex } from '../src/domain.ts';

const PRECONS = 'precons';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let precons;

const color = z.enum(['W', 'U', 'B', 'R', 'G']);
const summary = { id: z.string(), name: z.string(), format: z.string(), commander: z.string(), colors: z.array(color) };
const sourceInfo = z.object({ name: z.string(), url: z.string() });
const unavailable = z.array(z.object({ id: z.string(), name: z.string(), reason: z.string() }));
const sourceInput = z.string().trim().min(1).max(2000).describe(
  'An Archidekt username, a profile/folder/deck link from archidekt.com, or "precons" for the Official Commander precons bundled with DeckShelf.');

const noteOutput = z.string().optional().describe('Something the person may want to know about the source, such as subfolders left out.');

const formatInput = z.string().trim().min(1).max(40).optional().describe(
  'Deck format: "Commander" (the default for libraries), another Archidekt format such as "Modern", "Pauper" or "Brawl", or "all". A single deck link accepts any format unless one is given.');
const FORMATS = Array.from({ length: 40 }, (_, i) => archidektFormat(i + 1)).filter(f => !f.id.startsWith('unknown'));

// Resolved before any request, so a typo costs nothing.
function resolveFormat(input, kind) {
  if (!input) return kind === 'deck' ? 'all' : 'commander';
  const wanted = input.toLowerCase();
  if (wanted === 'all') return 'all';
  const match = FORMATS.find(f => f.id === wanted.replaceAll(' ', '-') || f.name.toLowerCase() === wanted);
  if (!match) throw new Error(`Unknown format "${input}". Use a format name such as Commander, Modern or Pauper, or "all".`);
  return match.id;
}
const inScope = (scope, format) => scope === 'all' || (format?.id ?? 'commander') === scope;
const scopeLabel = scope => scope === 'all' ? 'public decks' : `public ${formatName(scope)} decks`;

const includeSubfoldersInput = z.boolean().optional().describe('Include descendant folders for a folder link (default false); ignored for other sources.');

// People paste links without the scheme; parseSourceInput needs it to recognise a link.
const withScheme = input => /^(www\.)?archidekt\.com\//i.test(input) ? `https://${input}` : input;

const describe = deck => ({
  id: deck.id, name: deck.name, format: formatOf(deck).name, commander: deck.commanders.map(c => c.name).join(' & '), colors: deck.colors,
});

const LIMITED = 'Archidekt is limiting requests right now. Ask again in a minute; decks already read are kept on this computer.';
// Archidekt answers 429 without Retry-After once a cold library load goes too fast.
export const BACKOFF = { first: 5000, max: 30000, total: 60000 };

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

// Same pacing as the app's import: two deck requests at a time, backing off when limited.
async function loadDecks(entries, getDeck, progress, signal, backoff) {
  const decks = [];
  const failed = [];
  const queue = [...entries];
  let delay = backoff.first;
  let waited = 0;
  let note;
  while (queue.length) {
    signal.throwIfAborted();
    const limited = [];
    await Promise.all(queue.splice(0, 2).map(async entry => {
      try { decks.push(await getDeck(entry.id, signal, entry.updatedAt)); }
      catch (error) {
        signal.throwIfAborted();
        if (error?.status === 429) limited.push(entry);
        else failed.push({ id: entry.id, name: entry.name, reason: message(error) });
      }
    }));
    if (limited.length) {
      if (waited + delay > backoff.total) {
        const left = [...limited, ...queue.splice(0)];
        failed.push(...left.map(entry => ({ id: entry.id, name: entry.name, reason: LIMITED })));
        note = `Archidekt limited requests, so ${left.length} deck${left.length === 1 ? ' was' : 's were'} not read yet. Ask again in a minute; the ${decks.length} decks already read are kept, so the next call continues from here.`;
        break;
      }
      queue.unshift(...limited);
      await wait(delay, signal);
      waited += delay;
      delay = Math.min(delay * 2, backoff.max);
    }
    signal.throwIfAborted();
    await progress(decks.length + failed.length, entries.length);
  }
  const order = entries.map(e => e.id);
  return { decks: decks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)), failed, ...(note ? { note } : {}) };
}

async function loadCollection(input, { getDeck, progress, signal, includeSubfolders = false, format, backoff }) {
  signal.throwIfAborted();
  if (input.toLowerCase() === PRECONS) {
    const scope = resolveFormat(format, PRECONS);
    precons ||= JSON.parse(readFileSync(new URL('../src/data/precons.json', import.meta.url), 'utf8'));
    const decks = inScope(scope, undefined) ? precons.decks : [];
    return { source: { name: 'Official Commander precons', url: precons.sourceUrl }, scope, decks, failed: [],
      ...(decks.length ? {} : { note: 'The bundled precons are all Commander decks.' }) };
  }
  const { kind, value } = parseSourceInput(withScheme(input));
  const scope = resolveFormat(format, kind);
  if (kind === 'deck') {
    const deck = await getDeck(value, signal);
    const fits = inScope(scope, formatOf(deck));
    return { source: { name: deck.name, url: deck.sourceUrl }, scope, decks: fits ? [deck] : [], failed: [],
      ...(fits ? {} : { note: `This is a ${formatOf(deck).name} deck.` }) };
  }
  const options = { signal, formatScope: scope === 'commander' ? 'commander' : 'all', withUpdatedAt: true };
  let name, url, entries, note;
  if (kind === 'account') {
    ({ name, url, entries } = await discoverSource(kind, value, options));
    if (!entries.length) {
      if (!(await accountExists(value, signal))) throw new Error(`Archidekt has no user named "${value}". Check the spelling.`);
      note = scope === 'commander'
        ? 'Private decks are not listed, and only Commander decks were checked; set format to "all" to include other formats.'
        : 'Private decks are not listed.';
    }
  } else if (!includeSubfolders) {
    const firstPage = await readFolderPage(value, signal);
    ({ name, url, entries } = await discoverSource(kind, value, { ...options, firstPage }));
    const subfolders = (firstPage.subfolders || []).filter(f => !f.private).length;
    if (subfolders) note = `This folder has ${subfolders} subfolder${subfolders > 1 ? 's' : ''} that ${subfolders > 1 ? 'were' : 'was'} not included; set includeSubfolders to true to include ${subfolders > 1 ? 'their' : 'its'} decks.`;
  } else {
    // Descendants are opt-in; a folder selection normally covers only direct decks.
    const found = await discoverFolders('folder', value, options);
    name = found.name;
    url = found.folders[0].source.url;
    entries = [...new Map(found.folders.flatMap(f => f.source.entries).map(e => [e.id, e])).values()];
  }
  // The listing names each deck's format, so decks in other formats are never fetched.
  const wanted = entries.filter(e => inScope(scope, e.format));
  if (entries.length && !wanted.length)
    note = [`None of the ${entries.length} public decks here are ${formatName(scope)} decks.`, note].filter(Boolean).join(' ');
  const loaded = await loadDecks(wanted, getDeck, progress, signal, backoff);
  const notes = [note, loaded.note].filter(Boolean).join(' ');
  return { source: { name, url }, scope, decks: loaded.decks, failed: loaded.failed, ...(notes ? { note: notes } : {}) };
}

// Concurrent calls (agents often list and pick at once) share one request per deck. The
// request is aborted only when every caller waiting on it has been cancelled.
function sharedFetch(id, store, inflight, signal) {
  signal.throwIfAborted();
  let entry = inflight.get(id);
  if (!entry) {
    const controller = new AbortController();
    const forget = () => { if (inflight.get(id) === entry) inflight.delete(id); };
    entry = { controller, forget, waiting: 0 };
    // The deck cache decides freshness, so always ask Archidekt here.
    entry.promise = fetchDeck(id, { refresh: true, store, limit: 1000, signal: controller.signal }).finally(forget);
    inflight.set(id, entry);
  }
  const shared = entry;
  shared.waiting++;
  return new Promise((resolve, reject) => {
    const abort = () => {
      if (--shared.waiting === 0) { shared.forget(); shared.controller.abort(signal.reason); }
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    shared.promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// A deck that is missing or unreadable (no commander, private) stays so until it is edited;
// limits, outages, timeouts and cancellations are worth asking about again.
const lasting = error => [403, 404].includes(error?.status) || (error?.status === undefined && error?.name === 'Error');

function message(error) {
  if (error?.status === 429) return LIMITED;
  if (error?.name === 'TimeoutError') return 'Archidekt took too long to respond. Try again shortly.';
  if (error instanceof TypeError && /URL/i.test(error.message)) return 'Use a public https://archidekt.com link.';
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) return 'Could not reach Archidekt. Check the connection and try again.';
  return error?.message || 'Could not read this source.';
}

function result(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

async function run(task, cache) {
  try {
    const data = await task();
    return { ...result(data), ...(data.error ? { isError: true } : {}) };
  }
  catch (error) { return { isError: true, content: [{ type: 'text', text: message(error) }] }; }
  // Also after a cancelled load, so the decks it did read are kept.
  finally { cache.save(); }
}

function reporter(extra) {
  const token = extra?._meta?.progressToken;
  return async (progress, total) => {
    if (token !== undefined)
      await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress, total } });
  };
}

// Without a cacheFile, decks are cached in memory for this process only (as in tests).
export function createServer({ cacheFile, backoff = BACKOFF } = {}) {
  const store = new Map();
  const inflight = new Map();
  const cache = createDeckCache(cacheFile);
  const getDeck = async (id, signal, updatedAt) => {
    const cached = cache.get(id, updatedAt);
    if (cached?.failed) throw new Error(cached.failed);
    if (cached) return cached;
    let deck;
    try { deck = await sharedFetch(id, store, inflight, signal); }
    catch (error) {
      if (updatedAt && !signal.aborted && lasting(error)) cache.fail(id, error.message, updatedAt);
      throw error;
    }
    cache.put(id, deck, updatedAt);
    return deck;
  };
  const server = new McpServer({ name: 'deckshelf', version }, {
    instructions: 'Read-only access to public Archidekt decks (Commander unless a format is given). Use find_collection to see a library, pick_deck to choose at random with DeckShelf\'s filters and equal odds, and deck_details for one deck. Nothing here changes anyone\'s saved DeckShelf collection.',
  });
  const annotations = { readOnlyHint: true, openWorldHint: true };

  server.registerTool('find_collection', {
    title: 'Find a deck collection',
    description: 'List the public decks in an Archidekt library, Commander decks unless format says otherwise: a username, a folder link (direct decks by default; set includeSubfolders to include descendants), a single deck link, or "precons". Returns the source name and each deck\'s id, name, format, commander and colour identity (WUBRG). Decks that could not be read are listed under unavailable.',
    inputSchema: { source: sourceInput, format: formatInput, includeSubfolders: includeSubfoldersInput },
    outputSchema: { source: sourceInfo, count: z.number(), decks: z.array(z.object(summary)), unavailable, note: noteOutput },
    annotations: { ...annotations, idempotentHint: true },
  }, ({ source, format, includeSubfolders }, extra) => run(async () => {
    const found = await loadCollection(source, { getDeck, progress: reporter(extra), signal: extra.signal, includeSubfolders, format, backoff });
    return { source: found.source, count: found.decks.length, decks: found.decks.map(describe), unavailable: found.failed, ...(found.note ? { note: found.note } : {}) };
  }, cache));

  server.registerTool('pick_deck', {
    title: 'Pick a deck',
    description: 'Pick 1–4 different decks at random from a collection, using the DeckShelf picker rules: every eligible deck has equal odds. It reads the collection itself, so there is no need to call find_collection first. Filters are optional. colors keeps decks that include all the given colours; exact also requires no other colours; colorless keeps only colourless decks. query must match every word against the deck name, format, set, tags, description or commander names. Returns fewer picks when the eligible pool is smaller than count. Only Commander decks unless format says otherwise. Folder links use direct decks unless includeSubfolders is true. Returns the picks with Archidekt links and how many decks were eligible.',
    inputSchema: {
      source: sourceInput,
      format: formatInput,
      includeSubfolders: includeSubfoldersInput,
      colors: z.array(color).max(5).refine(c => new Set(c).size === c.length, 'List each colour once.').optional()
        .describe('Colour identity letters: W white, U blue, B black, R red, G green.'),
      exact: z.boolean().optional().describe('Only decks with exactly these colours.'),
      colorless: z.boolean().optional().describe('Only colourless decks. Cannot be combined with colors.'),
      query: z.string().trim().max(200).optional().describe('Words that must all appear, for example "dragons" or "Atraxa".'),
      count: z.number().int().min(1).max(4).optional().describe('How many different decks to pick (1–4, default 1).'),
    },
    outputSchema: {
      source: sourceInfo, eligible: z.number(), total: z.number(),
      picks: z.array(z.object({ ...summary, url: z.string() })), unavailable, note: noteOutput, error: z.string().optional(),
    },
    annotations,
  }, ({ source, format, includeSubfolders, colors = [], exact = false, colorless = false, query = '', count = 1 }, extra) => run(async () => {
    if (colorless && colors.length) throw new Error('Choose colours or colourless, not both.');
    const found = await loadCollection(source, { getDeck, progress: reporter(extra), signal: extra.signal, includeSubfolders, format, backoff });
    // loadCollection already kept only the requested format.
    const filters = { ...EMPTY_FILTERS, format: 'all', colors, exact, colorless, query };
    const pool = found.decks.filter(deck => matchesDeck(deck, filters));
    if (!pool.length) {
      const checked = `${found.decks.length} deck${found.decks.length === 1 ? '' : 's'} checked`;
      const error = found.failed.length
        ? `${found.decks.length ? 'No loaded decks match these filters' : 'Could not load any decks'} in ${found.source.name} (${checked}; ${found.failed.length} unavailable).`
        : found.decks.length
          ? `No decks in ${found.source.name} match these filters (${checked}).`
          : `${found.source.name} has no ${scopeLabel(found.scope)} to pick from.`;
      return { error: found.note ? `${error} ${found.note}` : error, source: found.source, eligible: 0, total: found.decks.length, picks: [], unavailable: found.failed };
    }
    const eligible = pool.length;
    const picks = [];
    while (picks.length < count && pool.length) picks.push(pool.splice(randomIndex(pool.length), 1)[0]);
    return {
      source: found.source, eligible, total: found.decks.length,
      picks: picks.map(deck => ({ ...describe(deck), url: deck.sourceUrl })), unavailable: found.failed,
      ...(found.note ? { note: found.note } : {}),
    };
  }, cache));

  server.registerTool('deck_details', {
    title: 'Deck details',
    description: 'Show one public Archidekt deck: its format (usually Commander; other formats have no commanders), its commanders and their artists, set, colour identity, tags, description and card count (main deck, without maybeboard and sideboard).',
    inputSchema: { deck: z.string().trim().min(1).max(2000).describe('An archidekt.com deck link or a numeric deck ID.') },
    outputSchema: {
      id: z.string(), name: z.string(), url: z.string(), format: z.string(), set: z.string(), colors: z.array(color), tags: z.array(z.string()),
      commanders: z.array(z.object({ name: z.string(), artist: z.string() })), description: z.string(), cardCount: z.number(),
    },
    annotations: { ...annotations, idempotentHint: true },
  }, ({ deck }, extra) => run(async () => {
    const signal = extra.signal;
    signal.throwIfAborted();
    const { kind, value } = parseSourceInput(withScheme(deck), 'deck');
    if (kind !== 'deck') throw new Error('Use an Archidekt deck link or a numeric deck ID.');
    const found = await getDeck(value, signal);
    return {
      id: found.id, name: found.name, url: found.sourceUrl, format: formatOf(found).name, set: found.set, colors: found.colors, tags: found.tags,
      commanders: found.commanders.map(c => ({ name: c.name, artist: c.artist })),
      description: found.description, cardCount: found.cardCount,
    };
  }, cache));
  return server;
}

// Tests import createServer; only a direct start speaks MCP over stdio, with the disk cache.
if (resolve(process.argv[1] || '').toLowerCase() === import.meta.filename.toLowerCase())
  await createServer({ cacheFile: defaultCacheFile() }).connect(new StdioServerTransport());
