# Commander Archive

A local browser showcase for one person's Commander collection. A black Card Studio with full commander cards, a compact collection grid, and a continuously moving double helix that picks the next deck to play.

The picker repeats eligible decks to keep the spiral full even with one or two matches. Each strand cycles through decks in order before repeating. Card spacing stays consistent as the pool grows: extra decks extend the loop beyond the viewport instead of crowding the visible spiral. Repeated cards are visual only; every eligible deck keeps an equal chance of being picked.

The background stays steady while browsing all three views. Artwork and mana-colored light appear only when a winner is revealed. The picker opens centered, varies its spin distance and duration, then reveals the winner with a brief halo and subdued surroundings. Gentle card tilt, filter transitions, and reveals respect reduced-motion preferences.

Collection display controls offer Details, Cards only, and List layouts, with small, medium, and large sizes. Large is the default. Layout and size are remembered in this browser.

## Run locally

For interface changes, follow the project's [design direction](DESIGN.md). [AGENTS.md](AGENTS.md) points coding agents to the same guidance.

Requires **Node.js 22.12+** (or a newer supported LTS).

On Windows, double-click **Start Commander Archive.cmd**, then open **http://127.0.0.1:4317**. The first run installs dependencies. The launcher checks the Node version and rebuilds each time so source updates are included. Leave the terminal open while using it.

Or use a terminal in this directory:
```sh
npm ci

npm run dev
```

The development server runs at http://127.0.0.1:4317. To run the production build:
```sh
npm run build

npm start
```

## Using the collection

- **Collection / Cards / Pick a deck:** three views of the same filtered collection. Cards opens a horizontal carousel of original commander card images; drag, click neighboring cards, or use the arrow buttons. Keyboard arrows, Home, and End work within the carousel. Click the centered card for deck details.

- Search deck names, commanders, source descriptions, sets, and themes.

- Color buttons normally require **every** selected color, including decks with extra colors. **Exact colors** requires exactly the selected combination. With no colors selected, all colors are allowed.

- Combine colors with release, theme, and color-count filters.

- The **In picker / Excluded** control beneath each grid card excludes or includes it in the picker. Excluded decks remain visible in the collection and carousel. Search and mana colors are in the top toolbar; **Filters** drops down release, theme, color-count, and colorless options; results update immediately. Selecting all five colors only matches five-color decks.

- **Pick a deck** opens two continuously corkscrewing strands of commander artwork. Cards travel through different heights and depths, with distant cards dimmed and blurred. Drag horizontally to turn the scene or vertically to move along the strands, then release for momentum. Pause freezes the scene; selecting a card opens its source information. Drag inside the spiral to turn it; scroll outside the spiral to move the page.

- Picking gives every eligible deck an equal chance. The strands accelerate, then settle with the selected deck at the front before revealing its full commander card. The pool cannot change mid-spin. Small filtered collections repeat visually along the strands; the repetitions do not affect the odds. **Reduce motion** stops ambient movement and skips the spin/reveal animations; the system's reduced-motion setting is respected by default.

- Open a deck to see its commanders, source description, colors, and themes, then follow its Archidekt link for the full decklist. **Refresh from Archidekt** fetches a fresh snapshot without changing your inclusion/exclusion choices; source failures keep the saved deck.

- **My collection** manages the showcase: link one or more public Archidekt accounts or folders, or add individual deck links. Use the separate Display and Picker checkboxes to choose what appears and what can be picked. Search and bulk display controls apply to the current list.

- Export a backup before moving computers, switching browsers, clearing browser data, or changing the server origin/port. **Restore backup replaces the current collection selection.**

## Data and offline behavior

The 29 supplied precons are included in `src/data/decks.json`, with local commander artwork in `public/images`. The starter collection, filtering and picker work without external internet access while the local server is running. Fonts are bundled locally too.

Display choices, linked public sources, and imported deck snapshots are stored in this browser's `localStorage`. They are specific to the browser and URL origin. This is one collection for one user; linking multiple sources does not create shared ownership or an app login.

Adding or refreshing a source requires internet access and the local Node server. Added or refreshed artwork is loaded from Archidekt; offline availability of that artwork depends on the browser cache. Refresh is manual, not a background account sync. Moxfield links are retained as references for the supplied collection; live Moxfield import is not implemented.

