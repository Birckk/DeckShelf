import { discoverSource, discoverFolders, featuredCardId, archidektImage } from './sources.mjs';
import { archidektFormat } from '../shared/formats.mjs';
const cache = new Map();
const colors = { White:'W', Blue:'U', Black:'B', Red:'R', Green:'G' };
const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
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
    colors:[...'WUBRG'].filter(c => identity.has(c)), theme:'',
    tags:(data.deckTags || []).map(t => t.tag?.name || t.name).filter(t => typeof t === 'string'),
    description:descriptionText(data.description).slice(0, 12000), commanders,
    sourceUrl:`https://archidekt.com/decks/${data.id}`, sourceName:'Archidekt',
    cardCount:data.cards.filter(c => !c.categories?.some(k => ['Maybeboard','Sideboard'].includes(k))).reduce((n,c) => n + c.quantity, 0),
    releasedAt:cards[0]?.releasedAt || '', fetchedAt:new Date().toISOString(),
  };
}

export async function handleApi(req, res, next = () => { res.writeHead(404); res.end('Not found'); }) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return next();
  const match = /^\/api\/decks\/(\d{1,12})$/.exec(url.pathname);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (['/api/sources', '/api/source-folders'].includes(url.pathname) && req.method === 'GET') {
    try {
      const discover = url.pathname === '/api/source-folders' ? discoverFolders : discoverSource;
      const source = await discover(url.searchParams.get('kind'), url.searchParams.get('value') || '', { formatScope: url.searchParams.get('formats') || 'commander' });
      res.end(JSON.stringify(source));
    } catch (error) {
      res.writeHead(502);
      res.end(JSON.stringify({error:error.name === 'TimeoutError' ? 'Archidekt took too long to respond. Your saved collection is unchanged.' : error.message}));
    }
    return;
  }
  if (!match || req.method !== 'GET') {
    res.writeHead(404); res.end(JSON.stringify({ error:'Unknown source request.' })); return;
  }
  try {
    const id = match[1];
    let cached = cache.get(id);
    if (url.searchParams.get('refresh') === '1' || !cached || Date.now() - cached.time > 3600000) {
      const response = await fetch(`https://archidekt.com/api/decks/${id}/`, {
        headers:{ 'User-Agent':'DeckShelf/1.0 (personal deck showcase)', Accept:'application/json' },
        signal:AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(response.status === 404 ? 'Deck not found. Check the link and make sure the deck is public.' : 'Archidekt is unavailable right now. Please try again later.');
      const data = await response.json();
      if (String(data.id) !== id) throw new Error('The source returned an unexpected deck.');
      cached = { time:Date.now(), deck:normalizeDeck(data) };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(id, cached);
    }
    res.end(JSON.stringify(cached.deck));
  } catch (error) {
    res.writeHead(502);
    res.end(JSON.stringify({error:error.name === 'TimeoutError' ? 'Archidekt took too long to respond. Your saved collection is still available.' : error.message || 'Could not fetch this deck.'}));
  }
}
