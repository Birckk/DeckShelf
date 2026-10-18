import { archidektFormat } from '../shared/formats.mjs';
const ORIGIN = "https://archidekt.com";
const idPattern = /^\d{1,12}$/;

// Archidekt serves a deck's featured art from its card-image host or as a
// storage.googleapis.com art crop. Both name the card, so keep only its ID.
export function featuredCardId(url) {
  return /^https:\/\/(?:card-images\.archidekt\.com\/(?:art|grid)\/front\/[a-f0-9]\/[a-f0-9]\/|storage\.googleapis\.com\/archidekt-card-images\/[a-z0-9]+\/)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\.webp|_art_crop\.jpg)$/.exec(url || '')?.[1] || '';
}
export const archidektImage = (uid, kind) => `https://card-images.archidekt.com/${kind}/front/${uid[0]}/${uid[1]}/${uid}.webp`;

async function read(path, signal) {
  const response = await fetch(`${ORIGIN}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DeckShelf/1.0 (personal deck showcase)",
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404 || response.status === 403
        ? "Source not found or not public. Check the Archidekt link."
        : "Archidekt is unavailable right now. Your saved collection is unchanged.",
    );
  return response.json();
}

export async function discoverSource(kind, value, { strict = false, verifyCount = false, signal: outerSignal, firstPage, formatScope = 'commander' } = {}) {
  if (!['commander', 'all'].includes(formatScope) || (strict && formatScope !== 'commander')) throw new Error('Choose Commander or All formats.');
  if (
    !["account", "folder"].includes(kind) ||
    !(kind === "folder" ? idPattern : /^[\p{L}\p{N}_.@+ -]{1,100}$/u).test(
      value,
    )
  )
    throw new Error("Use an Archidekt username or folder ID.");
  const entries = new Map();
  const signal = outerSignal || AbortSignal.timeout(45000);
  const pages = new Set();
  let name = value;
  let complete = false;
  let expectedCount;
  const seen = new Set();
  for (let page = 1; page <= 50; page++) {
    // Construct pagination ourselves; never fetch a URL supplied by upstream data.
    const path =
      kind === "account"
        ? `/api/decks/v3/?${new URLSearchParams({ ownerUsername: value, ...(formatScope === 'commander' ? { deckFormat: "3" } : {}), page: String(page) })}`
        : `/api/decks/folders/${value}/?page=${page}`;
    const data = page === 1 && firstPage ? firstPage : await read(path, signal);
    const rows = kind === "account" ? data.results : data.decks;
    if (verifyCount) {
      if (!Number.isInteger(data.count) || data.count < 0 || (expectedCount !== undefined && expectedCount !== data.count))
        throw new Error('The folder count changed or is unavailable. Try again.');
      expectedCount = data.count;
    }
    if (strict) {
      if (!Number.isInteger(data.count) || data.count < 1 ||
          (expectedCount !== undefined && expectedCount !== data.count))
        throw new Error("Catalog count is missing or changed during pagination.");
      expectedCount = data.count;
    }
    if (
      !Array.isArray(rows) ||
      (kind === "folder" && (String(data.id) !== value || data.private))
    )
      throw new Error(
        "Archidekt returned an unexpected source response. Your saved collection is unchanged.",
      );
    const signature = JSON.stringify(rows.map((row) => row.id));
    if (pages.has(signature))
      throw new Error(
        "Archidekt repeated a page of results. Please try refreshing later.",
      );
    pages.add(signature);
    if (Number(data.count) > 1000)
      throw new Error(
        "This source has more than 1,000 decks. Link a smaller folder instead.",
      );
    if (kind === "folder") name = String(data.name || `Folder ${value}`);
    for (const row of rows) {
      if (verifyCount && seen.has(String(row.id))) throw new Error('Archidekt repeated a deck during pagination. Try again.');
      if (strict && (seen.has(String(row.id)) || row.private || row.deckFormat !== 3))
        throw new Error("Catalog contains duplicate or unavailable entries.");
      seen.add(String(row.id));
      if (row.private || (formatScope === 'commander' && row.deckFormat !== 3)) continue;
      if (
        kind === "account" &&
        row.owner?.username?.toLowerCase() !== value.toLowerCase()
      )
        throw new Error("Archidekt returned decks for a different account.");
      if (kind === "folder" && String(row.parentFolderId) !== value)
        throw new Error("Archidekt returned decks outside this folder.");
      const id = String(row.id);
      if (!idPattern.test(id) || typeof row.name !== "string")
        throw new Error("Archidekt returned incomplete deck information.");
      const featuredId = featuredCardId(row.featured);
      const image = featuredId
        ? archidektImage(featuredId, "art")
        : typeof row.featured === "string" && row.featured.startsWith("https://")
          ? row.featured
          : "";
      entries.set(id, {
        format: archidektFormat(row.deckFormat),
        id,
        name: row.name,
        image,
        colors: [..."WUBRG"].filter((c) => Number(row.colors?.[c]) > 0),
      });
    }
    if (entries.size > 1000)
      throw new Error(
        "This source has more than 1,000 decks. Link a smaller folder instead.",
      );
    if (!data.next) {
      complete = true;
      break;
    }
  }
  if (!complete)
    throw new Error(
      "This source is too large to read completely. Link a smaller folder instead.",
    );
  if (strict && entries.size !== expectedCount)
    throw new Error(`Incomplete catalog: expected ${expectedCount}, received ${entries.size}.`);
  if (verifyCount && seen.size !== expectedCount)
    throw new Error('The folder listing was incomplete. Try again; saved decks are unchanged.');
  return {
    key: `${kind}:${value.toLowerCase()}`,
    ...(formatScope === 'all' ? { formatScope } : {}),
    kind,
    value,
    name,
    url:
      kind === "folder"
        ? `${ORIGIN}/folders/${value}`
        : `${ORIGIN}/u/${encodeURIComponent(value)}`,
    checkedAt: new Date().toISOString(),
    entries: [...entries.values()],
    knownIds: [...entries.keys()],
    ...(strict ? { expectedCount, pages: pages.size } : {}),
  };
}

// Discovery is a preview. It never changes a visitor's saved source selections.
export async function discoverFolders(kind, value, { formatScope = 'commander' } = {}) {
  if (!['commander', 'all'].includes(formatScope)) throw new Error('Choose Commander or All formats.');
  if (!['account', 'folder'].includes(kind) ||
      !(kind === 'folder' ? idPattern : /^[\p{L}\p{N}_.@+ -]{1,100}$/u).test(value))
    throw new Error('Enter an Archidekt username, profile or folder link.');
  const signal = AbortSignal.timeout(45000);
  let root = value;
  if (kind === 'account') {
    const response = await fetch(`${ORIGIN}/u/${encodeURIComponent(value)}`, {
      headers: { Accept: 'text/html', 'User-Agent': 'DeckShelf/1.0 (personal deck showcase)' },
      signal, redirect: 'error',
    });
    if (!response.ok) throw new Error('Account not found or not public. Check the username.');
    const html = await response.text();
    const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    let user;
    try { user = JSON.parse(match?.[1] || '').props.pageProps.user; } catch { /* Report a changed upstream shape below. */ }
    if (user?.username?.toLowerCase() !== value.toLowerCase() || !idPattern.test(String(user.rootFolderId)))
      throw new Error('Could not read this account’s folders. Try a public folder link instead.');
    root = String(user.rootFolderId);
  }
  const queue = [{ id: root, path: '' }];
  const seen = new Set([root]);
  const folders = [];
  const ids = new Set();
  while (queue.length) {
    const batch = queue.splice(0, 4);
    const results = await Promise.all(batch.map(async item => {
      const data = await read(`/api/decks/folders/${item.id}/?page=1`, signal);
      if (kind === 'account' && data.owner?.username?.toLowerCase() !== value.toLowerCase())
        throw new Error('Archidekt returned a folder for a different account.');
      const source = await discoverSource('folder', item.id, { signal, firstPage: data, verifyCount: true, formatScope });
      if (!Array.isArray(data.subfolders)) throw new Error('Could not read the complete folder listing. Try a smaller folder link.');
      return { item, source, children: data.subfolders };
    }));
    for (const { item, source, children } of results) {
      const path = item.path ? `${item.path} / ${source.name}` : source.name;
      folders.push({ source, path, root: item.id === root });
      source.entries.forEach(entry => ids.add(entry.id));
      if (ids.size > 1000) throw new Error('This collection has more than 1,000 decks. Paste a smaller folder link.');
      for (const child of children) {
        if (child.private) continue;
        const id = String(child.id);
        if (!idPattern.test(id) || seen.has(id)) throw new Error('Archidekt returned an inconsistent folder tree. Try a smaller folder link.');
        seen.add(id);
        if (seen.size > 80) throw new Error('This account has more than 80 folders. Paste a smaller folder link.');
        queue.push({ id, path });
      }
    }
  }
  return { name: kind === 'account' ? value : folders[0].source.name, folders };
}
