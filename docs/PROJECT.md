# Project work

[GitHub issues](https://github.com/Bircck/DeckShelf/issues) are the backlog and the
source of task status. Use [First-use polish](https://github.com/Bircck/DeckShelf/milestone/1)
for the next product iteration. There is no separate project board to maintain.

## First-use polish

1. [Optional Commander precon demo](https://github.com/Bircck/DeckShelf/issues/1):
   replace the arbitrary default 29 decks with a clearly labeled collection based
   on Archidekt's curated catalog. Easy to remove and restore; preserve existing
   users' saved collections. This is planned work, not the current behavior.
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
