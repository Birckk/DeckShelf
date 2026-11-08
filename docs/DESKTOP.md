# DeckShelf for Windows

## Start

Download **DeckShelf-Setup-VERSION-x64.exe**, open it, and follow the setup
wizard. It installs for your Windows account without administrator access, keeps
the runtime files in your local Programs folder, and adds **DeckShelf** to
the Start menu. No desktop shortcut is added. You can delete the downloaded setup
file after installation. Node.js, npm, Python and a separate browser are not required.
Windows x64 is the first target; ARM64 and other operating systems are not verified.

The optional ZIP is a portable alternative: extract all files into a dedicated
folder and open DeckShelf.exe. Do not mix its files with installer downloads
or run it inside the ZIP. Both versions use the same saved desktop collection.

This build is unsigned. Windows may display an unknown-publisher or SmartScreen
warning. Check where the download came from and its checksum before deciding
whether to run it; signing and reputation are not supplied by a checksum.

The slim bar at the top holds the window buttons and, at the left, a menu
button (≡): File (Export backup), View (zoom, full screen), Go (the main views,
with Ctrl+1–4 and Ctrl+F) and Help (DeckShelf Help with F1, and About). Close the window or choose ≡ → File → Exit to stop the application. Launching it again
while it is open brings the existing window forward. External deck links open in
your default browser, where deck editing belongs.

## Your collection

Open **Library → Add decks**, enter a public Archidekt username, folder or
deck link, select the decks you own, and choose **Add selected decks**. Refresh is
manual and read-only. No platform password is requested.

An Archidekt account is a reusable starting point on another device. It is not a
backup of this app's selections, disabled collections, picker exclusions or saved
snapshots. Use the app's export/restore controls to carry those choices with you.

The desktop app stores its collection in its own profile at
`%APPDATA%\DeckShelf`, under the stable `archive://app` origin. It opens no
HTTP listening port. Changing the default browser does not change this collection.
The profile is local to your Windows account; it is not an online account or sync.

## Move from the browser, back up, or restore

1. In the existing browser app, open Library and export a collection backup.
2. Open the desktop app and restore that JSON backup through Library.
3. Confirm the replacement only after checking that it is the intended file.

Version-1 backups remain supported. Restore replaces the destination collection.
Backups contain source connections, snapshots and display/picker selections, but
not downloaded artwork or all interface preferences (such as window size).
Browser storage is never read or migrated automatically.

For a full local profile backup, close the app and copy `%APPDATA%\DeckShelf`
to a safe place. Prefer the JSON export for moving between devices or between the
desktop and browser versions. Do not edit the profile's database files directly.

## Upgrade or uninstall

Export a backup, close the app, and run the newer setup executable. It replaces the
installed application while keeping the separate profile and origin. The installer
also picks up a collection previously used by the ZIP version. After checking the
installed app, you can delete any old extracted ZIP folder. Never delete your profile
as part of an upgrade. Future format changes must preserve version-1 import
compatibility or provide an explicit migration. Updates are manual for now.

Before 1.0 the desktop app was called Commander Archive. The DeckShelf setup
removes an installed Commander Archive. On first start, DeckShelf (installed or
ZIP) copies your collection from `%APPDATA%\Commander Archive` into its own
profile and leaves the old folder untouched. Once DeckShelf shows your collection,
you can delete the old folder. If the collection is missing, restore a backup
exported from Commander Archive.

To uninstall an installed copy, use **Windows Settings → Apps → DeckShelf →
Uninstall**. It removes the app and Start menu shortcut; your profile remains.
For the portable ZIP, close the app and delete its extracted folder instead.
To erase local data as well, export any wanted backup first, then delete
`%APPDATA%\DeckShelf` while the app is closed. Saved exports elsewhere on
disk and the browser version's data remain until you remove them separately.

## Offline and troubleshooting

The bundled starter decks, artwork, fonts, filters and picker work offline.
Discovering or refreshing Archidekt sources requires internet access. Previously
saved deck metadata remains available on upstream failure; imported artwork may
depend on the cache. No account synchronization happens in the background.

If the app appears empty, check collection switches, selections and filters. If
your browser version has the collection you expect, export there and restore here.
If the app fails to open, rerun setup (or re-extract the entire portable ZIP) and
check that security software has not removed runtime files. Keep backups before
troubleshooting data. Startup diagnostics are in `%APPDATA%\DeckShelf\startup.log`.

## Verify a download

In PowerShell, run `Get-FileHash .\DeckShelf-Setup-VERSION-x64.exe -Algorithm SHA256`
and compare it with the matching entry in `SHA256SUMS.txt` from the same release.
The checksum detects different/corrupt bytes; it does not authenticate the publisher.

See `resources/THIRD_PARTY_NOTICES.md`, `resources/notices/`, `LICENSE.electron.txt` and
`LICENSES.chromium.html` for third-party credits and license texts.
