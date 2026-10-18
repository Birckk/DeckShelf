# Design direction

Public name: **DeckShelf**. Subtitle: **Deck collection**. Keep it short.

DeckShelf is a personal Magic collection viewer and deck picker, with Commander as the default format. Its character comes from actual Magic cards, commander or featured artwork, mana symbols, and the spatial carousel. Preserve the dark card-studio look the owner likes. Improve specific details instead of periodically redesigning the whole app.

“AI telltales” here means generic, unnecessary design choices that make the app feel templated. These are project preferences, not a reliable way to detect whether something was made with AI.

## Language

Use short, specific language that fits choosing decks for a game. A little personality is welcome when it sounds natural.

| Prefer | Avoid reintroducing |
| --- | --- |
| What are we playing? | A twist of fate. |
| Browse your decks or pick one at random. | Follow the cards. Find a favorite. Or let the universe choose. |
| Picking a deck… / Deck selected | FATE IN MOTION / YOUR NEXT ADVENTURE |
| Motion paused | A MOMENT OF STILLNESS |
| No eligible decks. Adjust your filters or include more decks. | No decks in this constellation. |

Avoid vague fantasy slogans, promotional filler, and all-caps micro-labels that do not convey useful information. Do not add a headline and subtitle to every component merely to fill space.

## Icons and visual identity

