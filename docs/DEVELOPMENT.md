# Development

Requires Node.js 22.12+. Read [DESIGN.md](DESIGN.md) before changing the interface.

```sh
npm ci
npm run dev        # http://127.0.0.1:4317 with the Archidekt adapter
npm test           # unit tests
npm run test:dialogs   # Playwright browser regressions (starts its own server)
npm run build      # type-check and production build
npm start          # serve dist/ with the production server
```

On Windows, `scripts/start-windows.cmd` installs dependencies on first run,
rebuilds and starts the production server.

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

GitHub checks are manual for now to stay within the free Actions minutes. Before
merging, run the checks locally:

```sh
npm test
npm run build
npx playwright test --browser=chromium
```

Run `.github/workflows/ci.yml` from the Actions tab when a change needs more. By
default it runs on Linux; tick **full** for the bracketed platforms (Windows runners
bill 2x, macOS 10x):

- **unit**: tests and build on Ubuntu, Node 22 [plus Windows, macOS and Node 24].
- **browsers**: Playwright regressions in Chromium [plus Firefox and WebKit].
- **container**: builds `deploy/Dockerfile`, runs it hardened and smoke-tests it.
- **publish-image**: pushes `ghcr.io/bircck/deckshelf:sha-<commit>` and `:main` with
  provenance and SBOM after a green `main` push. Dormant while push triggers are off.

`desktop.yml` packages the Windows app, smoke-tests it and runs the installer
lifecycle, including the upgrade from Commander Archive. Run it manually; its
`windows-candidate` artifact (about 256 MB) is kept for 3 days.

To check every change on GitHub again, restore the commented `push` and
`pull_request` triggers in `ci.yml` (and `desktop.yml` for desktop packaging).

`release.yml` handles `vX.Y.Z` tags (see [RELEASING.md](RELEASING.md)).
`codeql.yml` runs code scanning once the repository is public. Dependabot
proposes monthly npm, Actions and Docker base-image updates.

Deployment is pull-based: servers pin an image digest and update themselves.
CI holds no server credentials and never connects to a host.
