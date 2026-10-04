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

## Already delivered

The hosted web app, public Archidekt source imports, source switches, filtering,
deck picker, collection backup/restore, Docker/Caddy deployment and GitHub checks
are working. The optional Windows installer has lifecycle tests. These are the
baseline, not new backlog items; issues above describe the improvements still due.
