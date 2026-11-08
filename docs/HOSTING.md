# Hosting DeckShelf

The production server serves the built app and the read-only Archidekt adapter.
There is no database or user account: each visitor's collection stays in their
browser. Visitors should export a backup before changing browsers or domains.

## Node

```sh
npm ci
npm run build
HOST=0.0.0.0 PORT=4317 npm start
```

`HOST` defaults to `127.0.0.1`. Put the server behind HTTPS. The `dist/` folder
also works as a static site for browsing, the picker and backups, but adding or
refreshing Archidekt sources needs the Node adapter (`npm run preview` has the
same limit).

## Docker

Images are published to `ghcr.io/birckk/deckshelf`: `sha-<commit>` and `main` for
every green main commit, `vX.Y.Z` and `latest` for releases. Pin deployments by
digest.

Local check, built from source and bound to loopback:

```sh
docker compose -f deploy/compose.yaml up -d --build
curl --fail http://127.0.0.1:4317/healthz
```

Behind an existing reverse proxy on a shared Docker network named `proxy`, with
no host ports published:

```sh
echo "DECKSHELF_IMAGE=ghcr.io/birckk/deckshelf@sha256:..." > .env
docker compose -f deploy/compose.proxy.yaml pull
docker compose -f deploy/compose.proxy.yaml up -d --wait
```

Example Caddy site (replace the hostname):

```caddyfile
deckshelf.example.com {
    encode zstd gzip
    reverse_proxy deckshelf:4317
}
```

If a CDN proxies the site, do not cache `/api/*` or `/healthz`. Keep registry
credentials in Docker's credential store, never in this repository.

## Offline app

The build writes `sw.js`, a service worker that precaches the app shell and
bundled files under a content hash, plus `manifest.webmanifest`. Serve both
uncached or revalidated (the Node server sends `no-cache` for everything outside
`/assets/`); a long CDN cache on `sw.js` delays updates. `/api/` responses are
never cached by the worker. Viewed card art is cached in the browser from
Scryfall's CDN, which allows cross-origin reads; the server never proxies images.
Offline support needs HTTPS (or `localhost`) and is not used by the desktop app.

## Updates and rollback

Change the pinned digest and run `up -d --wait` again; keep the previous digest to
roll back the same way. Check `/healthz`, the collection and one source import.
Publishing an image never restarts a server: deployments are pulled, not pushed.

## Security notes

The container runs as a non-root user with a read-only filesystem, dropped
capabilities and bounded memory. Upstream imports are concurrency-limited and the
server ignores client-supplied forwarding headers. A busy public instance should
add rate limits at the edge. The health check does not depend on Archidekt, so
the app stays up when the source is unavailable.

When hosting from home, keep the origin address private: proxy every DNS record
that points at it through your CDN (not only the app's subdomain) and only accept
web traffic from the proxy.
