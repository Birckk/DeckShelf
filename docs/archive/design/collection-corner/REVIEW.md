# Collection corner prototype — October 4

Local exploration for issues #2 and #21; not deployed or connected to saved collection state.

This pass adds a default Overview with collection switches, source navigation independent from folding, compact tree rows with centered SVG chevrons, selected/total counts visible on collapsed sources, aggregate folder totals, and a shorter content header.

birckk-folders.json is a read-only public snapshot retrieved through the local source-folders endpoint. Birckk has 33 Commander decks across five non-root folders: DeckShelf Test Collection (1 direct, 30 including children), Mono-color (5), Multicolor (24), Precons owned (2), and test folder 2 (1). Prototype choices reset on reload. Other sources remain illustrative. Artwork is from the returned public preview, not invented commander assignments.

Folder checkboxes select direct decks; opening a parent displays its descendants. The direct selected/total count is separate from the subtree total.

Verified: Alex and Shared source navigation; Only this collection reduces enabled sources to one and Overview reports 33 shown; nested tree expansion and visible counts; mobile 390px with no horizontal overflow; desktop visual inspection. Repository tests: 61 pass. Production build passes. These checks do not establish production import or persistence behavior.


## Shared views and expandable overview

Cards only now uses verified full commander-card images from the public deck endpoint for all 33 Birckk decks. Compact is a separate square-artwork view without captions. Details keeps artwork and captions. Selection survives view switches.

The main gallery and prototype reuse CollectionLayoutSwitch and its stylesheet, with Compact enabled only in the prototype. Prototype mana now renders the existing Mana component. The main gallery's existing options and stored preferences are preserved.

Overview retains its compact source switches and adds Expand collections with navigable folders and counts. Its scroll area is capped at 110px collapsed and 270px expanded (245px on phones). Verified mobile overflow: 284px content inside 245px visible height. A 30-source dataset has not been separately tested.

Browser checks: desktop/mobile full cards, compact artwork, expanded overview, persistent selection between modes, and navigating to Mono-color from the expanded summary. Main gallery shared controls checked desktop/mobile and restored to Cards only. 61 tests passed; build passed.

GitHub issue sync was attempted but authentication returned HTTP 401. This is local prototype progress, not deployed or recorded remotely.


## Click-to-select and remaining parity

Deck artwork, captions and unused tile area now toggle the existing checkbox. Direct checkbox/label clicks are excluded from the delegated handler to avoid double toggles. Native keyboard checkbox interaction remains. Overview expansion defaults to false; keep the compact summaries.

Verified image toggling in Details, Cards only, Compact and List; title and direct checkbox clicks toggle once; mobile artwork tap; collapsed initial overview. 61 repository tests and build passed.

Remaining parity with CollectionManager: persistent saved collection state and gallery/picker integration; real username/folder/deck import and staged additions (including Show only these folders); refresh and new-deck review; disconnect while preserving snapshots; request progress/cancel/error/retry states; precon add/remove/restore/catalog browsing and legacy starter handling; backups and restore preview; All saved decks and detached snapshots; on-display/hidden/not-added filters; search-scoped Select all/Deselect all; independent picker exclusions; source/deck outbound links. Reuse existing collection functions/components for integration instead of reproducing state rules in this prototype. The prototype still uses illustrative sources and live-derived static fixtures, with session-only choices.


## Session handoff — 2026-10-04

Owner is wrapping up this chat and wants to continue in a fresh session. They like the overall collection-management direction and consider it a good start. Do not restart the design exploration or treat the prototype as shipped.

Accepted presentation: a separate management corner; compact sidebar with independently folding sources/folders and visible selected/total counts; source names open their decks; Overview exposes source enable switches and an optional bounded folder summary, collapsed by default. Details uses consistent artwork crops with captions and a checkbox at the far right of the title area, never to its left. Excluded decks dim. Mana appears top-right. Cards only means full card faces. Compact means square artwork without captions. Clicking the image, caption or unused tile area toggles selection. Keep copy short and reuse the main site's components and icons. Preserve the main Collection/Cards/picker/search/Guide/About experience.

Start next session by reading DESIGN.md, docs/PROJECT.md and this review, then inspect the current working tree. Prototype entry (moved 2026-10-12): docs/archive/design/collection-corner/index.html (app.js, shared.tsx, static Birckk fixtures). Last local URL: http://127.0.0.1:4319/docs/archive/design/collection-corner/index.html; the dev server may need restarting. Screenshot: desktop.png. Prototype selections reset on reload and do not affect real saved collections.

Recommended next work: integrate this accepted layout with the existing CollectionManager/SourceSetup/collection.ts model, preserving the parity list above. Existing local folder-discovery implementation is in server/sources.mjs, server/api.mjs, src/SourceSetup.tsx and src/CollectionManager.tsx, with tests/folder-discovery.test.mjs. Shared layout controls are in src/CollectionLayoutSwitch.tsx and src/collection-layout-switch.css; shared Mana is in src/components.tsx. Reuse those rather than carrying the prototype's example state into production.

Latest verification was 61 passing repository tests, successful npm run build, and manual desktop/mobile checks. No deployment or commit was made for this handoff. The working tree contains multiple unrelated concurrent changes (including branding, Guide/About and test infrastructure); do not broadly revert, stage or commit them as collection work. GitHub tracking is blocked by CLI authentication (HTTP 401); save local progress until authentication is restored. Closing this chat does not require further work here.
