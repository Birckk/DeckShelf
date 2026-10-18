# Using DeckShelf

The same topics are in the app under **Help** (`/help`), with a FAQ and the roadmap.

## Browsing

DeckShelf has three views of the same collection:

- **Collection** is a grid of commander cards. Switch between Details, Cards only
  and List, change the card size, and sort by collection order, name, release
  date or number of colours. Layout and size are remembered in this browser.
- **Cards** is a carousel of full commander cards. Drag it, click a neighbouring
  card or use the arrow keys (Home and End jump to the ends).
- **Pick a deck** is the picker (see below).

Search matches deck names, commanders, descriptions, sets and themes. The colour
buttons show decks that contain every selected colour; turn on **Exact colors**
to show only that exact combination. **Filters** adds set, tags, number of
colours and colourless decks. Tags are the deck's Archidekt tags; choosing several
shows decks that have all of them, and clicking a tag on a deck filters by it. A
deck copied on Archidekt doesn't keep the original's tags, so add them there and
refresh. Commander is the default format; choose **All formats**
or another saved format in Filters. Search and colours apply to all three views.
Non-Commander decks show their featured card from Archidekt, or a labelled fallback
when none is selected. Change the featured card on Archidekt, then refresh the snapshot.

Open a deck for its commander, themes, description and release, with a link to
the full decklist on Archidekt. **Refresh snapshot** fetches the latest version
of the deck. If the source is unavailable, your saved copy stays as it was.

## Picking a deck

The picker draws from active collections matching search and colours, within its
explicit **Pick format** scope. It never mixes formats. A single-format shelf or
shortlist carries that scope into the picker; mixed shelves start in Commander.
Changing Pick format replaces the browsing format filter for picking only. To pick from
a handful instead, use **Choose a few** in the Collection view: click the decks
you're considering (Shift-click selects a range), then **Picker**. Every deck in
the pool has the same chance; repeated cards in the spiral are only there to fill
it out.

Drag the spiral to turn it, pause the drift, or turn on **Instant pick** to skip
the animation. Your system's reduced-motion setting is respected.

## Your collection

**My collection** is where you choose what's on the shelf.

- **Add decks:** paste an Archidekt username, profile, folder or deck link. For
  an account or folder, choose the folders or individual decks you want, then
  **Add selected decks**. Commander is selected initially. Choose **All formats**
  to include other formats, then narrow the selection to an actual format if wanted.
  Bulk actions affect the current format results and keep other selections.
  A pasted deck link adds that deck in its own format. Only public decks can be imported, and
  DeckShelf never writes to Archidekt or asks for a password.
- **Show or hide:** each account, folder and group has a switch. **Only this**
  shows just one; **Enable all** turns everything back on. Hiding a collection
  keeps its decks and choices saved.
- **Official Commander precons:** the starter collection of 184 precons from
  Archidekt's catalog. Remove it when you only want your own decks, and restore
  it at any time without losing your selections.
- **Refresh** a source to pick up new or changed decks. New decks wait for you to
  add them; decks that disappear from the source stay saved.

Limits: up to 50 sources, 1,000 decks per source and 1,000 imported decks.

Existing source connections keep discovering Commander decks on refresh. Add the
same source again with All formats to widen discovery without losing its saved
selections. Unknown source formats keep their original numeric ID and have their
own picker scope. DeckShelf displays the source format; it does not check legality.

## Settings

Open **Help → Settings** (`/help/settings`) to choose Dragon nest or Art deco
wedges for card backs and missing commander artwork. Previews show four sample
colour identities. **Show card backs instead of artwork** uses the card back for
every deck and stops DeckShelf downloading any commander artwork. Both choices are
saved locally and travel with collection backups.

## Saving and backups

Your collection is stored in this browser, for this site address. It is not
shared between browsers or devices. The Windows app has its own separate profile.

Use **Export backup** in My collection before you clear browser data, switch
browsers or move to another computer. **Restore backup** shows what the file
contains and asks before it replaces the current collection.

Backups keep the version-1 format: saved deck snapshots, precons, linked sources
and collection choices, including hidden collections. Display preferences (such
as layout and card size) and temporary shortlists are not included. Restore
replaces rather than merges and leaves display preferences as they are. It saves
the validated file before replacing the current shelf; a failed save keeps the
current collection and preview so you can retry.

If saving fails, export your session before closing or use **Retry saving** when
storage is available. Damaged or unreadable saved data is protected from automatic
overwrites. **Download recovery data** preserves damaged data for manual repair;
**Export backup** exports the current session as a valid collection file.

Adding or refreshing decks needs an internet connection. Deck details are saved
locally, so browsing and picking work offline.

## Installing and offline use

The hosted site can be installed as an app; it is optional, and the normal web
address keeps working.

- **Chrome, Edge (desktop and Android):** use the install icon in the address bar
  or *Install app* / *Add to Home screen* in the browser menu.
- **Safari on iPhone and iPad:** Share → *Add to Home Screen*. The installed app
  keeps its **own** storage, separate from Safari: export a backup in Safari and
  restore it in the installed app to bring your collection across.
- **Firefox (desktop):** no install option; offline use still works in the tab.

Once DeckShelf has loaded, it opens offline with your saved collection, filters
and the picker. Artwork you have already seen is kept on the device (up to about
800 images); artwork you haven't seen yet shows a dragon holding the deck's mana
symbols, marked *Offline*. Adding and refreshing decks wait for a connection. Installing does not
make a backup or sync anything between devices; keep an exported backup separately.

When a new version is ready, DeckShelf says so above the collection. **Reload**
switches to it; **Later** keeps the current page. Your collection is unaffected.
