# DeckShelf 1.0.0 — desktop candidate

- Renamed from Commander Archive. Setup replaces an installed Commander Archive,
  and the first start copies its collection.
- Windows x64 setup wizard with a bundled runtime, Start menu entry and uninstaller.
- Separate persistent desktop collection; stable storage across upgrades.
- Existing collection viewer, picker, read-only Archidekt imports and version-1
  backup/restore retained. Transfer a browser collection by exporting/restoring.
- No background account sync or automatic updates. Optional portable ZIP available.

Run **DeckShelf-Setup-1.0.0-x64.exe**. See DESKTOP.md for
startup, upgrade, backup, uninstall and checksum instructions.

This is an unsigned release candidate. Windows publisher verification and
SmartScreen reputation have not been established. Only Windows x64 is packaged.
See docs/VALIDATION.md in the repository for checks actually performed and remaining
limitations. The workflow must not be treated as proof of installer, signing or
every supported Windows configuration working.

Public publishing remains subject to an owner decision on where downloads are
hosted. Card art and mana symbols are used under the Wizards Fan Content Policy. The source code is MIT licensed.