- Use the selected familiar dragon embracing a card (concept 09) as the brand mark. The header uses a warm ivory dragon (#f3f1ec, matching the studio text) with a pale gold card (#f2ddb0, matching the studio accent). Use the simplified mark with a thicker card outline and no eye for the favicon, adapting its colors for light and dark browser themes. Keep the SVG silhouette and restrained flat colors.
- Use the bundled Magic mana symbols for color identity.
- Use dice for random deck selection; do not substitute generic AI-style sparkles.
- Cards navigation uses a small fan of cards with its visible label.
- Do not restore the repeated `COMMANDER ✦` stamps on every carousel card.
- Keep meaningful labels on unfamiliar controls. Preserve visible keyboard focus even when mouse hover styling is subtle.
- Keep Outfit and DM Sans, the charcoal palette, and restrained warm accents. No font is inherently an “AI font”; do not churn typography to follow a generic banned-font list.
- Avoid unsolicited neon gradients, glowing borders everywhere, nested decorative panels, oversized hero banners, and repeated badges with no purpose.

## Layout and density

- Page edges, the gap under the header, sidebar width, text measure, touch size and breakpoints come from `src/layout.css`. Every view pads with `--gutter` (32, 24 from 1100px, 16 from 550px), so the header, Collection, Cards, picker, My collection and Help line up. Use the six breakpoints listed there (1500 min, 1100, 850, 700, 550, 380); a new width needs a reason tied to content and a comment. Components keep their own inner spacing. `tests/layout.test.mjs` and `tests/browser/layout.spec.ts` enforce this.
- The cards and collection should dominate the page. Keep navigation, filters, and controls compact.
- Show a simple deck total by default. Show the full collection total when results differ, and a separate picker count only when exclusions make it different.
- Keep shared navigation, search, and deck counts anchored across views. Avoid an isolated extra row of Collection controls with wasted space; reserve scrollbar space so switching views does not shift the page sideways.
- Use one compact row below search: count left, view-specific controls right, wrapping on phones. Give the controls a little breathing room below search.
- Open Collection on each visit, refresh, or logo click; use the same home-view definition for these entry points so the displayed view and active navigation stay in sync; the Cards and picker views remain available from navigation.
- Filters drop down beside their trigger; they do not open a modal.
- Collection and My collection share Details, Cards only, Compact (square artwork, no captions) and List, S/M/L size steps, and sorting. Cards only at Medium size is the shelf default and Details at Medium the My collection default, so deck names and status show on a first visit; remember each page's layout and size independently. Phones are too narrow for pixel steps, so S/M/L there set the column count: three, two and one for Details and Cards only, four, three and two for Compact; Small Details trims its caption to a two-line name and the set line. On phones, fold size and sort together beside the layout switch; the Size and sort button matches the switch height. The fold is one row: size at the left as S, the slider at its normal fixed width (it does not stretch with the screen) and L; the sort field (as wide as its longest name, so switching fields does not move the row) and its direction button hold the right edge. The Size word and the sort icon drop out (owner pick over S/M/L buttons and a two-row fold, October 18). Below about 380px every layout becomes an equal icon button; the active one does not widen. List is a real table on both pages (see List table, October 17).
- Details has compact information below the card, without reserved blank title space. Keep names, releases, mana symbols, and picker inclusion easy to locate.
- The pick button floats over the spiral. Do not restore a large footer console that consumes carousel space.
- Picker motion controls sit beside the shared deck count. Do not restore a separate status/control strip above the picker scene.
- Do not remove useful spacing or flatten everything in the name of being “less AI.” Preserve readability and the distinctive card presentation.

## Collection management

- Owner direction for the next prototype: give My collection its own workspace, entered from the existing My collection control. Preserve the main Collection, Cards, picker, shared search, Guide and About. Management uses its own source/folder search and a clear return to the gallery; do not repurpose the Collection gallery tab. Explore a folder navigator with adjustable card/list views, separate source switches, and individual deck imports. Combining sources preserves their identity and selections; a unique display union is not a single flattened saved collection. The isolated collection-corner prototype is exploratory, not a shipped navigation change.
- Reuse the main collection's layout controls and mana components in the management workspace. Cards only shows full card faces; Details pairs artwork with full-width captions. Keep selection and Archidekt controls together over the artwork so they do not squeeze deck names. Keep the deck count and one Select all checkbox on the same row as the view controls; the checkbox shows checked, mixed or empty for the current results, so there is no separate Deselect button. Keep the overview's compact source switches, with optional folder expansion inside a bounded scroll area so long source lists do not consume the page.


- Dialog titles use readable normal-case text, not tiny letter-spaced labels. Keep the whole guide card fan visible. All three guide pages share a stable height and navigation position at each viewport size. About uses short purpose/benefit bullets rather than paragraphs.
- All dialogs use the shared Modal title treatment. Deck details keep readable metadata, full commander cards, compact source/refresh actions, and one saved-snapshot date; avoid explanatory filler and empty tag spacing. Check shared dialog changes against deck details and My collection.
- Do not show a precon attribution/start-collection strip above search. Keep precon information in My collection and the optional guide.
- My collection controls the showcase. Deck editing and card inventory stay on the external platform.
- Public accounts, folders, and individual deck links are read-only sources. Do not ask for platform passwords.
- Discovering a source does not mean the user owns all its decks. New discoveries wait for selection; refresh preserves display and picker choices.
- Distinguish local saved decks, starter precons, and source listings. Deduplicate decks shared by multiple sources.
- Adding decks from a source puts them on the shelf at once from the folder listing (name, format, art, colours). Commanders and the other details fill in in the background, two decks at a time (#102). A deck that can never load (private, gone, no commander) is removed again with a problem notice. One that failed only for now stays and loads on the next start or reconnection.
- Losing access to a source or a failed refresh must not delete saved decks. Keep the last usable snapshot when refresh fails. Removing a source on purpose is different: see Collection controls (October 15).
- Preserve the version-1 collection backup format and existing local choices. Include source connections in exports.
- Select all / Deselect all affect the current deck results, including search and status filters. New source entries are staged until Add selected decks; bulk actions preserve choices outside the results. Keep list controls compact, with no repeated introductory banner.
- My collection reopens the last visited page or folder during the session. Clicking My collection while already inside returns to Overview. First entry starts on Overview. Collection switches pause whole sources without changing individual deck selections or picker exclusions; “Only this” isolates one collection across all viewer modes.
- Overlapping enabled collections form a unique union of decks. Direct deck links may belong to Individual decks even when the same deck appears in another collection.
- Fresh profiles start with Official Commander precons: a dated, complete snapshot curated by Archidekt. Use precons/catalog in user-facing copy, never demo. Hiding it preserves personal overlaps; showing it again keeps selections and exclusions. Opening source setup never removes or pauses existing collections.
- My collection uses the same readable normal-case title as Help. Add decks is the single setup entry; accept a username, profile, folder or deck link without an Account/Folder/Deck mode switch.
- Username and folder discovery previews public folders before saving. Use compact artwork previews, direct-deck counts and expandable individual choices. Nested folders have separate rows and visible paths; selecting a row does not silently include descendants. The explicit Show only these folders option pauses other collections on successful import, preserving their saved choices. Selection is fixed; do not imply automatic following.
- “Included precons” remains the original 29 requested decks with bundled artwork for legacy profiles. Never silently expand existing profiles. Official Commander precons is the one precon collection: pick single precons inside it, and its header links to Archidekt’s precon page. Do not add a second “browse the catalog” source or button beside it. The bundled snapshot is its baseline; Refresh in its header adds precons Archidekt listed since (newest first) to the same collection. They show at once unless the user has unticked precons before, then they wait to be ticked. Profiles without it get one Add Official Commander precons action.

- The three-page quick guide is Help's Start here section. Never open it automatically; first visits get the offer below. Use large visual examples and one short caption per page; no tutorial banner above the collection and no paragraphs of instructions. Its final action adds the official precons only when absent, otherwise opens their selection without changing saved choices. Shared collection entry behavior is tracked separately in #24.
- First visit (#54, owner decision October 18): a fresh profile gets "New? ✕" once, in plain gold text just left of Help. It takes no row of its own and is not a pill, badge or banner. New? opens the same three pages in a small popover under the header buttons, so the collection stays in view; ✕, Escape or clicking elsewhere closes it. ✕ on the offer ends it for good. Show it only when there is no saved collection or seen marker and storage can save the marker, so existing profiles, restored backups and blocked storage never see it. Tried in the app and not chosen: a corner card, a slim line above the collection, a gold pill, a New tag on Help, going to Help → Start here, and opening the guide automatically.
- Help (#52) is a workspace like My collection, opened from the single Help button beside My collection at every width. Sections have their own addresses (`/help/<section>`) and icons. The sidebar is a small folder tree with a full-height divider, lined up with the header: Start here (the tour plus common tasks), Core (Adding your decks, Showing and hiding, Keeping decks up to date, Finding and picking, Saving and devices), FAQ, and Project (Features, Roadmap, About). Folders open art-led tiles that preview each topic's figure; folds are remembered; topics show a breadcrumb.
- Help explains rules the interface can't show (what imports, what each collection control keeps, what refresh changes, how the pick pool is formed, what a backup holds), never the buttons users already see. Check claims against the code before writing them. Each topic pairs a short lead and numbered rules (text column about 620px, roughly 75 characters per line) with an explanatory figure built from bundled artwork and simplified app controls whose numbered callouts match the rules. Wide screens fill with the figure, never with longer lines; below 1280px the figure sits under the lead. The FAQ is grouped by situation and links each answer to its topic. Roadmap mirrors `src/data/roadmap.ts`; keep it in step with the open issues. About, Roadmap and the FAQ link to `github.com/Bircck/DeckShelf` (source and issues), the name the public repository keeps (#36); those links won't open for other people until it is public. Features is three compact groups (Browse, Pick, Your shelf) of rows with small artwork thumbnails, not large image tiles. While Help is open, no view tab is highlighted.

## Motion and atmosphere

- Backgrounds stay steady while browsing Collection, Cards, and Pick a deck. Do not change them on hover, keyboard focus, carousel selection, or an idle timer.
- Winner artwork and mana lighting may appear once a deck has been selected. Keep the reveal brief and restrained.
- Hover has subtle feedback and gentle tilt. No mouse-following glare, bright gold outlines, or large hover lifts.
- The picker opens with a card front-center at a consistent height. Do not randomize its starting angle or introduce independent vertical drift.
- Manual dragging follows one screw path: vertical movement and rotation remain coupled.
- Preserve the spacing established by the seven-deck pool. Larger collections extend the loop outside the viewport instead of packing cards closer together.
- Small pools repeat in deck order on each strand: A, B, C, D, then repeat. Do not group repetitions into runs of the same deck.
- Visual repetitions never alter the unique eligible pool or its equal selection odds.
- Variation belongs in the actual spin's distance and duration. Respect reduced-motion settings throughout.
- The reveal has one soft glow centred on and sized by the card, in every presentation and for every seat. It carries the deck's mana colours; no other coloured light goes with a result (fixed corner lights in the window background never lined up with the card, so they were removed). Do not put a filter on the helix: it flattens the 3D and makes every card jump. Dim the spiral by easing card opacity instead, both into a result and back out.

## Before shipping a visual change

Ask whether it helps identify a deck, understand an action, or enjoy the collection. Check that it preserves the accepted layout, calm background, restrained hover, and centered picker. Inspect small and large filtered pools when touching the spiral. Avoid unrelated visual changes bundled into a fix.

## References

- [Nielsen Norman Group: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) — reduce low-value visual noise while preserving useful information and distinctive aesthetics.
- [Nielsen Norman Group: Icon Usability](https://www.nngroup.com/articles/icon-usability/) — choose understandable symbols and provide labels when meaning is not obvious.

The concrete rules above reflect this project's owner feedback; the references support the general design principles, not claims that a particular font or icon proves AI authorship.

### Collection workspace refinement — October 5

- Overview contains collection switches and optional folder summaries, without a duplicate deck grid. All saved decks is the combined deck view; individual sources/folders retain their own views.
- Built-in collections (official/included precons and individual decks) have sidebar switches just like imported sources.
- Keep the workspace header compact. Avoid repeated counts, instructions and snapshot dates above deck results; retain useful folder scope and direct-deck context.

### Box overview and flat controls — October 8

- Use a compact artwork-led collection box grid on Overview. Preview images come from saved commander artwork in that source, never generated replacements. Empty sources have an honest empty state. Opening a box enters its source; source switches remain independent.
- Keep the original pill switches for collection enable controls, including the sidebar and overview boxes. Underlined layout choices and compact rectangular action buttons remain. Preserve accessible switch semantics, keyboard operation and focus indicators.
- Align sidebar icons, labels, counts and switches in consistent columns. Keep folder rows compact, with modest indentation and short direct-deck labels.
- Picker interaction alternatives remain exploratory; this visual pass does not change the picker flow.

### Folder pause and subfolder controls — October 8

- Parent pills pause and resume the previous enabled folder subset. Keep explicit Enable all folders / Disable all folders actions in the folder scope, separate from pause/resume.
- Show original pill controls on subfolders and Direct decks by default. Show folder switches lets users hide them. Remember the preference locally and preserve compact aligned columns.
- Partially enabled parents use a centered pill thumb, an accessible description, and Some in the overview. Sidebar and overview counts report active decks in that scope, falling to zero when paused; source On display filters respect source enable state and overlapping membership. Saved deck selections remain intact.
- Ctrl-click (Cmd-click on Mac) on a parent pill enables every child when any child is off, and disables every child when all are on. This overrides remembered subsets. Normal click keeps pause/resume semantics; explicit Enable all folders / Disable all folders remain available for touch and keyboard users.

### Temporary picker shortlist — October 8

- DeckShelf is a shelf for browsing and choosing what to play. Remove persistent picker inclusion/exclusion controls from gallery and saved-deck cards.
- Every active deck matching the current filters is eligible by default. Legacy exclusions remain in v1 backups without affecting current eligibility.
- Select decks in the main Collection creates a temporary shortlist. Click/tap or Shift-click a range, Select visible, Clear selection, and Pick from these. All shelf cards stay visible; selected cards are marked. Pick from these opens the existing picker with that pool.
- Shortlists are session-only and intersect the current active/filtered shelf. An empty intersection must not silently pick outside the shortlist. Clearing or reloading restores default eligibility. Saved folder choices stay independent.
- Quick choice uses a visible dice-labeled Choose a few entry button. During selection, one primary Pick from N action carries the useful count; secondary edit/done, select-visible and cancel actions use icons with accessible names and tooltips. Use check marks on selected cards instead of repeated Selected labels. Show out-of-view selection counts only when relevant.
- Replace ambiguous checkmark/pointer mode icons with Done / Choose decks labels and an All action. Keep the quick-choice actions together in a restrained charcoal toolbar; use small numbered shortlist markers and a fine warm border on selected cards instead of check badges.
- Reserve a stable quick-choice toolbar footprint so entering selection does not move the controls or layout selector. All toggles visible decks on; None deselects visible decks while keeping selection mode open and preserving selections outside the view. X clears and exits.
- Number shortlisted cards by the current displayed order, updating after sorting/filtering or deselection. The quick-choice bar fits its contents, has no appearing outer border, and keeps a stable left edge; do not reserve a visibly oversized bar.
- Quick-choice entry, empty selection and Pick from N share identical button dimensions, typography and icon sizing.
- Remember collapsed folder branches and Overview folder-summary expansion locally across navigation and reload. Search may reveal matching branches temporarily without replacing saved folds; invalid/unavailable browser storage must fall back safely.
- My collection actions use compact rectangular buttons with familiar icons and visible labels. Keep folder navigation lightweight, and preserve keyboard focus indicators.
- Keep shortlist clearing visually consistent across browsing views. In the picker, a selected-count button returns to Collection to edit the same shortlist.
- Instant pick controls only the selection animation, independently of automatic drift. Paused drift still permits manual drag momentum to coast and decay. System reduced-motion preferences start with drift paused and instant picking, and suppress passive release motion while paused.

### Shared quick-choice controls

- Use one shared component across Collection, Cards and Pick a deck. The centered N selected button always reports total shortlist size and edits that shortlist; Picker with a right arrow is a separate navigation action, clearly distinct from actually picking a deck. Clear keeps the same appearance and behavior everywhere.
- The count button's pressed state indicates card selection mode; click it again to finish selection. All / None is available while editing. Out-of-view selections are explained separately, and only currently active, filtered selections can be picked.
- Verify selected-count wording, dimensions, font metrics and desktop position across all views together to avoid per-view styling drift.


- Individual decks have one show/hide selection control only; no separate Disable state or button. Keep the Archidekt link beside the selection control, without an extra footer row. Cards only and Compact use one small overlay control group. Avoid growing per-card button clusters.

### Phone control grouping revision

- On phones, align deck count and quick-choice entry on one summary row; group view modes above a shared size/sort row. Keep the entry and count anchored when selection reveals its action row, without reserving an empty band. Desktop toolbar remains unchanged.
- My collection groups layout, size, count and All/None in two rows. Collection actions follow Collection controls (October 15) at every width.
- Narrow picker stages use proportionally smaller cards, reduced perspective enlargement and greater separation. Preserve desktop geometry, equal picking odds, screw-path dragging and reduced-motion support. Intentional helix layering remains.

### Compact phone browsing controls (October 8)

- The header carries only Help and My collection beside the view switch, on phones too.
- Phone color identity/exact controls live in Filters. Active filters retain their indicator and removable chips.
- Keep Details / Cards only / List in a slim, visibly bounded button group. Size and sort expand together from its adjacent control; do not leave a floating sort row by default.
- Quick choice is compact until selection actions are needed. An inactive phone picker shortlist occupies no row; clearing it reclaims space while preserving scene dimensions. Desktop toolbar stability remains unchanged.

### Segmented quick choice (October 12)

- Phone and desktop look and work the same. The only phone-specific browsing difference is folding size and sort behind the small button beside the view switch.
- Quick choice is one segmented group styled like the view switch, in the order close (✕), entry (Choose a few / Select cards / N selected), All while editing, then the gold Picker at the far edge. Every segment shares one height; close is icon-only everywhere.
- The deck count always holds the left edge. Quick choice is only as wide as its segments: left-aligned directly beside the count on desktop, right-aligned on phones. Do not float it in an empty slot or stretch it to fill the row. When active, close takes its space from the entry, so close plus entry cover the idle Choose a few width; actions extend away from the aligned edge (right on desktop, left on phones). Owner decision after comparing six in-app variants.
- Segments keep comfortable padding on typical phones (360px and up); only the narrowest phones (370px and below) use compact sizes and shorten a filtered count to "49 of 184". Segments never shrink below their content.
- Pause drift and Instant pick sit under the Pick a deck button inside the stage, hidden while a result shows. Phones keep them in the picker's Options menu (see Picker controls, October 18).
- The view switch is the same bordered segmented group at every width.
- Search focus outlines the whole search bar in muted gold. The icon, hint text and Filters share the bar's exact vertical centre.
- Header logo, results row and quick-choice position are identical across views; no per-view header or toolbar overrides.
- The phone picker stage fills the remaining viewport without page scroll; the revealed card sits fully above the result panel.
- After a backup is chosen, the restore confirmation scrolls into view and takes focus.


### Collection controls — October 15

Owner decision (#56): the pill, Disable, Remove precons and Disconnect overlapped and felt random. There are now three things you can do to a collection:

- **Pill (On/Off/Some)**: a quick show/hide that Enable all undoes. Always visible.
- **Hide**: for something you don't want to look at. It is switched off, leaves the sidebar tree and the overview grid, and waits in a folded Hidden section at the bottom of the sidebar. That section mirrors the sidebar tree (same columns, indentation, folds and counts), with an eye Show button where the pill would be. Never flatten folders into long path labels or let the sidebar scroll sideways. Enable all skips it. Show (in the list, or on its own page) brings it back on with its deck choices intact. Works the same for imported sources, folders, Individual decks and precons. Precons can only be hidden, never removed (they keep the v1 `demo.removed` flag).
- **Remove**: for something you don't want at all, such as a mistyped username. It removes the source and the saved decks only it had straight away, without asking; decks another source or Individual decks still has stay. A notice names what went ("Removed birckk and its 33 saved decks.") with Undo for 9 seconds. Undo restores the collection exactly as it was, and only while nothing else has changed since. Imported sources only.
- Hide and the pill stay silent: their result is visible where you clicked (owner, October 16). Remove is the only local action with Undo (owner, October 18, #57).

Layout, the same on overview boxes, source headers and phones:

- Box: title and pill on top; then the active count, Only this and a ⋯ More menu on one row.
- Header: pill and Only this on the left; Refresh (sources only) and ⋯ More at the far edge. A hidden collection shows Hidden · Show in place of the pill.
- More holds the rarer actions in a fixed order: All folders on / All folders off (folder scopes), Hide, Remove. The menu supports arrow keys and Escape and returns focus to its button.
- Do not reintroduce Disable/Disconnect/Remove precons synonyms, a phone-only Actions toggle, or a restore banner.

### Notices (October 18)

- Notices use [Sonner](https://sonner.emilkowal.ski/), styled in DeckShelf colours: dark green panel, faint gold border, gold icon and gold-outlined action button. The owner compared it in the app with a restyled hand-made stack and preferred Sonner (#57).
- They sit at the bottom centre, at most three at a time, stacking and expanding on hover. Timers pause on hover or focus, and reduced motion turns the animation off.
- Use them for results the user can't see where they clicked (deck added, backup downloaded, refresh done) and for Undo after Remove. Toggles and Hide don't notify.
- Errors from collection actions that finish away from their button (adding folders or selected decks, refreshing a source, updating precons, reading a backup file) are problem notices: warm brown, a warning icon, `role="alert"`, and they stay until dismissed. When some decks failed to load, the notice says how many and its Show button jumps to the failures list, which keeps the detail. Errors in the Add decks form, deck refresh errors in deck details, and backup-restore errors stay inline beside their controls.
- While a modal dialog is open, notices render inside it so they show above its backdrop.
- While notices show, the page gets matching room at the bottom so the last controls (Export backup, Restore backup, Done on a phone) can scroll clear of them. Keep this when changing notices.

### Offline artwork (October 15)

- When commander art can't load, show the dragon nest (`src/placeholders/NestArt.tsx`): the familiar coiled around five mana orbs. Each colour in the deck's identity shows its symbol, and missing colours stay as empty sockets. Colourless decks show the colourless symbol in the centre. Below it go the commander name and *Offline* when the device is offline. The picker shows only the art because its caption already names the deck. Explore visuals by generating many image ideas around the mana symbols, then convert the owner's pick to SVG (see the exploration in issue #62).
- Installed-app icons (`public/icons/` and the Windows app's `desktop/icon.ico`) are the header mark, `brand-familiar.svg`, rendered unchanged at 82% on a charcoal tile (#111214, the app background, so the ivory mark stands out) by `scripts/app-icons.mjs`. Windows and desktop-install icons are rounded (24% corners, transparent outside) to sit with other apps on the taskbar; iOS and Android icons stay full-bleed squares because those systems shape them. Never recolour the mark for icons. The owner compared five tiles (charcoal, gold rim, slate, card-table green, oxblood) and chose charcoal with a larger mark after seeing slate on the taskbar. Seasonal tiles are only a loose idea (#71). The browser tab keeps `favicon.svg`.

### Windows app window bar (October 15)

- The Windows app has no native title bar or menu bar. A slim 34px bar (#0e0f11, a shade darker than the header) sits above the unchanged DeckShelf header, drags the window and stays put while the page scrolls. Windows draws the minimize, maximize and close buttons on its right.
- At its left, a ≡ button opens a fold-out menu like the Claude desktop app: File (Export backup, Exit), View (zoom, full screen), Go (the main views, Search and My collection) and Help (DeckShelf Help, About). Licence and notice files ship in the app folder; they get no menu items (owner decision). List only actions that mean something in DeckShelf; no Edit menu or Undo/Cut/Paste (text fields keep their usual shortcuts). Do not merge the window buttons into the DeckShelf header; the owner tried that and found it clunky.
- Browsers and the installed web app never show the bar. Views that fill the screen size from `--app-height`, so the bar doesn't add a page scroll.

### Picking for several players (October 16)

Owner decisions for #34, after comparing variants in the app:

- Seat icons above the Pick button set 1–4 players. The count is remembered and never exceeds the pool; larger counts are disabled with the reason stated. One player keeps the single-deck reveal.
- Stop on each: one long spin to the first chosen deck, a short hold, then shorter turns on to the others in the order they come up on the spiral. Each chosen deck stays lit with its Player label and joins a list at the top. A slow crawl past each deck, lighting decks as one spin passes them, and dealing on top of the helix were tried and rejected.
- Results show as a row of full cards labelled Player 1–4, with name and mana symbols under each; two by two on narrow stages. Fan and table layouts may come back as settings later.
- Shuffle-and-deal belongs in its own presentation, not on the helix (#76). Owner's picks after comparing variants (October 18): it is a picker setting (Helix or Shuffle, remembered like the player count), the eligible decks gather from a collection grid, and the result is #34's seat row. A separate Shuffle mode beside Pick a deck, an abstract pile of card backs and cards left angled on the table were rejected.

### Picker controls (October 18)

Owner feedback on #76: the glow was off-centre, the phone picker looked crowded, and Pick format moved around between views and presentations.

- Every picker presentation shares one frame: the same height, a bar across the top of the stage and the dock at the bottom. The bar holds the Picker dropdown (Helix or Shuffle) on the left and the Pick format dropdown with the eligible count on the right. The dock holds the player count, the Pick button and the motion options, in that order. Nothing moves when switching presentation or picking.
- Phones (550px and below) and phones in landscape (500px tall and below) fold the bar, the player count and the motion options into one Options button at the top right of the stage. It names the current choice (for example "2 players · Commander") and opens a small panel, where Helix and Shuffle are two buttons (owner liked this); Escape or a tap outside closes it. The stage then keeps only the Pick button below.
- In landscape the stage fills the screen once scrolled to, and picking scrolls it into view.
- The Pick button keeps one width while it reads "Choosing your deck…". The shuffle's table keeps its size through the deal, flip and result.
- Instant pick is shared by both presentations for the session; switching keeps it.

### Phone pre-pass feedback (October 17)

- Cards has no Pick a deck button of its own. Picking is reached from the view switch, and a shortlist from Quick choice's Picker; a second entry under the arrows only added clutter.
- On phones Help keeps one slim heading row: a menu button left of the Help title that folds out the section tree (as on docs sites like Obsidian Help), and Back at the right end. This mirrors desktop, where the tree is on the left and Back to collection on the right; the menu and Back side by side read as twin icons. The open menu replaces the page (☰ turns into ✕), so a phone shows either the tree or the topic, never both. The page title follows the row directly, with a plain icon instead of a boxed one. No separate section-picker row.

### List table (October 17)

Owner decisions for #91, after comparing variants in the app three times: the artwork (none, a square thumbnail, a wide art strip), how columns are chosen, and how sorting is chosen.

- List is one shared table on Collection and My collection: a small square commander thumbnail, then Name, Commander(s), Colors (mana symbols), Tags and Release (set, with the year under it). Tags shows up to three tags and drops out when no deck in the results has any. A Format column after Colors appears only when the results hold a format other than Commander (for example with All formats); decks without commanders show a dash there and their featured card as the thumbnail. My collection adds the Shown checkbox as the first column, under Select all, and the Archidekt link as the last. Status notes such as Not added or Collection off · selection kept sit under the name.
- Settings › List (#92) chooses the columns (Name is always on; Collection, which names the enabled collections a deck is shown from, is off by default), the one extra phone column (Colors by default) and the row artwork (square thumbnail by default, a wide art strip, or none). Like card backs, the choices are saved with the collection and only non-default ones are stored. The table itself has no column menu, so the toolbar stays the same in every layout.
- A row click does what the row's own control does: open the deck, select it while choosing a few (Shift-click selects a range) or toggle Shown. Shortlisted rows show the numbered marker before the name and a fine warm rule.
- Sorting is a field menu (Collection order, Name, Commander, Release, Colors) with a direction button beside it that names the order in the field's own words: A–Z / Z–A, Newest / Oldest, Fewest / Most. Collection order has no direction button. It sits in the toolbar for every layout, inside Size and sort on phones. In List, the Name, Commander, Colors and Release headers drive the same sort: a click picks the field, and a second click reverses. A single menu that listed every field in both directions was compared and dropped, since it doubles with each new field. Every field has a direction button, including Collection order (As listed / Reversed), so the toolbar never shifts; Format and Collection name sort too, from their headers or the menu.
- S/M/L sets row height and thumbnail size. Phones show the thumbnail, the name with its commander under it, and the phone column from Settings.

### Settings layout (October 18)

Owner decision after comparing folding rows, tabs and a compact page in the app: Settings (Help › Settings) is one folding row per group (Card backs, Artwork, List). Each row shows its icon, title and current value ("Dragon nest", "6 columns · Colors on phones · Square thumbnail") and opens to its controls; open rows are remembered. A flat page buried List under the card-back previews. On phones the value sits under the title. A new group is one more row.
