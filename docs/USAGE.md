# Using DeckShelf

## Views, filters and the picker

- **Collection / Cards / Pick a deck:** three views of the same filtered collection. Cards opens a horizontal carousel of original commander card images; drag, click neighboring cards, or use the arrow buttons. Keyboard arrows, Home, and End work within the carousel. Click the centered card for deck details.

- Search deck names, commanders, source descriptions, sets, and themes.

- Color buttons normally require **every** selected color, including decks with extra colors. **Exact colors** requires exactly the selected combination. With no colors selected, all colors are allowed.

- Combine colors with release, theme, and color-count filters.

- The **In picker / Excluded** control beneath each grid card excludes or includes it in the picker. Excluded decks remain visible in the collection and carousel. Search and mana colors are in the top toolbar; **Filters** drops down release, theme, color-count, and colorless options; results update immediately. Selecting all five colors only matches five-color decks.

- **Pick a deck** opens two continuously corkscrewing strands of commander artwork. Cards travel through different heights and depths, with distant cards dimmed and blurred. Drag horizontally to turn the scene or vertically to move along the strands, then release for momentum. Pause freezes the scene; selecting a card opens its source information. Drag inside the spiral to turn it; scroll outside the spiral to move the page.

- Picking gives every eligible deck an equal chance. The strands accelerate, then settle with the selected deck at the front before revealing its full commander card. The pool cannot change mid-spin. Small filtered collections repeat visually along the strands; the repetitions do not affect the odds. **Reduce motion** stops ambient movement and skips the spin/reveal animations; the system's reduced-motion setting is respected by default.

- Open a deck to see its commanders, source description, colors, and themes, then follow its Archidekt link for the full decklist. **Refresh snapshot** fetches a fresh snapshot without changing your inclusion/exclusion choices; source failures keep the saved deck.

- **My collection** manages the showcase: link one or more public Archidekt accounts or folders, or add individual deck links. Use the Selected and Picker checkboxes for individual decks, and collection switches to choose which groups appear. Search and bulk display controls apply to the current list.

- Export a backup before moving computers, switching browsers, clearing browser data, or changing the server origin/port. **Restore backup replaces the current collection selection.**

The picker repeats eligible decks to keep the spiral full even with one or two matches. Each strand cycles through decks in order before repeating. Card spacing stays consistent as the pool grows: extra decks extend the loop beyond the viewport instead of crowding the visible spiral. Repeated cards are visual only; every eligible deck keeps an equal chance of being picked.

The background stays steady while browsing all three views. Artwork and mana-colored light appear only when a winner is revealed. The picker opens centered, varies its spin distance and duration, then reveals the winner with a brief halo and subdued surroundings. Gentle card tilt, filter transitions, and reveals respect reduced-motion preferences.

Collection display controls offer Details, Cards only and List layouts with a size slider. Layout and size are remembered in this browser.

## Data and offline behavior

The 29 supplied precons are included in `src/data/decks.json`, with local commander artwork in `public/images`. The starter collection, filtering and picker work without external internet access while the local server is running. Fonts are bundled locally too.

Display choices, linked public sources, and imported deck snapshots are stored in `localStorage`. In the browser version they are specific to the browser and URL origin. The desktop version uses its own persistent profile and stable `archive://app` origin; browser changes do not affect it. This is one collection for one user; linking multiple sources does not create shared ownership or an app login.

Adding or refreshing a source requires internet access and the API adapter (built into the desktop app, or provided by the Node server for browser use). Added or refreshed artwork is loaded from Archidekt; offline availability of that artwork depends on the cache. Refresh is manual, not a background account sync. Moxfield links are retained as references for the supplied collection; live Moxfield import is not implemented ([#7](https://github.com/Bircck/DeckShelf/issues/7)).

### Linking sources

**My collection** opens on **Showcase overview**. Each connected folder/account, Individual decks, and Included precons has an on/off switch. Switching a collection off pauses its contribution to Collection, Cards and Pick a deck without changing its deck selections or picker exclusions. **Only this** enables just that collection; **Enable all** restores every collection switch. Overlapping collections show each deck once if at least one enabled collection includes it. Deselecting a saved deck or excluding it from the picker still applies across collections.

**Included precons** is the original 29-deck list supplied for this project, bundled with offline artwork. It is not Archidekt’s complete catalog or a live folder. Turn it off when you only want your own connected folders. **Browse precons** reads the public `Archidekt_Precons` account behind [Archidekt’s curated catalog](https://archidekt.com/commander-precons); select the precons you own before adding them. Even decks already included locally are not automatically selected for a newly connected catalog. Your existing linked sources retain their saved selections.

Individual decks includes direct deck links and saved decks no longer attached to a source. Adding an individual link explicitly keeps it in this group even if the same deck belongs to a folder. Disabled collections, source selections and these individual links are included in backups; older backups continue to work with all collection switches enabled.

1. Open **My collection → Add decks**. Enter an Archidekt username, public profile URL (`/u/name`), folder URL (`/folders/123`), or individual deck URL (`/decks/123`). Links are detected automatically.
2. An account or folder appears in the source sidebar. Select the decks you own, then choose **Add selected decks**. Source listings are previews; full commander metadata loads for selected decks only. An individual deck link is added directly.
3. **Refresh source** discovers new decks and updates already-saved decks from that source. New decks wait for review; local visibility and picker exclusions stay unchanged. Failed imports are listed individually, and previous snapshots are retained. Decks no longer listed remain available with a saved-copy notice.
4. **Disconnect** removes the connection and keeps all saved decks and display choices. Decks without another linked source are listed under Individual decks (or Starter precons for bundled decks).

Connections are read-only and require no password. Only public Commander decks can be discovered. Folders include their direct decks; link subfolders separately. Accounts include public Commander decks across folders. The importer supports up to 50 sources, 1,000 decks per source and 1,000 imported snapshots. Sources larger than the limit fail explicitly rather than silently showing an incomplete collection.

Backups include source connections, saved source listings, deck snapshots and display/picker choices. Existing version-1 backups remain supported. Restore shows a confirmation before replacing the local collection. The app never writes to Archidekt or stores full decklists.
