import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { discoverSource } from '../server/sources.mjs';
import { normalizeDeck } from '../server/api.mjs';
import { validateDeck } from '../src/domain.ts';

export async function buildCatalog({ discover = () => discoverSource('account', 'Archidekt_Precons', { strict: true }), readDeck, pause = () => new Promise(r => setTimeout(r, 1200)), progress = () => {} } = {}) {
  const signal = AbortSignal.timeout(15 * 60_000);
  readDeck ??= async id => {
    for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://archidekt.com/api/decks/${id}/`, {
      headers: { Accept: 'application/json', 'User-Agent': 'DeckShelf/1.0 (curated precon snapshot)' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    if (response.status === 429 && attempt < 2) {
      const retry = Number(response.headers.get('retry-after') || 60);
      if (!Number.isFinite(retry) || retry > 60) throw new Error('Rate limited; retry this update later.');
      await new Promise(r => setTimeout(r, Math.max(1, retry) * 1000));
      signal.throwIfAborted();
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
    }
  };
  const source = await discover();
  if (!source.entries.length || source.entries.length > 1000 || source.expectedCount !== source.entries.length)
    throw new Error('Catalog discovery was not complete.');
  const decks = [];
  const failures = [];
  // One request at a time, spaced starts, at most three attempts and 1,000 decks.
  for (let offset = 0; offset < source.entries.length; offset++) {
    signal.throwIfAborted();
    await Promise.all(source.entries.slice(offset, offset + 1).map(async entry => {
      try {
        const data = await readDeck(entry.id);
        if (String(data.id) !== entry.id || data.owner?.username?.toLowerCase() !== 'archidekt_precons')
          throw new Error('Unexpected deck or owner');
        const deck = normalizeDeck(data);
        if (!validateDeck(deck)) throw new Error('Incomplete deck metadata');
        decks.push(deck);
      } catch (error) { failures.push(`${entry.id} (${entry.name}): ${error.message}`); }
    }));
    if (failures.some(f => /429|Rate limited/.test(f))) break;
    progress(offset + 1, source.entries.length);
    await pause();
  }
  if (failures.length) throw new Error(`Snapshot unchanged; ${failures.length} unavailable entries:\n${failures.join('\n')}`);
  const after = await discover();
  const ids = s => s.entries.map(e => e.id).sort().join(',');
  if (ids(after) !== ids(source)) throw new Error('Catalog membership changed during refresh. Snapshot unchanged.');
  const order = new Map(source.entries.map((e, i) => [e.id, i]));
  decks.sort((a, b) => order.get(a.id) - order.get(b.id));
  return {
    version: 1, sourceUrl: 'https://archidekt.com/commander-precons',
    account: 'Archidekt_Precons', snapshotAt: new Date().toISOString(),
    complete: true, expectedCount: source.expectedCount, pages: source.pages,
    unavailable: [], decks,
  };
}

export async function updateCatalog(path, options) {
  const snapshot = await buildCatalog(options);
  // Fail closed on an unexpectedly large drop; a maintainer must investigate the source.
  let previous;
  try { previous = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous && snapshot.decks.length < previous.decks.length * 0.9)
    throw new Error('Catalog shrank by more than 10%. Investigate before replacing the last good snapshot.');
  const temp = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temp, path);
  } finally { await rm(temp, { force: true }); }
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await updateCatalog(fileURLToPath(new URL('../src/data/precons.json', import.meta.url)), {
      progress: (done, total) => { if (done % 20 === 0 || done === total) console.log(`${done}/${total} decks checked`); },
    });
    console.log(`Saved ${result.decks.length} precons from ${result.pages} pages at ${result.snapshotAt}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
