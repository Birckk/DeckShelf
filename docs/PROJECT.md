# Project work

[DeckShelf — Feature releases](https://github.com/users/Bircck/projects/4) is the
release-planning overview. Its items are the real
[GitHub issues](https://github.com/Bircck/DeckShelf/issues), not duplicate tasks.
Use [First-use polish](https://github.com/Bircck/DeckShelf/milestone/1) for the next
product iteration. The repository and project remain private.

## Project structure

- Epics: [First-use polish](https://github.com/Bircck/DeckShelf/issues/10),
  [Everyday collection use](https://github.com/Bircck/DeckShelf/issues/11), and
  [Public-release readiness](https://github.com/Bircck/DeckShelf/issues/12).
- Features/PBIs are child issues describing a useful outcome. Use these as one
  level; a separate PBI layer is unnecessary for this project's size.
- Tasks are smaller sub-issues when a feature needs a breakdown. The precon demo
  has snapshot, migration/UI and verification tasks (#14–#16).
- Investigations capture decisions before committing to implementation.

The board has Status, Priority, Work type, Area, Release, Parent issue and
Sub-issues progress fields. Views cover the release board, first-use work, epics,
public readiness, hierarchy and backlog with areas. The Hierarchy view exposes
real parent/sub-issue relationships and completion progress, not just title prefixes.
`Ready` means available to pick up, not already active.
Use current issue status to choose the next task; the catalog snapshot (#14)
and removable demo (#15) shipped with the October 4 precon release.

### Areas

Area describes the primary part of the product affected, independently of release
or position in the hierarchy:

- Collections: demo/personal collections, saved choices and recovery.
- Data & integrations: catalog snapshots and external deck sources.
- Experience & accessibility: phone use, controls and accessible interactions.
- Offline & sync: PWA behavior and continuity across devices.
- Delivery & operations: packaging, deployment and runtime maintenance.
- Security & release: privacy review, licensing and publication readiness.

Assign one primary area to each item. A task can have a different area from its
parent: the precon demo feature is Collections, while its snapshot task is Data &
integrations. Area values are not automatically inherited. Keep epics as outcomes,
not permanent department buckets; use Area filters to inspect work across epics.
Add further levels only when work actually needs them. Small fixes need not have
an artificial feature and task wrapper.

Existing issues have been imported. GitHub's browser-only Auto-add workflow should
target `Bircck/DeckShelf` with `is:issue,pr`; until enabled, explicitly add new items
to project 4. Do not store a personal Projects token in a repository workflow.

## First-use polish

1. [Optional Commander precon demo](https://github.com/Bircck/DeckShelf/issues/1):
   replace the arbitrary default 29 decks with a clearly labeled collection based
   on Archidekt's curated catalog. Easy to remove and restore; preserve existing
   users' saved collections. See [catalog and migration rules](PRECON_CATALOG.md).
2. [Start a personal collection](https://github.com/Bircck/DeckShelf/issues/2):
   make adding your own public source and switching away from the demo obvious.
3. [Phone usability pass](https://github.com/Bircck/DeckShelf/issues/3):
   inspect the actual workflows and fix concrete problems without a redesign.

## Follow-up work

- [PWA installation and offline use](https://github.com/Bircck/DeckShelf/issues/4).
- [Local saving and backup recovery](https://github.com/Bircck/DeckShelf/issues/5).
- [Cross-device sync decision](https://github.com/Bircck/DeckShelf/issues/6).
- [Moxfield import investigation](https://github.com/Bircck/DeckShelf/issues/7).
- [Desktop branding compatibility](https://github.com/Bircck/DeckShelf/issues/8).
- [Licensing and public download decisions](https://github.com/Bircck/DeckShelf/issues/9).
- [Public-release history, automation and artifact audit](https://github.com/Bircck/DeckShelf/issues/13).

These record remaining work from the repository and product discussions. They
are not a promise to implement every idea. CLI/MCP interfaces and additional
desktop platforms remain unscheduled ideas until there is a concrete use case.

## Working method

- `next`: prioritized for the next iteration; `later`: unscheduled implementation;
  `discovery`: a decision or investigation before implementation.
- Each issue describes the user problem and observable acceptance criteria.
  Keep implementation checklists in the issue rather than duplicating status here.
- Work on one small change at a time. Link commits or pull requests to its issue,
  record relevant checks, and distinguish implemented, tested and deployed work.
- Close a feature issue after its acceptance criteria are met and the change is
  deployed to the relevant delivery target. Close discovery tasks when their
  decision or findings are recorded. Deployment failures keep the task open.
- Capture new feedback as a bug or enhancement and prioritize it against the
  current milestone. Owner requests can change the order at any time.

## Archidekt test collection (2026-10-04)

The owner's existing Archidekt account, `Birckk`, now has a reusable
[DeckShelf Test Collection](https://archidekt.com/folders/1916319) under
[Home](https://archidekt.com/folders/1894739). Use it for realistic collection
testing instead of relying only on a handful of decks. Existing personal folders
were left untouched. These are live fixtures, not the shipped demo catalog.

| Location | Direct decks | Contents |
| --- | ---: | --- |
| [Collection root](https://archidekt.com/folders/1916319) | 1 | `TEST - Calling All Angels - Copy B`, used for rename/move checks |
| [01 - Mono-color](https://archidekt.com/folders/1916320) | 5 | All five Foundations Commander decks, one per color |
| [02 - Multicolor](https://archidekt.com/folders/1916321) | 24 | Strixhaven (5), Final Fantasy (4), Tarkir: Dragonstorm (5), Duskmourn (4), Bloomburrow (4), Multiverse Reforged and Draconic Domination |

Total: **30 decks, representing 29 distinct precons plus one labeled duplicate**.
All deck names start with `TEST -`. Sources were copied from
[Archidekt's curated precon catalog](https://archidekt.com/commander-precons).

Verified in the signed-in Archidekt UI: folder counts, 100-card deck previews,
cloning into nested folders, renaming a copy, and moving that copy to the parent.
The parent count includes only direct decks; all 24 multicolor decks fit on one
page with Next page disabled. This does **not** verify pagination, anonymous/API
access, DeckShelf import behavior, or a deployed DeckShelf change.

Useful future checks for issues #2, #3, #4 and #5 include importing a leaf versus
the parent folder, switching demo/personal collections, color and name filters,
mobile browsing with a larger collection, preserving distinct IDs for duplicate
decklists, refreshing after source renames/moves, and local backup/offline recovery.
Record actual test outcomes in the relevant GitHub issues when these checks run.

Observed Archidekt caveats: selecting a leaf folder in the clone dialog submitted
creation immediately, so an additional Create Deck click produced the labeled
duplicate. Source tags and descriptions were not carried into the inspected
copies. Rapid copying caused rate limiting and folder-tree load failures; pause
and verify existing results before retrying to avoid duplicates.

This handoff is saved locally because GitHub CLI authentication returned HTTP 401
and the browser was signed out of GitHub. It has not been posted to the GitHub
project or issue tracker. No build was needed for this documentation-only update.

## Already delivered

The hosted web app, public Archidekt source imports, source switches, filtering,
deck picker, collection backup/restore, Docker/Caddy deployment and GitHub checks
are working. The optional Windows installer has lifecycle tests. These are the
baseline, not new backlog items; issues above describe the improvements still due.

## Deck detail polish — release tracking (2026-10-04)

[Issue #28](https://github.com/Bircck/DeckShelf/issues/28) and
[PR #29](https://github.com/Bircck/DeckShelf/pull/29) now track this work on
project 4. GitHub authentication works outside the restricted sandbox; the
previous HTTP 401 was sandbox-specific. The isolated release checkout is
`<release checkout>`; unrelated shared-checkout edits
were excluded. PR #29 merged as be6cea38bcc06f7fab982e14e60b64ed323d2f09 and is deployed at https://deckshelf.birckk.com. Issue #28 is closed and project 4 is Done. Release tests: 55 unit tests, seven browser regressions at
1440/390/320px, and build passed. PR CI (including Windows installer) passed; the public-site dialog and Guide checks passed. The issue records image and rollback evidence.

Run `npm run test:dialogs` for shared-dialog and deck-detail changes. Use
Playwright Chromium, or set `PLAYWRIGHT_CHANNEL=msedge` for installed Edge.
The regression suite uses an isolated fixture collection, mocks source refresh
responses and preserves saved-choice behavior. Screenshots: `qa/dialogs/`.


## Collection management handoff (2026-10-04)

The owner accepted the collection-corner prototype as a good starting direction and paused for a fresh session. Continue from [the saved review and handoff](../design-explorations/collection-corner/REVIEW.md), with DESIGN.md as the accepted design constraints. The next step is connecting that interface to the existing collection model and restoring feature parity, not starting another redesign. The prototype remains local, session-only and undeployed; latest checks were 61 tests passing, successful build and desktop/mobile browser verification. Current GitHub issue updates are blocked by HTTP 401, so this handoff is recorded locally. Preserve unrelated concurrent working-tree changes.
## Collection workspace integration — 2026-10-05

Implemented locally in the shared checkout; not committed or deployed. The accepted collection-corner layout now replaces the My collection modal with a separate workspace using the existing saved collection model. Main browsing views, search, filters and gallery preferences remain in App; Back to collection returns focus to its trigger.

- Compact source overview, bounded expandable folder summaries, searchable folding sidebar, aggregate source/folder browsing, and direct-deck folder access.
- Details, full Cards only, Compact and List with size controls. Artwork/caption selection, native keyboard checkboxes, independent picker exclusions, source switches and Only this actions.
- Source-specific deselection preserves overlapping selections. Optional source membership history prevents deselected snapshots from accidentally reappearing as Individual decks. Folder paths and connection identity survive refresh and v1 export/restore; legacy sources remain valid.
- Existing username/folder/deck imports, staged additions, refresh/error/cancel/retry, disconnect with saved snapshots, precon add/remove/restore/catalog and backup preview are retained.

Verified: 64 unit tests; production build; 16 Playwright browser regressions (1440/390/320px, reduced motion and keyboard). Tests cover overlapping sources, search-scoped bulk actions, source switches, persistence, staged additions with retry, refresh failure, disconnect, gallery search return, and importing 30 captured real deck responses with backup restore. Screenshots inspected under qa/collection/.

Live read-only integration verification: public folder 1916319 returned 1 direct deck plus 5 Mono-color and 24 Multicolor decks (30 unique IDs). All 30 upstream deck responses normalized and validated; saved as reproducible test fixtures. Browser import uses those recorded responses, not a claimed live end-to-end browser import. No upstream writes.

Deployment and release isolation remain pending. The checkout also contains earlier branding, dialog and infrastructure edits; no broad staging or commit was made. Automatic following, sharing, other formats and cross-device sync remain separate work.

### Collection workspace feedback — 2026-10-05

Overview now contains source switches and expandable folder summaries only. Deck results and their search/layout controls belong to All saved decks or a selected source/folder. Official Commander precons, Included precons and Individual decks have independent sidebar switches. Removing official precons explains recovery before the action; Restore precons remains available in both the sidebar and Overview, with selections preserved across reload. Workspace header and scope descriptions were reduced, including a compact phone return control.

Verified locally: build, 64 unit tests, the 16 existing browser regressions plus a new overview/sidebar/removal/restore regression. Desktop and mobile screenshots inspected. Not deployed.

### Overview box grid — 2026-10-08

Implemented the requested compact collection box grid using up to three distinct commander artwork previews per collection. Artwork/title open the source; counts, enable controls, Only this, folder expansion and reversible precon removal are preserved. Empty collections show an empty state. Management enable controls now use square check marks, layout choices use underlined tabs and actions use small rectangular buttons. Segmented On/Off controls were considered but are wider for the sidebar. Picker alternatives remain exploratory.

Verified: production build and all 17 browser regressions passed; desktop 1440px and phone 390px rendered screenshots inspected (suite also checks 320px). Local only, not deployed.

### Sidebar alignment and picker TODO — 2026-10-08

Restored original pill switches in management. Sidebar rows now share fixed icon/count/switch columns, with 30px folder rows, reduced nesting gaps, aligned restore-precon controls and a short Direct decks label (full source name remains accessible). Build and all 17 browser regressions passed; desktop/mobile rendered views inspected. Not deployed.

TODO: [Clarify picker controls in saved-deck views #31](https://github.com/Bircck/DeckShelf/issues/31), added to project 4. Review picker inclusion placement across Details/Cards only/Compact/List and distinguish it from display selection. Direction pending; no picker-flow change in this pass.

### Folder pause behavior — 2026-10-08

[Issue #32](https://github.com/Bircck/DeckShelf/issues/32) tracks parent pause/resume, explicit folder bulk actions, optional persisted subfolder pills, partial parent indicators and source-local On display filtering. Implemented locally, not committed or deployed. Previous enabled subsets survive reload and version-1 backup restore; deck selections and picker exclusions remain unchanged by folder pauses. Individual edits supersede remembered enclosing pauses.

Verified 66 unit tests, 19 browser regressions and production build. Rendered folder pills and scope controls inspected at 1440px and 390px; existing layout regressions also cover 320px. Screenshots: qa/collection/folder-pills-* and folder-scope-*. Picker follow-up remains #31.

### October 8 collection baseline

Owner feedback resolved before the main checkpoint: remove redundant per-deck Disable, consolidate deck controls into one compact row, and place the Archidekt link beside selection rather than in a separate footer. The short-lived disabled-deck field migrates into ordinary hidden choices. Collection-level persistent disabling remains independent of temporary pills and removal.

The baseline also includes the collection workspace, remembered navigation/folds, source removal and restoration, shared quick-choice controls, and independent picker motion controls. Browser checks cover 38 cases at desktop and phone sizes. Work is local until explicitly published/deployed; older entries above are historical snapshots.

Next independent review branches: phone workflow polish (#3) and backup recovery (#5). Keep each unmerged until owner review, with test evidence and a local preview. Automatic source following (#23), sharing (#24), PWA/offline (#4), and cross-device sync (#6) remain separate backlog items.
