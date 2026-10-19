# Decisions

Each line is one product or technical decision: the date, what was decided and why. A linked issue has the full discussion. "Archive PR N" refers to the private history repository, so those links won't open publicly. Interface details are in [DESIGN.md](DESIGN.md).

## Scope and sources

- 2026-10-04 · Archidekt is the deck source. DeckShelf reads public accounts, folders and decks, never asks for a login, and leaves deck editing to Archidekt. #2, #21
- 2026-10-04 · A complete bundled snapshot of Archidekt's Commander precon catalog replaces the old 29-deck starter set. First visits then work without upstream requests, and existing profiles never grow on their own. See [PRECON_CATALOG.md](PRECON_CATALOG.md). #1, #14
- 2026-10-04 · Users see "Official Commander precons", never "demo". The old storage keys stay so saved data still loads. #20
- 2026-10-15 · Official Commander precons is the only precon collection. Its Refresh adds precons Archidekt has listed since the snapshot. Archive PR 65.
- 2026-10-18 · Other formats are supported. A deck with no format counts as Commander. Discovery starts at Commander and widens only when asked. The cover is Archidekt's featured card, with no local cover editor. A pick never mixes formats. #22
- 2026-10-18 · Moxfield is not supported. It has no public API, and we won't work around its bot protection. A private User-Agent approval can't stay secret in open-source or desktop code, and pasted copies go stale. Revisit if a public API appears or about five people ask after release. #7
- 2026-10-18 · Tags aren't borrowed from matching precons. Archidekt drops tags when a deck is copied, and DeckShelf shows that as it is. #95
- 2026-10-16 · Agents get a local, read-only MCP server (stdio) that reuses the importer and the picker's rules. Its SDK is a dev dependency and never ships in the app. A remote endpoint and a Windows-app bridge are separate decisions for later. #73

## Collections and data

- 2026-10-04 · Collections stay in the browser or the desktop profile. There are no accounts and no server-side storage. #11
- 2026-10-04 · My collection is a separate workspace for managing collections. The gallery, Cards and the picker stay the main views. #2
- 2026-10-17 · Backups stay in version-1 JSON and hold the collection only, not display preferences. A corrupt save stays locked until a valid backup is restored. #5
- 2026-10-18 · Settings that shape the collection (card back, List columns) are saved with it, so backups carry them. #61, #92
- 2026-10-18 · No cross-device sync for now. Easier backup transfer comes first, and there will be no DeckShelf-run sync service without a budget. #6
- 2026-10-15 · Each collection has three controls: the pill (quick on/off), Hide (out of sight, can be restored) and Remove (gone; imported sources only). Precons can only be hidden. #56
- 2026-10-18 · Remove acts at once and offers Undo. Toggles and Hide stay silent. There's no edit history or refresh log. Notices use Sonner. #57
- 2026-10-18 · Folders added whole get their new Archidekt decks automatically, checked at most once a day when DeckShelf opens. Hand-picked folders stay fixed. Decks removed upstream are kept and flagged. Settings has one off switch. #23
- 2026-10-18 · Added decks appear at once from the folder listing, and their details fill in from Archidekt in the background, two at a time to stay clear of rate limits. #102
- 2026-10-18 · Adding decks to a collection that is off never switches it on by itself. The notice offers Turn on. #94
- 2026-10-18 · Share links `/u/{user}` and `/f/{folder}` open a read-only shelf. Saving one to your collection is a separate, add-only step. Kept and recent shelves aren't part of backups. #24
- 2026-10-14 · The desktop origin `archive://app` and the `commander-archive.*` storage keys keep their old names, because renaming them would hide saved collections. Archive PR 49.

## Picking

- 2026-10-12 · The picker chooses the deck before any animation, using crypto randomness with rejection sampling, so every eligible deck has equal odds. A fewer-repeats mode isn't planned. #42
- 2026-10-08 · There are no saved picker exclusions. Every shown deck that matches the filters is eligible, and Choose a few makes a temporary shortlist. #31
- 2026-10-16 · A pick can choose up to four decks, labelled Player 1–4, with one spin that stops on each. #34
- 2026-10-18 · Shuffle-and-deal is a picker setting beside the helix, with the same draw. Fan and table result layouts were dropped. #76, #78

## Design and interface

- 2026-10-04 · The brand mark is the familiar dragon holding a card, picked over shelf and deckbox concepts. The exploration is kept in `docs/archive/logo-discovery-2026-10-04/`. #25
- 2026-10-15 · An in-app Help workspace replaces Guide and About. Help explains the rules the interface can't show, not its buttons. #52
- 2026-10-18 · First visits get a one-time "New?" offer. The guide still never opens by itself. #54
- 2026-10-18 · One layout system: gutters, widths and the six breakpoints come from `src/layout.css`, and tests enforce them. #45

## Desktop and distribution

- 2026-10-12 · The Windows app ships as DeckShelf (formerly Commander Archive) and copies an existing Commander Archive profile on first start. #8
- 2026-10-12 · Public Windows downloads go on GitHub Releases, clearly marked unsigned. Signing, auto-updates and other platforms each need their own scope and cost decision. #9
- 2026-10-15 · The Windows app has a slim window bar with a menu of DeckShelf actions only. The exe shows the brand icon without being signed. #69, #67
- 2026-10-18 · The site never shows an install banner. Desktop browsers get no manifest because the Windows app covers desktop, and phones install from the browser menu. #4

## Hosting, privacy and security

- 2026-10-15 · Offline use: the service worker precaches the app shell, never caches `/api/` and never reloads by itself. Card art loads from Scryfall's CDN, which allows it to be cached. The server never proxies images, per Scryfall's terms. #4
- 2026-10-12 · Deployments are pulled, not pushed, and CI holds no server credentials. The server builds the merged commit until the container image is public, then pins a CI-built image by digest. #12
- 2026-10-12 · The hosted site sits behind a CDN with every DNS record proxied, so the origin address stays private. Server runbooks live outside this repository.
- 2026-10-12 · The container runs on Node 24 LTS, and Dependabot skips major Node versions. Running from source needs Node 22.12+. Archive PR 40.

## Licensing and credits

- 2026-10-12 · The original code is MIT licensed. Card art and mana symbols stay in the app and in downloads under the Wizards Fan Content Policy, with its required notice. DeckShelf stays free and uses no Wizards logos. #9
- 2026-10-18 · GameShelf is credited as the inspiration. Archive PR 117.

## Project and repository

- 2026-10-12 · 1.0 includes the desktop rename, auto-added folder decks, share links and multi-player picks. Backup clarity followed after them. #12
- 2026-10-13 · CI runs on demand to stay within free Actions minutes. Artifacts are kept briefly and Dependabot runs monthly. Archive PR 50.
- 2026-10-19 · DeckShelf goes public as a new repository with its full history recreated: the noreply email on every commit and deployment notes removed. Issues keep their numbers. PRs, Actions logs and deployment details stay in the private archive; issues whose threads held such details were recreated as short summaries. This replaces the single-commit plan from 2026-10-12. #122, #36
