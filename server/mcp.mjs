// A local, read-only MCP server: lets an agent find a public Archidekt library and
// pick a deck with the same rules and odds as the app. It never changes a saved collection.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fetchDeck } from './api.mjs';
import { accountExists, discoverFolders, discoverSource, readFolderPage } from './sources.mjs';
import { parseSourceInput } from '../src/collection.ts';
import { EMPTY_FILTERS, matchesDeck, randomIndex } from '../src/domain.ts';

const PRECONS = 'precons';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let precons;

const color = z.enum(['W', 'U', 'B', 'R', 'G']);
const summary = { id: z.string(), name: z.string(), commander: z.string(), colors: z.array(color) };
const sourceInfo = z.object({ name: z.string(), url: z.string() });
const unavailable = z.array(z.object({ id: z.string(), name: z.string(), reason: z.string() }));
const sourceInput = z.string().trim().min(1).max(2000).describe(
  'An Archidekt username, a profile/folder/deck link from archidekt.com, or "precons" for the Official Commander precons bundled with DeckShelf.');

const noteOutput = z.string().optional().describe('Something the person may want to know about the source, such as subfolders left out.');

const includeSubfoldersInput = z.boolean().optional().describe('Include descendant folders for a folder link (default false); ignored for other sources.');

// People paste links without the scheme; parseSourceInput needs it to recognise a link.
const withScheme = input => /^(www\.)?archidekt\.com\//i.test(input) ? `https://${input}` : input;

const describe = deck => ({
  id: deck.id, name: deck.name, commander: deck.commanders.map(c => c.name).join(' & '), colors: deck.colors,
});

// Same pacing as the app's import: two deck requests at a time.
async function loadDecks(entries, store, progress, signal) {
  const decks = [];
  const failed = [];
  for (let index = 0; index < entries.length; index += 2) {
    signal.throwIfAborted();
    await Promise.all(entries.slice(index, index + 2).map(async entry => {
      try { decks.push(await fetchDeck(entry.id, { store, limit: 1000, signal })); }
      catch (error) { signal.throwIfAborted(); failed.push({ id: entry.id, name: entry.name, reason: message(error) }); }
    }));
    signal.throwIfAborted();
    await progress(Math.min(index + 2, entries.length), entries.length);
  }
  const order = entries.map(e => e.id);
  return { decks: decks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)), failed };
}

async function loadCollection(input, store, progress, signal, includeSubfolders = false) {
  signal.throwIfAborted();
  if (input.toLowerCase() === PRECONS) {
    precons ||= JSON.parse(readFileSync(new URL('../src/data/precons.json', import.meta.url), 'utf8'));
    return { source: { name: 'Official Commander precons', url: precons.sourceUrl }, decks: precons.decks, failed: [] };
  }
  const { kind, value } = parseSourceInput(withScheme(input));
  if (kind === 'deck') {
    const deck = await fetchDeck(value, { store, limit: 1000, signal });
    return { source: { name: deck.name, url: deck.sourceUrl }, decks: [deck], failed: [] };
  }
  let name, url, entries, note;
  if (kind === 'account') {
    ({ name, url, entries } = await discoverSource(kind, value, { signal }));
    if (!entries.length) {
      if (!(await accountExists(value, signal))) throw new Error(`Archidekt has no user named "${value}". Check the spelling.`);
      note = 'Private decks and decks in other formats are not listed.';
    }
  } else if (!includeSubfolders) {
    const firstPage = await readFolderPage(value, signal);
    ({ name, url, entries } = await discoverSource(kind, value, { signal, firstPage }));
    const subfolders = (firstPage.subfolders || []).filter(f => !f.private).length;
    if (subfolders) note = `This folder has ${subfolders} subfolder${subfolders > 1 ? 's' : ''} that ${subfolders > 1 ? 'were' : 'was'} not included; set includeSubfolders to true to include ${subfolders > 1 ? 'their' : 'its'} decks.`;
  } else {
    // Descendants are opt-in; a folder selection normally covers only direct decks.
    const found = await discoverFolders('folder', value, { signal });
    name = found.name;
    url = found.folders[0].source.url;
    entries = [...new Map(found.folders.flatMap(f => f.source.entries).map(e => [e.id, e])).values()];
  }
  return { source: { name, url }, ...(await loadDecks(entries, store, progress, signal)), ...(note ? { note } : {}) };
}

function message(error) {
  if (error?.name === 'TimeoutError') return 'Archidekt took too long to respond. Try again shortly.';
  if (error instanceof TypeError && /URL/i.test(error.message)) return 'Use a public https://archidekt.com link.';
  if (error instanceof TypeError && /fetch failed/i.test(error.message)) return 'Could not reach Archidekt. Check the connection and try again.';
  return error?.message || 'Could not read this source.';
}

