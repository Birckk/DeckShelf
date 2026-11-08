import { fetchArchidekt, upstreamCooldown } from './archidekt.mjs';
import { cachedSource, discoverSource, discoverFolders, featuredCardId, archidektImage } from './sources.mjs';
import { archidektFormat } from '../shared/formats.mjs';
const cache = new Map();
const pendingDecks = new Map();
const failedDecks = new Map();
const colors = { White:'W', Blue:'U', Black:'B', Red:'R', Green:'G' };
const entities = { '&amp;':'&', '&quot;':'"', '&#39;':"'", '&lt;':'<', '&gt;':'>' };
const stripTags = value => { let text = value, previous; do { previous = text; text = text.replace(/<[^<>]*>/g, ''); } while (text !== previous); return text; };
// Strip tags until none remain, then decode entities in one pass so &amp;quot; stays &quot;. React escapes the result on render.
const plain = value => stripTags(String(value || '')).replace(/&(?:amp|quot|#39|lt|gt);/g, entity => entities[entity]).trim();
export function descriptionText(value) {
  if (!value) return '';
  try {
    const rich = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(rich.ops)) return plain(rich.ops.map(op => typeof op.insert === 'string' ? op.insert : typeof op.insert?.['card-link'] === 'string' ? op.insert['card-link'] : '').join(''));
  } catch { /* Older decks may contain plain text or HTML. */ }
  return plain(value);
}

export function normalizeDeck(data) {
  if (data.private || !Array.isArray(data.cards)) throw new Error('Use a public deck from Archidekt.');
  const format = archidektFormat(data.deckFormat);
  const cards = data.cards.filter(c => c.categories?.includes('Commander')).map(c => c.card);
  if (!cards.length && format.id === 'commander') throw new Error('That deck has no assigned commander. Set its commander on Archidekt first.');
  cards.sort((a, b) => Number(!(data.featured || '').includes(a.uid)) - Number(!(data.featured || '').includes(b.uid)));
  const mainboard = data.cards.filter(c => !c.categories?.some(k => ['Maybeboard','Sideboard'].includes(k)));
  const identityCards = cards.length ? cards : mainboard.map(c => c.card).filter(Boolean);
  const identity = new Set(identityCards.flatMap(c => (c.oracleCard.colorIdentity || []).map(c => colors[c] || c).filter(c => 'WUBRG'.includes(c))));
  const commanders = cards.map(c => {
    if (!/^[a-f0-9-]{36}$/.test(c.uid)) throw new Error('The source returned an invalid card image identifier.');
    const image = kind => `https://card-images.archidekt.com/${kind}/front/${c.uid[0]}/${c.uid[1]}/${c.uid}.webp`;
    return { name:c.oracleCard.name, image:image('grid'), art:image('art'), artist:c.artist || '' };
  });
  const featured = featuredCardId(data.featured);
  const featuredCard = featured ? data.cards.find(c => c.card?.uid === featured)?.card : undefined;
  const cover = commanders.length ? undefined : featured
    ? { kind:'featured', name:featuredCard?.oracleCard.name || 'Featured card', artist:featuredCard?.artist || '', image:archidektImage(featured, 'grid'), art:archidektImage(featured, 'art') }
    : { kind:'fallback', name:'No cover selected', artist:'', image:'', art:'' };
  return {
    format, ...(cover ? { cover } : {}),
    id:String(data.id), name:plain(data.name), set:cards[0]?.edition.editionname || '',
    colors:['W', 'U', 'B', 'R', 'G'].filter(c => identity.has(c)), theme:'',
    tags:(data.deckTags || []).map(t => t.tag?.name || t.name).filter(t => typeof t === 'string'),
    description:descriptionText(data.description).slice(0, 12000), commanders,
    sourceUrl:`https://archidekt.com/decks/${data.id}`, sourceName:'Archidekt',
    cardCount:data.cards.filter(c => !c.categories?.some(k => ['Maybeboard','Sideboard'].includes(k))).reduce((n,c) => n + c.quantity, 0),
    releasedAt:cards[0]?.releasedAt || '', fetchedAt:new Date().toISOString(),
  };
}

// Deck metadata is cached for an hour; callers with larger collections can pass their own bounded store.
// The web API passes the shared Archidekt cooldown as `request`; the MCP server keeps its own backoff.
export async function fetchDeck(id, { refresh = false, store = cache, limit = 100, signal, request = fetch } = {}) {
  signal?.throwIfAborted();
  if (!/^\d{1,12}$/.test(id)) throw new Error('Use a public Archidekt deck link or its numeric ID.');
  let cached = store.get(id);
  if (refresh || !cached || Date.now() - cached.time > 3600000) {
    const response = await request(`https://archidekt.com/api/decks/${id}/`, {
      headers:{ 'User-Agent':'DeckShelf/1.0 (personal deck showcase)', Accept:'application/json' },
      signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    });
    // The status lets the MCP server back off when Archidekt limits requests (429).
    if (!response.ok) throw Object.assign(new Error(response.status === 404 ? 'Deck not found. Check the link and make sure the deck is public.' : 'Archidekt is unavailable right now. Please try again later.'), { status: response.status });
    const data = await response.json();
    signal?.throwIfAborted();
    if (String(data.id) !== id) throw new Error('The source returned an unexpected deck.');
    cached = { time:Date.now(), deck:normalizeDeck(data) };
    store.delete(id);
    if (store.size >= limit) store.delete(store.keys().next().value);
    store.set(id, cached);
  }
  return cached.deck;
}

// Rate limits, upstream outages and timeouts pass; a private, missing or invalid deck does not.
// Cloudflare swaps the body of an origin's 502 for its own text, so a proxied site would lose
// the JSON error and its retry flag. 424 (Failed Dependency) passes through unchanged.
const UPSTREAM_FAILED = 424;
const retryable = error => error.status === 429 || error.status >= 500 || error.retryAfter > 0 ||
  ['TimeoutError', 'TypeError'].includes(error.name);

export async function handleApi(req, res, next = () => { res.writeHead(404); res.end('Not found'); }) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();
  const match = /^\/api\/decks\/(\d{1,12})$/.exec(url.pathname);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (['/api/sources', '/api/source-folders'].includes(url.pathname) && req.method === 'GET') {
    try {
      const discover = url.pathname === '/api/source-folders' ? discoverFolders : url.searchParams.get('prototype') === '1' ? cachedSource : discoverSource;
      const formatScope = url.searchParams.get('formats') || 'commander';
      const source = discover === cachedSource
        ? await cachedSource(url.searchParams.get('kind'), url.searchParams.get('value') || '', url.searchParams.get('refresh') === '1', formatScope)
        : await discover(url.searchParams.get('kind'), url.searchParams.get('value') || '', { formatScope, request:fetchArchidekt });
      res.end(JSON.stringify(source));
    } catch (error) {
      res.writeHead(UPSTREAM_FAILED);
      res.end(JSON.stringify({error:error.name === 'TimeoutError' ? 'Archidekt took too long to respond. Your saved collection is unchanged.' : error.message}));
    }
    return;
  }
  if (!match || req.method !== 'GET') {
    res.writeHead(404); res.end(JSON.stringify({ error:'Unknown source request.' })); return;
  }
  try {
    const id = match[1];
    const manual = url.searchParams.get('refresh') === '1';
    const failed = failedDecks.get(id);
    // A remembered failure answers as the original did, including whether to try again later.
    if (!manual && failed?.retryAt > Date.now()) throw Object.assign(new Error(failed.error), { retry: failed.retry });
    // Automatic checks share one in-flight request per deck and remember failures briefly.
    let request = !manual && pendingDecks.get(id);
    if (!request) {
      request = fetchDeck(id, { refresh:manual, request:fetchArchidekt });
      if (!manual) pendingDecks.set(id, request);
    }
    try {
      const deck = await request;
      failedDecks.delete(id);
      res.end(JSON.stringify(deck));
    } catch (error) {
      if (!manual) {
        if (failedDecks.size >= 100) failedDecks.delete(failedDecks.keys().next().value);
        failedDecks.set(id, { error: error.message, retry: retryable(error), retryAt: Math.max(Date.now() + 60000, upstreamCooldown.retryAt) });
      }
      throw error;
    } finally { if (pendingDecks.get(id) === request) pendingDecks.delete(id); }
  } catch (error) {
    // retry tells background filling whether to keep a listed deck for later or drop it.
    const retry = error.retry ?? retryable(error);
    res.writeHead(UPSTREAM_FAILED);
    res.end(JSON.stringify({error:error.name === 'TimeoutError' ? 'Archidekt took too long to respond. Your saved collection is still available.' : error.message || 'Could not fetch this deck.', retry}));
  }
}
