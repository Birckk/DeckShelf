# Hosting DeckShelf

The production container serves the React build and the read-only Archidekt
adapter together. There is no server database or user account. Each visitor's
collection remains in their browser; export a backup before changing browsers
or domains. PWA installation/offline caching is a separate, upcoming step.

## Local Docker check

```sh
docker compose up -d --build
curl --fail http://127.0.0.1:4317/healthz
```

The local Compose file binds only loopback. If the existing development server
uses port 4317, stop it first or use a different host port for your test container.

## Server

Use `compose.proxy.yaml` on the existing external Docker network `proxy`.
It publishes no host ports. Set `DECKSHELF_IMAGE` in a local `.env` file to the
verified image digest, for example `ghcr.io/bircck/deckshelf@sha256:...`.
If the package is private, the server needs a GitHub credential with read:packages.
Keep it in the Docker credential store; never put a token in this repository.

```sh
docker compose -f compose.proxy.yaml pull
docker compose -f compose.proxy.yaml up -d --wait
```

Add this public site to the existing Caddy configuration:

```caddyfile
deckshelf.birckk.com {
    encode zstd gzip
    reverse_proxy deckshelf:4317
}
```

This site uses Caddy's normal HTTPS certificate validation over ports 80/443.
It does not need a DNS API token.
Point the hostname at your server with an A/AAAA record or a CNAME. Start DNS-only while validating HTTPS.
After HTTPS works, Cloudflare proxying is optional; use Full (strict) SSL mode
and do not cache `/api/*` or `/healthz` responses.

Validate the Caddy configuration before applying it. If your server mounts a
single Caddyfile, preserve its inode when updating it, then validate and reload.
Keep a backup outside the checkout. Avoid restarting unrelated containers.

## Checks and updates

GitHub Check runs unit/build checks on Linux and Windows, tests the Windows
package/installer, and smoke-tests the production container in Chromium at
desktop and phone sizes. Only successful main builds publish an image tagged
`sha-COMMIT` to `ghcr.io/bircck/deckshelf`. Pin deployments by digest.

Update the server's image pin and run Compose with `up -d --wait`. Check
`https://deckshelf.birckk.com/healthz`, the collection and a public source import.
Keep the previous digest to roll back using the same command. Image publication
does not automatically restart the server.

The container runs as a non-root user with a read-only filesystem, dropped
capabilities and bounded memory. Upstream imports have a concurrency limit;
the server doesn't trust client-provided forwarding headers. A public service
with substantially more traffic should add edge rate limits.

Health checks confirm the app server is running; they deliberately do not depend
on Archidekt being online. Collection browsing still works when a source fails.
