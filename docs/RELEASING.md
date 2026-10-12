# Building and distributing Commander Archive

## Architecture

The React/Vite frontend is shared by the browser and Electron application. Desktop
uses a sandboxed renderer with no Node integration or preload bridge. A secure
`archive://app` protocol serves packaged assets and adapts the existing read-only
Archidekt API handlers in the main process. No HTTP server, free port or installed
Node runtime is needed. External HTTPS links open in the system browser. Other
external protocols and renderer permission requests are denied.

Keep `dk.bircck.commanderarchive`, the `Commander Archive` profile directory, and
`archive://app` stable across releases. Do not put a version or extraction path in
the storage identity. Never test with the owner's live browser origin/profile.

A hosted version still does most work in the user's browser, with no server-side
collection database. Account/folder/deck discovery currently requires the Node
adapter because the upstream API cannot be assumed to permit browser CORS. Static
hosting alone supports the bundled collection and backups, not live imports.
Browser caching/PWA installation and cross-device synchronization are separate
future work. Archidekt reconstructs public deck sources, not local app preferences.

## Local build (Windows x64)

Use Node 22.12+ and the committed npm lockfile. The package command explicitly
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

`check.yml` runs tests/build on Linux and Windows. Windows also packages, tests the
ZIP, checks the install/reinstall/uninstall lifecycle on the disposable runner,
and uploads the candidate. The installer lifecycle script refuses to run locally
or over an existing profile/installation. `release.yml` can be dispatched manually to produce
reviewable artifacts without creating a release. A pushed `vX.Y.Z` tag must match
`package.json` and the release-notes version. After the Windows checks pass, a
separate job with contents-write permission creates a **draft** GitHub release.
It never publishes the draft automatically. No release upload token is baked into
the executable and electron-builder publishing is disabled.

For a release, update package.json/package-lock.json and docs/RELEASE_NOTES.md,
record actual checks in docs/VALIDATION.md, and review the generated artifacts.
Do not reuse or overwrite an already-published version/tag. Draft creation fails
on an existing release rather than replacing its assets silently.

Before the first public publication, the owner must settle the original software
license, bundled asset redistribution basis, and intended download visibility.
The existing repository is `Bircck/commander-archive`; do not create a duplicate.
It is currently private. Private release links and Actions artifacts are restricted
to authorized repository users; they are not public download links. Public download
access needs an explicit distribution/visibility decision. No workflow changes
repository visibility.

## Signing and platform scope

The main target is an unsigned Windows x64 NSIS setup executable. The assisted
wizard is forced to current-user installation by `desktop/installer.nsh`; it does not
request elevation. It adds a Start menu shortcut and Windows uninstall registration,
but no desktop shortcut. The stable appId identifies upgrades. Uninstall retains
the separate user profile. The ZIP is an optional portable alternative. No certificate,
auto-updater or machine-wide install is configured.
`signAndEditExecutable: false` avoids signing-tool requirements; consequently the
runtime executable's embedded branding/metadata may retain Electron defaults.
The window title and executable filename are Commander Archive. Authenticode
signing, a branded executable icon, ARM64, macOS and Linux distributables remain
future release work. Checksums detect corruption but do not establish authenticity.

Keep Electron's LICENSE/Chromium notices and generated dependency licenses in the
package. `LICENSE.md` records the pending project license choice; do not mistake
third-party notices for a grant of project or artwork redistribution rights.
