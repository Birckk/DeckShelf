# Deployment and desktop validation

## Hosted application and GitHub checks

On September 29, 2026, DeckShelf was deployed on the server in a
non-root, read-only Docker container behind the existing Caddy proxy. Caddy
obtained a valid public certificate for `deckshelf.birckk.com`; HTTP redirects
to HTTPS. The live health endpoint and a public Archidekt import succeeded.
Chromium checks at 1440px and 390px verified the public HTTPS site, loaded artwork,
collection navigation, no horizontal overflow and no page errors. Public DNS was
resolved explicitly for the browser checks because this development computer
still cached the earlier NXDOMAIN; normal DNS access also passed on the server.

[GitHub run 36620315392](https://github.com/Bircck/DeckShelf/actions/runs/36620315392)
passed Linux and Windows unit/build checks, the container's web smoke checks,
packaged desktop smoke checks, and the actual NSIS install/reinstall/uninstall
lifecycle on a disposable Windows runner. The installer check verified the Start
menu shortcut, per-user registration and preservation of the profile sentinel.

The first hosted runs found two test-harness issues: hidden windows did not
produce screenshot frames on the Windows runner, and a fresh user had no uninstall
registry key. Tests now show the window only on that disposable runner and handle
an absent registry key. Local test windows stay hidden.

The website is online; PWA installation and offline caching are not implemented.

## Earlier local desktop validation

Local validation on September 29, 2026, on Windows 10 x64 (build 19045), with
Node 22.23.2 for building and Electron 44.4.5 in the distributable:

- 45 unit tests pass, including the existing 42 tests and desktop protocol/path,
  API-response and navigation-policy checks.
- TypeScript/Vite production build and Windows x64 ZIP packaging pass.
- The actual release ZIP was extracted to isolated test directories. The packaged
  executable launched its own window with only Windows System32 on its PATH;
  no external Node/npm runtime was available through that PATH.
- Packaged artwork rendered; the application screenshot was visually inspected.
- The renderer had no `window.require`. Custom-protocol API routing worked for
  unknown requests and a controlled account-discovery response. A separate live
  read-only fetch of public Archidekt deck 26549829 succeeded.
- A version-1 JSON backup was restored through the UI, including source selection,
  a disabled collection and hidden/excluded IDs. Exported JSON matched the fixture.
  The export check selected a destination programmatically; the OS save dialog was
  not manually exercised.
- The app was closed, the same ZIP extracted into a different folder, and the app
  relaunched with the same isolated profile. Collection data persisted. This checks
  extraction-path independence, not a future schema migration between versions.
- With renderer networking disabled, reload and bundled artwork still worked.
  This does not prove imported artwork is permanently cached or test every offline
  network failure; importer failure behavior is covered separately by unit tests.
- The owner's live browser collection and port 4317 were not used or altered.

Startup follow-up: automated failures originally displayed native error dialogs on
the desktop. Test mode now suppresses windows/dialogs and exits with an error code.
A separate native launch check uses production window settings without Playwright's
inspector/startup hooks. Startup outcomes are recorded in the profile's `startup.log`
(replaced at each launch); the stable profile and collection format are unchanged.

The archive checker enforces the application file allowlist and presence of runtime
and dependency notices. SHA256SUMS.txt covers the ZIP and companion documents.

## Limits and observed environment issues

This was an isolated profile and fresh extraction on the existing development
machine, not a pristine Windows VM. System Node was not uninstalled. Windows 11,
ARM64, non-Windows platforms, Windows Explorer double-click, SmartScreen behavior,
manual save dialogs and installation on another person's computer remain untested.
The NSIS installer now builds locally. Its embedded application payload was
extracted with 7-Zip and passed the native startup and full desktop smoke checks,
including backup/restore, persistent relaunch and offline artwork. This verifies
the bundled application, not execution of the installation wizard. Authenticode
reports NotSigned. Installation, Start menu registration,
same-version reinstall and uninstall/profile preservation have a dedicated check
in `scripts/smoke-installer.ps1`, gated to disposable GitHub Windows runners. That
lifecycle check subsequently passed on GitHub (see above). The setup wizard
has not been manually exercised. No signing certificate or automatic updater exists.
The Check workflow has run remotely. No desktop GitHub release has been published;
the separate tag-triggered draft-release workflow has not been exercised.

The first test extraction under the system TEMP folder hit a Chromium GPU startup
failure with exit code -2147483645. That directory has additional inherited sandbox
ACL entries. Workspace-local test directories worked with normal sandboxing and
hardware acceleration; no system permissions or sandbox settings were changed.
This is consistent with the [reported Electron Windows ACL issue](https://github.com/electron/electron/issues/51761),
but the precise machine-level cause was not independently proved. The test now
uses isolated directories under ignored `qa/`. Keep test artifacts there for diagnosis.

Electron-builder's separate download/extraction path also hit a directory-rename
EPERM on this host. The build now installs the pinned npm Electron runtime explicitly
and copies that distribution, avoiding the duplicate extraction step.

Before wider distribution, verify the download on a separate clean Windows account
or VM and settle project licensing, third-party asset redistribution and download
visibility. Do not label this unsigned candidate as a signed installer or a public release.
