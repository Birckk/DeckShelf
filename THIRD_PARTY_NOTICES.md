# Third-party notices

Commander Archive is an unofficial fan project. It is not approved, sponsored, or
endorsed by Wizards of the Coast, Archidekt, Scryfall, or Moxfield. Magic: The
Gathering names, card images, artwork, and mana symbols belong to their respective
owners, including Wizards of the Coast and the credited artists.

## Artwork, symbols and data

- The 29 starter decks use metadata from the supplied reference workbook and
  [Archidekt's precon catalog](https://archidekt.com/commander-precons). Commander
  images were downloaded from Archidekt. Artist attribution is retained in the
  deck viewer and in `resources/notices/artwork.json` in the desktop package.
- Mana SVGs came from [Scryfall's symbology API](https://scryfall.com/docs/api/card-symbols).
  Availability through an API is not a transfer of copyright.
- Added accounts, folders and decks are read-only public Archidekt sources. Images
  for imported decks are requested from their remote source and are not guaranteed
  to be available offline.
- The [Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
  is relevant to proposed public distribution. This notice does not establish that
  every bundled asset is cleared for redistribution. Review the artwork/symbol
  distribution basis before publishing; remove or replace anything not covered.
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

The project's own licensing status is recorded separately in `LICENSE.md`.
