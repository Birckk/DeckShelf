const ORIGIN = "https://archidekt.com";
const idPattern = /^\d{1,12}$/;

async function read(path, signal) {
  const response = await fetch(`${ORIGIN}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CommanderArchive/1.0 (personal deck showcase)",
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

export async function discoverSource(kind, value, { strict = false } = {}) {
  if (
    !["account", "folder"].includes(kind) ||
    !(kind === "folder" ? idPattern : /^[\p{L}\p{N}_.@+ -]{1,100}$/u).test(
      value,
    )
  )
    throw new Error("Use an Archidekt username or folder ID.");
  const entries = new Map();
  const signal = AbortSignal.timeout(45000);
  const pages = new Set();
  let name = value;
  let complete = false;
  let expectedCount;
  const seen = new Set();
  for (let page = 1; page <= 50; page++) {
    // Construct pagination ourselves; never fetch a URL supplied by upstream data.
    const path =
      kind === "account"
        ? `/api/decks/v3/?${new URLSearchParams({ ownerUsername: value, deckFormat: "3", page: String(page) })}`
        : `/api/decks/folders/${value}/?page=${page}`;
    const data = await read(path, signal);
    const rows = kind === "account" ? data.results : data.decks;
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
      if (strict && (seen.has(String(row.id)) || row.private || row.deckFormat !== 3))
        throw new Error("Catalog contains duplicate or unavailable entries.");
      seen.add(String(row.id));
      if (row.private || row.deckFormat !== 3) continue;
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
      const image =
        typeof row.featured === "string" && row.featured.startsWith("https://")
          ? row.featured
          : "";
      entries.set(id, {
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
  return {
    key: `${kind}:${value.toLowerCase()}`,
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
