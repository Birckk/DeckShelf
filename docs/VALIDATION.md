# Validation

What is checked before a DeckShelf build is released, and what is not.

## Automated (CI)

Every change is checked locally before merging: unit tests, the production build and
the browser suite in Chromium (see [DEVELOPMENT.md](DEVELOPMENT.md#cicd)). The slow
checks run once per release, when a `vX.Y.Z` tag starts `release.yml`:

| Check | Every change (local) | Every release (`release.yml`) |
| --- | --- | --- |
| Unit tests and production build | Yes | Windows, Node 22 |
| Production dependency audit | | npm advisory database |
| Browser regressions: dialogs, collection workspace, saved choices, backups, keyboard, reduced motion at 1440/390/320px | Chromium | Chromium, Firefox, WebKit on Linux |
| Windows package: ZIP smoke test (startup, artwork, sandbox, API routing, backup restore/export, relaunch, offline reload) and install/reinstall/uninstall | | Disposable Windows runner |

Only after all of these pass does the release workflow publish a versioned container
image and create a **draft** GitHub release for review. Nothing is published
automatically. Run by hand when relevant: `desktop.yml` for the upgrade from
Commander Archive (collection kept), and `ci.yml` for the hardened production
container (read-only, no capabilities, 256 MB), macOS and Node 24.

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
