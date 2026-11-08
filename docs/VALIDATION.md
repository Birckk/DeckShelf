# Validation

What is checked before a DeckShelf build is released, and what is not.

## Automated (CI)

Every pull request gets the default `ci.yml` run (see
[DEVELOPMENT.md](DEVELOPMENT.md#cicd)), which covers the first column. A full run,
started by hand, adds the second, and `desktop.yml` tests the Windows package.

| Check | Default run | Full run |
| --- | --- | --- |
| Unit tests and production build | Ubuntu, Node 22 | Windows, macOS on Node 22; Ubuntu on Node 24 |
| Browser regressions: dialogs, collection workspace, saved choices, backups, keyboard, reduced motion at 1440/390/320px | Chromium | Firefox, WebKit |
| Production container: health and routing, desktop/phone smoke tests, guide, precon demo | Hardened Docker container (read-only, no capabilities, 256 MB) | |
| Windows package: ZIP smoke test (startup, artwork, sandbox, API routing, backup restore/export, relaunch, offline reload) and installer upgrade from Commander Archive (collection kept), install/reinstall/uninstall | `desktop.yml` | Disposable Windows runner |
| Production dependency audit | npm advisory database | |

Release tags rerun the Windows checks, publish a versioned container image and
create a **draft** GitHub release for review. Nothing is published automatically.

## Per release (manual)

Record the results in the release's GitHub issue or pull request:

- Install the Windows build on a clean account or VM and open it once.
- Open the hosted site at desktop and phone sizes; import one public Archidekt
  source; pick a deck.
- Restore a backup from the previous release.

## Known limits

- Windows builds are unsigned x64 release candidates; SmartScreen will warn.
  No auto-updater. Windows 11, ARM64, macOS and Linux desktop builds are untested
  or not produced.
- Artwork for imported decks loads from Archidekt; offline use covers the bundled
  demo and cached images only.
- Source imports depend on Archidekt's public endpoints, which may change.
- Physical phones are covered by viewport emulation, not device testing.

Earlier dated validation logs are kept in the repository history.
