# DeckShelf 1.0.0

DeckShelf shows your Magic: The Gathering decks as a wall of cards. Filter them,
then let it pick one at random when the table can't decide what to play. This is
the first public release.

## Ways to run it

- **Hosted site:** [deckshelf.birckk.com](https://deckshelf.birckk.com). Your
  collection is saved in your browser; the server keeps no account or deck database.
- **Windows app:** run `DeckShelf-Setup-1.0.0-x64.exe` from this release. It
  installs for the current user without admin rights, with a Start menu entry and
  an uninstaller. A portable ZIP is attached too. See `DESKTOP.md`.
- **Docker:** `ghcr.io/birckk/deckshelf:v1.0.0` (also `:latest`). Compose files and
  setup are in [docs/HOSTING.md](https://github.com/Birckk/DeckShelf/blob/main/docs/HOSTING.md).
- **From source:** Node.js 22.18+, `npm ci` and `npm run dev`.

## What's in 1.0

- **Archidekt imports.** Link a public Archidekt account, folder or single deck.
  DeckShelf only reads public data and never asks for a login.
- **The shelf.** Each deck shows as its commander or featured card. Search by name
  and filter by format, colour identity, set or theme. Commander is the default;
  All formats includes Modern, Standard, Pauper and the rest.
- **Starter collection.** The 184 Commander precons from Archidekt's catalog are
  available as an optional collection, so the app works before you link anything.
- **Pickers.** A spinning helix or a shuffle-and-deal, for up to four players at
  once. Every deck in the pool has the same chance.
- **Friends' collections.** Open a friend's public Archidekt collection by
  username, read-only beside your own Library. Bookmark it, or share your own shelf
  as a link.
- **Backups.** Export your collection and choices to a file and restore it in
  another browser or the Windows app.
- **Offline.** Once loaded, the site opens offline with your saved collection and
  the picker. On phones it can be installed from the browser menu.
- Phone layouts, keyboard navigation and reduced-motion support throughout.

## Upgrading from Commander Archive

DeckShelf was called Commander Archive before 1.0. The Windows setup replaces an
installed Commander Archive and the first start copies its collection. A browser
collection moves over with a backup file.

## Known limits

- The Windows build is **unsigned**, so SmartScreen will warn before it runs.
  Compare the file with `SHA256SUMS.txt`; a checksum detects corrupt downloads but
  does not prove who published it. Only Windows x64 is built. There is no
  auto-updater, and no macOS or Linux desktop build.
- Imports depend on Archidekt's public endpoints, which may change. Adding and
  refreshing decks needs a connection; offline, artwork you haven't seen yet shows
  a placeholder.
- There is no sync between devices. Use a backup file to move a collection.

`VALIDATION.md` lists what was tested for this release and what was not.

## Credits and licence

Inspired by [GameShelf](https://gameshelf.io/). Deck data from Archidekt; mana
symbols from Scryfall.

DeckShelf is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of
Wizards of the Coast. ©Wizards of the Coast LLC. Card art and mana symbols are
used under that policy and keep their own terms; see `THIRD_PARTY_NOTICES.md`.
The source code is MIT licensed.
