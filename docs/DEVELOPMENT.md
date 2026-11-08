# Development

Requires Node.js 22.18+. Read [DESIGN.md](DESIGN.md) before changing the interface.

```sh
npm ci
npm run dev        # http://127.0.0.1:4317 with the Archidekt adapter
npm test           # unit tests
npm run check      # Oxlint with type-aware rules (Vite+)
npm run test:dialogs   # Playwright browser regressions (starts its own server)
npm run build      # type-check and production build
npm start          # serve dist/ with the production server
```

On Windows, `scripts/start-windows.cmd` installs dependencies on first run,
rebuilds and starts the production server.

To update Vite+, run the version you want through its migrator. It moves `vite-plus` and
the `vite` alias together, so Dependabot leaves both alone. Skip the extras it would add:

```sh
npx --package=vite-plus@<version> vp migrate --no-interactive --no-agent --no-editor --no-hooks
```

## Repository layout

| Folder | Contents |
| --- | --- |
| `src/`, `public/`, `index.html` | The React web app and its static assets |
| `server/` | Production server and the read-only Archidekt adapter |
| `desktop/` | Optional Electron app, `electron-builder.yml` and installer script |
| `deploy/` | Dockerfile and Compose files |
| `scripts/` | Packaging, smoke tests, screenshots, catalog updates, Windows launcher |
| `tests/` | Unit tests, Playwright regressions (`tests/browser`) and recorded fixtures |
| `docs/` | Guides, backlog workflow, design direction, notices and archived explorations |

Generated output (`dist/`, `build/`, `release/`, `qa/`, `test-results/`) is ignored.

## How sources work

Archidekt's public endpoints are fetched through a small server adapter
(`server/api.mjs`, `server/sources.mjs`) because browsers cannot call them
directly. Each deck is reduced to display metadata and its commanders; full
decklists are never stored. Deck metadata has a bounded one-hour in-memory cache,
bypassed on explicit refresh; source listings are always fetched fresh. Upstream
errors leave the saved collection usable. The desktop app runs the same adapter in
its main process. See Archidekt's [API discussion](https://archidekt.com/forum/thread/21858972)
for the public/private distinction.

## Agent access (MCP)