function result(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

async function run(task) {
  try {
    const data = await task();
    return { ...result(data), ...(data.error ? { isError: true } : {}) };
  }
  catch (error) { return { isError: true, content: [{ type: 'text', text: message(error) }] }; }
}

function reporter(extra) {
  const token = extra?._meta?.progressToken;
  return async (progress, total) => {
    if (token !== undefined)
      await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress, total } });
  };
}

export function createServer() {
  const store = new Map();
  const server = new McpServer({ name: 'deckshelf', version }, {
    instructions: 'Read-only access to public Archidekt Commander decks. Use find_collection to see a library, pick_deck to choose at random with DeckShelf\'s filters and equal odds, and deck_details for one deck. Nothing here changes anyone\'s saved DeckShelf collection.',
  });
  const annotations = { readOnlyHint: true, openWorldHint: true };

  server.registerTool('find_collection', {
    title: 'Find a deck collection',
    description: 'List the public Commander decks in an Archidekt library: a username (all their public Commander decks), a folder link (direct decks by default; set includeSubfolders to include descendants), a single deck link, or "precons". Returns the source name and each deck\'s id, name, commander and colour identity (WUBRG). Decks that could not be read are listed under unavailable.',
    inputSchema: { source: sourceInput, includeSubfolders: includeSubfoldersInput },
    outputSchema: { source: sourceInfo, count: z.number(), decks: z.array(z.object(summary)), unavailable, note: noteOutput },
    annotations: { ...annotations, idempotentHint: true },
  }, ({ source, includeSubfolders }, extra) => run(async () => {
    const found = await loadCollection(source, store, reporter(extra), extra.signal, includeSubfolders);
    return { source: found.source, count: found.decks.length, decks: found.decks.map(describe), unavailable: found.failed, ...(found.note ? { note: found.note } : {}) };
  }));

  server.registerTool('pick_deck', {
    title: 'Pick a deck',
    description: 'Pick 1–4 different decks at random from a collection, using the DeckShelf picker rules: every eligible deck has equal odds. Filters are optional. colors keeps decks that include all the given colours; exact also requires no other colours; colorless keeps only colourless decks. query must match every word against the deck name, set, tags, description or commander names. Returns fewer picks when the eligible pool is smaller than count. Folder links use direct decks unless includeSubfolders is true. Returns the picks with Archidekt links and how many decks were eligible.',
    inputSchema: {
      source: sourceInput,
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
  }, ({ source, includeSubfolders, colors = [], exact = false, colorless = false, query = '', count = 1 }, extra) => run(async () => {
    if (colorless && colors.length) throw new Error('Choose colours or colourless, not both.');
    const found = await loadCollection(source, store, reporter(extra), extra.signal, includeSubfolders);
    const filters = { ...EMPTY_FILTERS, colors, exact, colorless, query };
    const pool = found.decks.filter(deck => matchesDeck(deck, filters));
    if (!pool.length) {
      const checked = `${found.decks.length} deck${found.decks.length === 1 ? '' : 's'} checked`;
      const error = found.failed.length
        ? `${found.decks.length ? 'No loaded decks match these filters' : 'Could not load any decks'} in ${found.source.name} (${checked}; ${found.failed.length} unavailable).`
        : found.decks.length
          ? `No decks in ${found.source.name} match these filters (${checked}).`
          : `${found.source.name} has no public Commander decks to pick from.`;
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
  }));

  server.registerTool('deck_details', {
    title: 'Deck details',
    description: 'Show one public Archidekt Commander deck: its commanders and their artists, set, colour identity, tags, description and card count (main deck, without maybeboard and sideboard).',
    inputSchema: { deck: z.string().trim().min(1).max(2000).describe('An archidekt.com deck link or a numeric deck ID.') },
    outputSchema: {
      id: z.string(), name: z.string(), url: z.string(), set: z.string(), colors: z.array(color), tags: z.array(z.string()),
      commanders: z.array(z.object({ name: z.string(), artist: z.string() })), description: z.string(), cardCount: z.number(),
    },
    annotations: { ...annotations, idempotentHint: true },
  }, ({ deck }, extra) => run(async () => {
    const signal = extra.signal;
    signal.throwIfAborted();
    const { kind, value } = parseSourceInput(withScheme(deck), 'deck');
    if (kind !== 'deck') throw new Error('Use an Archidekt deck link or a numeric deck ID.');
    const found = await fetchDeck(value, { store, limit: 1000, signal });
    return {
      id: found.id, name: found.name, url: found.sourceUrl, set: found.set, colors: found.colors, tags: found.tags,
      commanders: found.commanders.map(c => ({ name: c.name, artist: c.artist })),
      description: found.description, cardCount: found.cardCount,
    };
  }));
  return server;
}

// Tests import createServer; only a direct start speaks MCP over stdio.
if (resolve(process.argv[1] || '').toLowerCase() === import.meta.filename.toLowerCase())
  await createServer().connect(new StdioServerTransport());