### Linking sources

1. Open **My collection → Add decks**. Enter an Archidekt username, public profile URL (`/u/name`), folder URL (`/folders/123`), or individual deck URL (`/decks/123`). Links are detected automatically.
2. An account or folder appears in the source sidebar. Select the decks you own, then choose **Add selected decks**. Source listings are previews; full commander metadata loads for selected decks only. An individual deck link is added directly.
3. **Refresh source** discovers new decks and updates already-saved decks from that source. New decks wait for review; local visibility and picker exclusions stay unchanged. Failed imports are listed individually, and previous snapshots are retained. Decks no longer listed remain available with a saved-copy notice.
4. **Disconnect** removes the connection and keeps all saved decks and display choices. Decks without another linked source are listed under Individual decks (or Starter precons for bundled decks).

Connections are read-only and require no password. Only public Commander decks can be discovered. Folders include their direct decks; link subfolders separately. Accounts include public Commander decks across folders. The importer supports up to 50 sources, 1,000 decks per source and 1,000 imported snapshots. Sources larger than the limit fail explicitly rather than silently showing an incomplete collection.

Backups include source connections, saved source listings, deck snapshots and display/picker choices. Existing version-1 backups remain supported. Restore shows a confirmation before replacing the local collection. The app never writes to Archidekt or stores full decklists.

The initial metadata comes from the reference workbook's 29 requested entries (deck names, themes and sets) and the curated `Archidekt_Precons` catalog. No colleague names, ownership information, ratings, or game results are included. `World Shapers` and `The Fatastic Four` were matched to their source names, `World Shaper` and `The Fantastic Four`.

Archidekt's public endpoints are fetched through a small server adapter to avoid browser CORS restrictions. Each fetched deck is reduced to display metadata and its commanders; the app does not retain the full deck's cards. Upstream errors leave the existing local collection usable. Deck metadata uses a bounded one-hour in-memory cache, bypassed on explicit refresh; source listings are fetched fresh. The adapters are isolated in `server/api.mjs` and `server/sources.mjs` because these public endpoints may change. Account and folder behavior was checked against Archidekt on September 29, 2026. Archidekt explains the public/private distinction in its [API discussion](https://archidekt.com/forum/thread/21858972) and folder visibility in its [folder announcement](https://archidekt.com/news/4116486).

For refreshing the bundled starter data from the original reference workbook (optional, not required to run):
```sh
python scripts/seed.py /path/to/Commander.xlsx

npm run build
```

The script uses Python's standard library, matches the curated precon catalog, and downloads commander artwork. It never modifies the workbook. Temporary download caches are ignored by Git.

## Hosting later

Nothing is published automatically. The same production app can be hosted with Node:
```sh
npm ci

npm run build
```

Set the host's `HOST=0.0.0.0` and `PORT`, then run `npm start`. Place it behind the hosting provider's HTTPS endpoint. `HOST` defaults to `127.0.0.1` for local use. Each visitor still gets their own browser-local collection.

The `dist` folder can also be served statically for browsing the bundled collection, filtering, the picker, and backup/restore. **Adding or refreshing Archidekt decks requires the Node API adapter.** `npm run preview` is a static preview and has that same limitation.

## Checks
```sh
npm test

npm run build
```

The tests cover starter-data completeness, image files, color semantics, filter composition, random-choice boundaries and bias rejection, collection backup validation, partner commanders, Archidekt rich-text normalization, and helix landing/wrapping/acceleration invariants.

## Credits

Deck data and source descriptions: [Archidekt precon catalog](https://archidekt.com/commander-precons), with the supplied workbook and original reference links. Artwork attribution is shown on each deck. Magic: The Gathering, card names, and artwork belong to their respective owners. This is an unofficial fan project.

The [double-helix gallery](https://github.com/githyperplexed/double-helix-gallery) inspired the use of spatial card presentation. This app's layout and animation code were independently implemented.

Mana symbols are bundled SVGs from [Scryfall’s symbology API](https://scryfall.com/docs/api/card-symbols). Fonts (Outfit and DM Sans) are bundled through Fontsource for local use.
