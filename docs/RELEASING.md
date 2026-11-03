# Building and distributing DeckShelf

## Architecture

The React/Vite frontend is shared by the browser and Electron application. Desktop
uses a sandboxed renderer with no Node integration or preload bridge. A secure
`archive://app` protocol serves packaged assets and adapts the existing read-only
Archidekt API handlers in the main process. No HTTP server, free port or installed
Node runtime is needed. External HTTPS links open in the system browser. Other
external protocols and renderer permission requests are denied.

Keep `dk.bircck.deckshelf`, the `DeckShelf` profile directory, and `archive://app`
stable across releases. 1.0 renamed the app from Commander Archive
(`dk.bircck.commanderarchive`): `desktop/installer.nsh` removes that installation,
`desktop/profile.mjs` copies its profile on first start, and the unchanged origin
keeps the copied collection readable. `desktop.yml` installs the last Commander Archive
build first to test this upgrade. Do not put a version or extraction path in
the storage identity. Never test with the owner's live browser origin/profile.

A hosted version still does most work in the user's browser, with no server-side
collection database. Account/folder/deck discovery currently requires the Node
adapter because the upstream API cannot be assumed to permit browser CORS. Static
hosting alone supports the bundled collection and backups, not live imports.
Browser caching/PWA installation and cross-device synchronization are separate
future work. Archidekt reconstructs public deck sources, not local app preferences.

## Local build (Windows x64)

Use Node 22.18+ and the committed npm lockfile. The package command explicitly
installs the pinned Electron runtime (current Electron no longer uses an npm
postinstall hook):

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run package:windows
npm.cmd run test:desktop
```

The setup executable, optional ZIP and companion files land in `release/`.
Build intermediates stay in ignored `build/windows/`, including `win-unpacked/`.
Electron and packaging tooling are pinned; the bundled runtime
must be maintained for security updates. The application ZIP excludes source,
tests, concept images, caches, private environment files and development tooling.
`scripts/package.py` is an optional developer source archive, not the end-user app.

The desktop smoke script extracts the actual ZIP into a temporary folder, uses an
isolated temporary profile, and exercises the packaged executable with Playwright.
It does not launch the app with the user's profile or touch port 4317. Test screenshots
go to `qa/`; temporary test files remain on failure for diagnosis. The release ZIP
is not a USB-portable profile: data belongs to the Windows user, not the ZIP folder.

## CI and release workflow

`ci.yml` and `desktop.yml` run manually for now (see
[DEVELOPMENT.md](DEVELOPMENT.md#cicd)). `desktop.yml` packages the app, tests the
ZIP and runs the install/reinstall/uninstall lifecycle on a disposable Windows
runner. The
installer lifecycle script refuses to run locally or over an existing
profile/installation.

`release.yml` can be dispatched manually to produce reviewable artifacts without a
release. A pushed `vX.Y.Z` tag must match `package.json` and the release-notes
version. After the Windows checks pass it publishes `ghcr.io/bircck/deckshelf:vX.Y.Z`
and `:latest`, then a separate job with contents-write permission creates a
**draft** GitHub release. It never publishes the draft. No upload token is baked
into the executable and electron-builder publishing is disabled.

For a release:

1. Update the version in `package.json`/`package-lock.json` and add
   `docs/RELEASE_NOTES.md` notes.
2. Merge to `main` after the local checks. Run `ci.yml` (full) and `desktop.yml`
   (Commander Archive upgrade) manually on `main`, then tag `vX.Y.Z` and push the tag.
3. Run the manual checks in [VALIDATION.md](VALIDATION.md) on the draft's artifacts
   and record them in the release issue.
4. Publish the draft. Deploy the hosted site by pinning the release image digest.

Do not reuse or overwrite a published version/tag; draft creation fails on an
existing release rather than replacing its assets.

The source code is MIT licensed, and bundled card art follows the Wizards Fan
Content Policy (issue #9). The repository `Bircck/DeckShelf` is public; history
before 2026-10-19 was recreated from a private archive (#122). No workflow
changes repository visibility.

## Signing and platform scope

The main target is an unsigned Windows x64 NSIS setup executable. The assisted
wizard is forced to current-user installation by `desktop/installer.nsh`; it does not
request elevation. It adds a Start menu shortcut and Windows uninstall registration,
but no desktop shortcut. The stable appId identifies upgrades. Uninstall retains
the separate user profile. The ZIP is an optional portable alternative. No certificate,
auto-updater or machine-wide install is configured.
`signExecutable: false` avoids signing-tool requirements while electron-builder still
writes the DeckShelf icon (`desktop/icon.ico`, from `scripts/app-icons.mjs`) and
version details into the executable; the installer and uninstaller use the same icon.
The window title and executable filename are DeckShelf. Authenticode
signing, ARM64, macOS and Linux distributables remain
future release work. Checksums detect corruption but do not establish authenticity.

Keep Electron's LICENSE/Chromium notices and generated dependency licenses in the
package. `LICENSE.md` (MIT) covers only the original source code; do not mistake
it or the third-party notices for a grant of artwork redistribution rights.
