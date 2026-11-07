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

Choose **Helix** or **Shuffle** in the Picker dropdown. Drag the spiral to turn
it, pause the drift, or turn on **Instant pick** to skip the animation. **Shuffle**
gathers the decks into a pile, shuffles and deals one card per player instead. Either way the pick is made
first and the animation only shows it. Pick for 1–4 **Players** to give each
player a different deck. Your system's reduced-motion setting is respected.

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
  Archidekt's catalog. Hide it (⋯ More → **Hide precons**) when you only want your
  own decks; **Show** in the Hidden list brings it back with its selections.
  **Refresh** in its header adds precons Archidekt has listed since the snapshot.
- **Hide or remove:** **Hide** moves a collection to the Hidden list and keeps it.
  **Remove** (imported sources only) deletes the source and the decks only it had;
  **Undo** in the notice brings them back.
- **Refresh** a source to pick up new or changed decks. Once a day, when you open
  DeckShelf, folders you added whole also get their new decks automatically (turn
  this off with **Add new decks automatically**). In folders where you picked
  single decks, new decks wait for you to add them. Decks that disappear from the
  source stay saved.

Limits: up to 50 sources, 1,000 decks per source and 1,000 imported decks.

Existing source connections keep discovering Commander decks on refresh. Add the
same source again with All formats to widen discovery without losing its saved
selections. Unknown source formats keep their original numeric ID and have their
own picker scope. DeckShelf displays the source format; it does not check legality.

## Sharing shelves

**Share** in My collection gives a link to one of your Archidekt accounts or
folders (`/u/<username>` or `/f/<folder id>`). You can also open someone's
collection without a link: the people icon after the DeckShelf name opens the
collections menu, where **Open a collection…** takes an Archidekt username or
link. A friend's shelf opens read-only, beside your own. Browse and pick from it,
switch their folders and decks on and off (remembered per friend on this device),
**Bookmark** it so it stays in the menu and opens offline, or **Save to mine** to
add the decks you have on to your collection. The menu's **Mine** row takes you
back, and switching from the menu keeps the page you're on. Bookmarks and recently
viewed shelves are also listed in My collection. Nothing about your own shelf is
changed or sent anywhere; the link only names the Archidekt source.

## Settings

Open **Help → Settings** (`/help/settings`) to choose Dragon nest or Art deco
wedges for card backs and missing commander artwork. Previews show four sample
colour identities. **Show card backs instead of artwork** uses the card back for
every deck and stops DeckShelf downloading any commander artwork. Both choices are
saved locally and travel with collection backups. The same page sets the List
columns and artwork, whether folders get new decks automatically
(**Add new decks automatically**), and whether adding decks to a switched-off
collection switches it back on.

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

On phones and tablets the hosted site can be installed as an app; it is optional,
and the normal web address keeps working. DeckShelf doesn't pop up an install
banner; install it from the browser when you want to.

- **Chrome, Edge and other Android browsers:** *Install app* / *Add to Home
  screen* in the browser menu.
- **Safari on iPhone and iPad:** Share → *Add to Home Screen*. The installed app
  keeps its **own** storage, separate from Safari: export a backup in Safari and
  restore it in the installed app to bring your collection across.
- **Desktop browsers:** no install option; offline use still works in the tab.
  For an app on Windows, use the [Windows app](DESKTOP.md).

Once DeckShelf has loaded, it opens offline with your saved collection, filters
and the picker. Artwork you have already seen is kept on the device (up to about
800 images); artwork you haven't seen yet shows a dragon holding the deck's mana
symbols, marked *Offline*. Adding and refreshing decks wait for a connection. Installing does not
make a backup or sync anything between devices; keep an exported backup separately.

When a new version is ready, DeckShelf says so above the collection. **Reload**
switches to it; **Later** keeps the current page. Your collection is unaffected.