`server/mcp.mjs` is a local, read-only [MCP](https://modelcontextprotocol.io) server
over stdio. It reuses the source adapter and the app's filter and picker rules, so
an agent such as Claude can list a public Archidekt library and pick a deck with the
same odds as the app. It never sees or changes a saved DeckShelf collection.

| Tool | Input | Returns |
| --- | --- | --- |
| `find_collection` | username, profile/folder/deck link, or `precons`; optional `format`, `includeSubfolders` | source name and each deck's id, name, format, commander and colours; unavailable decks with reasons |
| `pick_deck` | source, optional `format`, `includeSubfolders`, `colors`, `exact`, `colorless`, `query`, `count` (1–4) | the picks with Archidekt links and how many decks were eligible; unavailable decks with reasons |
| `deck_details` | deck link or ID | format, commanders and artists, set, tags, description and card count |

Collections are Commander decks unless `format` names another Archidekt format ("Modern",
"Pauper", "1v1 Commander" …) or "all"; a single deck link accepts any format unless one is
given. The listing names each deck's format, so decks in other formats are never fetched,
and an unknown format is rejected before any request.

A folder link reads only its direct decks by default. Set `includeSubfolders: true`
to include descendants explicitly (on either collection tool); when subfolders are
left out, the result's `note` says how many so the agent can offer them. This option has no
effect on usernames, deck links or precons. An unknown username is an error
("Archidekt has no user named …"); an account without public Commander decks returns
no decks and a `note`. Links pasted without `https://` are accepted. Picks are distinct; if fewer decks are
eligible than `count`, every eligible deck is returned once. An empty pick pool is
a tool error containing `error`, `total` (successfully loaded decks) and `unavailable`
with each failed deck's reason, in both structured content and JSON text. If all
deck loads fail, the error says so instead of claiming the filters matched nothing.

Decks are cached on disk in `%LOCALAPPDATA%\DeckShelf\mcp-cache.json` (`~/.cache/DeckShelf/mcp-cache.json` elsewhere;
set `DECKSHELF_MCP_CACHE` to move it), so a new agent session reads only the library
listing and the decks edited since they were cached. Archidekt's listing gives each
deck's `updatedAt`; decks read without a listing (a single link or `deck_details`)
are trusted for an hour. A deck that cannot be read (no commander, deleted, private) is
remembered the same way, until its listing shows an edit; outages, 429s and timeouts are
not. A damaged cache is ignored and rewritten. Bump `VERSION` in
`server/deck-cache.mjs` when `normalizeDeck`'s output changes shape.

The first load of a large library is the slow part: decks are read two at a time, and
Archidekt answers 429 (no `Retry-After`) after roughly 50 quick requests. The server
then pauses (5 s, doubling to 30 s) and retries, waiting at most a minute per call;
whatever is left is listed as unavailable with a `note` to ask again, and the next call
continues from the cache. Claude Code allows stdio tool calls 30 minutes of idle time;
Claude Desktop's limit is unverified, and a timed-out first load still keeps what it read.
Cancellation propagates through source discovery and active deck requests and
stops subsequent batches, even when the client did not request progress.

Timeouts belong to the client. The installed TypeScript SDK defaults to 60 seconds;
requesting progress alone does not extend that deadline. SDK clients can pass
`onprogress` and `resetTimeoutOnProgress: true` to `client.callTool`'s third argument,
plus a suitable `timeout` and optionally `maxTotalTimeout`. Mocked SDK regressions
cover the default timeout, progress with and without extension, and a total limit;
they simulate a library taking over five minutes without calling Archidekt.
These checks do not establish Claude Code or Claude Desktop's timeout policy.
Before claiming support for large libraries in either app, verify its timeout and
cancellation behavior with mocked slow responses; do not assume progress extends
its deadline. A server cannot change the client's timeout settings.

Run `npm ci` first (the SDK is a dev dependency), then register it with an absolute
path. Call `node` directly: `npm run mcp` prints a banner on stdout, which breaks
the protocol, so use `npm run -s mcp` when starting it by hand.

Claude Code:

```sh
claude mcp add --scope user deckshelf -- node C:\path\to\deckshelf\server\mcp.mjs
```

Claude Desktop: add this to `%APPDATA%\Claude\claude_desktop_config.json` and restart it.

```json
{
  "mcpServers": {
    "deckshelf": {
      "command": "node",
      "args": ["C:\\path\\to\\deckshelf\\server\\mcp.mjs"]
    }
  }
}
```

## Data

- `src/data/precons.json`: the precon demo snapshot. Update with
  `npm run catalog:update`; see [PRECON_CATALOG.md](PRECON_CATALOG.md).
- `src/data/decks.json` and `public/images/`: the original 29-deck starter list
  with bundled artwork. `python scripts/seed.py path/to/Commander.xlsx` rebuilds it
  from the reference workbook (optional; standard library only).

## Screenshots

With the dev server running, `npm run screenshots` regenerates
`docs/images/` from a fresh profile, so only the public precon demo appears.

## CI/CD

Changes are checked locally before merging:

```sh
npm test
npm run build
npx playwright test --browser=chromium
```

The slow checks run once per release: a `vX.Y.Z` tag runs `release.yml`, which
tests the Windows app and the browser suite in Chromium, Firefox and WebKit before it
builds anything (see [RELEASING.md](RELEASING.md)). Nothing else needs to run in
between.

`.github/workflows/ci.yml` stays available from the Actions tab for a one-off check.
By default it runs on Linux; tick **full** for the bracketed platforms (Windows
runners bill 2x, macOS 10x):

- **unit**: tests and build on Ubuntu, Node 22 [plus Windows, macOS and Node 24].
- **browsers**: Playwright regressions in Chromium [plus Firefox and WebKit].
- **container**: builds `deploy/Dockerfile`, runs it hardened and smoke-tests it.
- **publish-image**: pushes `ghcr.io/birckk/deckshelf:sha-<commit>` and `:main` with
  provenance and SBOM after a green `main` push. Dormant while push triggers are off.

`desktop.yml` packages the Windows app, smoke-tests it and runs the installer
lifecycle, including the upgrade from Commander Archive. Run it by hand after
changing desktop packaging; its `windows-candidate` artifact (about 256 MB) is kept
for 3 days.
`codeql.yml` runs code scanning once the repository is public. Dependabot
proposes monthly npm, Actions and Docker base-image updates.

Deployment is pull-based: servers pin an image digest and update themselves.
CI holds no server credentials and never connects to a host.
