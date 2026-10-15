# Third-party notices

DeckShelf is unofficial Fan Content permitted under the
[Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not
approved/endorsed by Wizards. Portions of the materials used are property of
Wizards of the Coast. ©Wizards of the Coast LLC.

DeckShelf is also not approved, sponsored, or endorsed by Archidekt, Scryfall, or
Moxfield. Magic: The Gathering names, card images, artwork, and mana symbols belong
to their respective owners, including Wizards of the Coast and the credited artists.

## Artwork, symbols and data

- The 29 starter decks use metadata from the supplied reference workbook and
  [Archidekt's precon catalog](https://archidekt.com/commander-precons). Commander
  images were downloaded from Archidekt. Artist attribution is retained in the
  deck viewer and in `resources/notices/artwork.json` in the desktop package.
- Mana SVGs came from [Scryfall's symbology API](https://scryfall.com/docs/api/card-symbols).
  Availability through an API is not a transfer of copyright.
- Added accounts, folders and decks are read-only public Archidekt sources.
- Card images for the precon catalog and imported decks load from
  [Scryfall](https://scryfall.com/docs/api/images) (the same files Archidekt
  mirrors), unmodified. The hosted app keeps up to about 800 viewed images in the
  visitor's browser for offline use; nothing is re-hosted or proxied. Artists are
  credited in deck details.
- Card art and mana symbols are included in the app and its downloads under the
  [Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
  (owner decision, 2026-10-12). DeckShelf stays free, has no paywall, uses no
  Wizards logos and does not imply endorsement.
- The [double-helix gallery](https://github.com/githyperplexed/double-helix-gallery)
  inspired the spatial presentation; this application's animation and layout code
  were independently implemented.

## Software and fonts

The release build copies installed dependency license/notice texts into
`resources/notices/`, with exact versions in `dependencies.json`. This includes
React, React DOM, Scheduler (MIT), Lucide React (ISC), and the Outfit and DM Sans
font packages (SIL Open Font License). Refer to the included texts for the actual
terms and copyright holders. The inventory is regenerated from the lockfile.

Electron ships Chromium and Node.js. Its runtime distribution includes `LICENSE`
(`LICENSE.electron.txt` in the package) and `LICENSES.chromium.html` next to the application executable. Keep those files
and `resources/notices/` with the application when sharing it.

DeckShelf's original source code is MIT licensed (`LICENSE.md`). That license
does not cover the third-party software, fonts, artwork, symbols, names or data
described above, which keep their own terms.
