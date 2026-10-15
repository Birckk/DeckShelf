// DeckShelf service worker. The build fills in VERSION and PRECACHE (see vite.config.ts).
// It keeps the app shell and bundled files available offline. Collection data stays in
// localStorage; source imports and refreshes always go to the network and are never cached.
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL = `deckshelf-shell-${VERSION}`;
// Viewed card artwork from Scryfall, kept across app updates. Oldest entries go first.
const ART = "deckshelf-art-v1";
const ART_ORIGIN = "https://cards.scryfall.io";
const ART_LIMIT = 800;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("deckshelf-") && key !== SHELL && key !== ART)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// A waiting version only takes over when the page asks, so an update never reloads mid-edit.
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method === "GET" && url.origin === ART_ORIGIN) {
    event.respondWith(artwork(event));
    return;
  }
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") return;
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match("/index.html", { cacheName: SHELL })
        .then((cached) => cached || fetch(request)),
    );
    return;
  }
  event.respondWith(
    caches.match(request, { cacheName: SHELL }).then((cached) => cached || fetch(request)),
  );
});

// Only verified responses are stored, so a failed or blocked image is never kept as artwork.
async function artwork(event) {
  const cache = await caches.open(ART);
  const cached = await cache.match(event.request.url);
  if (cached) return cached;
  const response = await fetch(event.request.url, { mode: "cors", credentials: "omit" });
  if (response.ok) {
    event.waitUntil(store(cache, event.request.url, response.clone()));
  }
  return response;
}

async function store(cache, url, response) {
  try {
    await cache.put(url, response);
    await trim(cache, ART_LIMIT);
  } catch {
    // Storage is full: make room by dropping the older half of the artwork.
    await trim(cache, Math.floor((await cache.keys()).length / 2));
  }
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
