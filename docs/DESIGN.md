# Design direction

Public name: **DeckShelf**. Subtitle: **Commander collection**. Keep it short.

DeckShelf is a personal Commander collection viewer and deck picker. Its character comes from actual Magic cards, commander artwork, mana symbols, and the spatial carousel. Preserve the dark card-studio look the owner likes. Improve specific details instead of periodically redesigning the whole app.

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

- The cards and collection should dominate the page. Keep navigation, filters, and controls compact.
- Show a simple deck total by default. Show the full collection total when results differ, and a separate picker count only when exclusions make it different.
- Keep shared navigation, search, and deck counts anchored across views. Avoid an isolated extra row of Collection controls with wasted space; reserve scrollbar space so switching views does not shift the page sideways.
- Use one compact row below search: count left, view-specific controls right, wrapping on phones. Give the controls a little breathing room below search.
- Open Collection on each visit, refresh, or logo click; use the same home-view definition for these entry points so the displayed view and active navigation stay in sync; the Cards and picker views remain available from navigation.
- Filters drop down beside their trigger; they do not open a modal.
- Collection offers Details, Cards only, and List with adjustable size. Cards only at Medium size is the default; remember a user's explicit choice.
- Details has compact information below the card, without reserved blank title space. Keep names, releases, mana symbols, and picker inclusion easy to locate.
- The pick button floats over the spiral. Do not restore a large footer console that consumes carousel space.
- Picker motion controls sit beside the shared deck count. Do not restore a separate status/control strip above the picker scene.
- Do not remove useful spacing or flatten everything in the name of being “less AI.” Preserve readability and the distinctive card presentation.

## Collection management

- Owner direction for the next prototype: give My collection its own workspace, entered from the existing My collection control. Preserve the main Collection, Cards, picker, shared search, Guide and About. Management uses its own source/folder search and a clear return to the gallery; do not repurpose the Collection gallery tab. Explore a folder navigator with adjustable card/list views, separate source switches, and individual deck imports. Combining sources preserves their identity and selections; a unique display union is not a single flattened saved collection. The isolated collection-corner prototype is exploratory, not a shipped navigation change.
- Reuse the main collection's layout controls and mana components in the management workspace. Cards only shows full card faces; square artwork without captions is a separate Compact option. Keep the overview's compact source switches, with optional folder expansion inside a bounded scroll area so long source lists do not consume the page.


- Guide and About dialog titles use readable normal-case text, not tiny letter-spaced labels. Keep the whole guide card fan visible. All three guide pages share a stable dialog height and navigation position at each viewport size. About uses short purpose/benefit bullets and direct actions rather than paragraphs.
- All dialogs use the shared Modal title treatment. Deck details keep readable metadata, full commander cards, compact source/refresh actions, and one saved-snapshot date; avoid explanatory filler and empty tag spacing. Check shared dialog changes against deck details, About, Guide and My collection.
- Do not show a precon attribution/start-collection strip above search. Keep precon information in My collection and the optional guide.
- My collection controls the showcase. Deck editing and card inventory stay on the external platform.
- Public accounts, folders, and individual deck links are read-only sources. Do not ask for platform passwords.
- Discovering a source does not mean the user owns all its decks. New discoveries wait for selection; refresh preserves display and picker choices.
- Distinguish local saved decks, starter precons, and source listings. Deduplicate decks shared by multiple sources.
- Disconnecting a source or losing access to it must not delete saved decks. Keep the last usable snapshot when refresh fails.
- Preserve the version-1 collection backup format and existing local choices. Include source connections in exports.
- Select all / Deselect all affect the current deck results, including search and status filters. New source entries are staged until Add selected decks; bulk actions preserve choices outside the results. Keep list controls compact, with no repeated introductory banner.
- My collection reopens the last visited page or folder during the session. Clicking My collection while already inside returns to Overview. First entry starts on Overview. Collection switches pause whole sources without changing individual deck selections or picker exclusions; “Only this” isolates one collection across all viewer modes.
- Overlapping enabled collections form a unique union of decks. Direct deck links may belong to Individual decks even when the same deck appears in another collection.
- Fresh profiles start with Official Commander precons: a dated, complete snapshot curated by Archidekt. Use precons/catalog in user-facing copy, never demo. Removing it preserves personal overlaps; restoring it keeps selections and exclusions. Opening source setup never removes or pauses existing collections.
- My collection uses the same readable normal-case dialog title as Guide and About. Add decks is the single setup entry; accept a username, profile, folder or deck link without an Account/Folder/Deck mode switch.
- Username and folder discovery previews public folders before saving. Use compact artwork previews, direct-deck counts and expandable individual choices. Nested folders have separate rows and visible paths; selecting a row does not silently include descendants. The explicit Show only these folders option pauses other collections on successful import, preserving their saved choices. Selection is fixed; do not imply automatic following.
- “Included precons” remains the original 29 requested decks with bundled artwork for legacy profiles. Never silently expand existing profiles. Browse precons previews Archidekt’s catalog without selecting it; adding the demo is a separate explicit action.

- The Collection guide is an optional three-page dialog opened from a small Guide button beside My collection, or Help. Never open it automatically. Use large visual examples and one short caption per page; no tutorial banner above the collection and no paragraphs of instructions. Its final action adds the official precons only when absent, otherwise opens their selection without changing saved choices. Shared collection entry behavior is tracked separately in #24.

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

## Before shipping a visual change

Ask whether it helps identify a deck, understand an action, or enjoy the collection. Check that it preserves the accepted layout, calm background, restrained hover, and centered picker. Inspect small and large filtered pools when touching the spiral. Avoid unrelated visual changes bundled into a fix.

## References

- [Nielsen Norman Group: Aesthetic and Minimalist Design](https://www.nngroup.com/articles/aesthetic-minimalist-design/) — reduce low-value visual noise while preserving useful information and distinctive aesthetics.
- [Nielsen Norman Group: Icon Usability](https://www.nngroup.com/articles/icon-usability/) — choose understandable symbols and provide labels when meaning is not obvious.

The concrete rules above reflect this project's owner feedback; the references support the general design principles, not claims that a particular font or icon proves AI authorship.

### Collection workspace refinement — October 5

- Overview contains collection switches and optional folder summaries, without a duplicate deck grid. All saved decks is the combined deck view; individual sources/folders retain their own views.
- Built-in collections (official/included precons and individual decks) have sidebar switches just like imported sources.
- Precon removal must visibly explain that it is reversible. Keep removed precons as a compact clickable Disabled row; open it to enable again, preserving selections.
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
- Imported collection boxes and aggregate folder scopes offer Remove… with a clear Remove collection action. Disconnect the affected sources while keeping saved copies in Individual decks; explain that the source can be added again. Do not delete local deck snapshots.
- Remember collapsed folder branches and Overview folder-summary expansion locally across navigation and reload. Search may reveal matching branches temporarily without replacing saved folds; invalid/unavailable browser storage must fall back safely.
- My collection actions use compact rectangular buttons with familiar icons and visible labels. Keep folder navigation lightweight, and preserve keyboard focus indicators.
- Keep shortlist clearing visually consistent across browsing views. In the picker, a selected-count button returns to Collection to edit the same shortlist.
- Instant pick controls only the selection animation, independently of automatic drift. Paused drift still permits manual drag momentum to coast and decay. System reduced-motion preferences start with drift paused and instant picking, and suppress passive release motion while paused.

### Shared quick-choice controls

- Use one shared component across Collection, Cards and Pick a deck. The centered N selected button always reports total shortlist size and edits that shortlist; Picker with a right arrow is a separate navigation action, clearly distinct from actually picking a deck. Clear keeps the same appearance and behavior everywhere.
- The count button's pressed state indicates card selection mode; click it again to finish selection. All / None is available while editing. Out-of-view selections are explained separately, and only currently active, filtered selections can be picked.
- Verify selected-count wording, dimensions, font metrics and desktop position across all views together to avoid per-view styling drift.

- Reversible Remove precons remains available. Removed precons appear as a compact clickable Disabled row; open it to enable again. Do not bring back the large restore banner.
- Temporary collection on/off choices and persistent collection Disable are separate. Disabled collections stay excluded from Enable all, survive reload and backup, and retain their previous choices. Show explicit Enable controls inside disabled collections . Removing source connections stays separate and keeps saved snapshots.

- Individual decks have one show/hide selection control only; no separate Disable state or button. Keep the Archidekt link beside the selection control, without an extra footer row. Card-only/Compact layouts use one small overlay control group. Avoid growing per-card button clusters.

### Phone control grouping revision

- On phones, align deck count and quick-choice entry on one summary row; group view modes above a shared size/sort row. Keep the entry and count anchored when selection reveals its action row, without reserving an empty band. Desktop toolbar remains unchanged.
- My collection groups layout, size, count and All/None in two rows. Keep the collection switch visible; infrequent source/disable/remove controls open through Actions. Disabled collections still show their Enable action directly.
- Narrow picker stages use proportionally smaller cards, reduced perspective enlargement and greater separation. Preserve desktop geometry, equal picking odds, screw-path dragging and reduced-motion support. Intentional helix layering remains.

### Compact phone browsing controls (October 8)

- Phone utilities fold Guide/About into Help; My collection stays directly available.
- Phone color identity/exact controls live in Filters. Active filters retain their indicator and removable chips.
- Keep Details / Cards only / List in a slim, visibly bounded button group. Size and sort expand together from its adjacent control; do not leave a floating sort row by default.
- Quick choice is compact until selection actions are needed. An inactive phone picker shortlist occupies no row; clearing it reclaims space while preserving scene dimensions. Desktop toolbar stability remains unchanged.

### Segmented quick choice (October 12)

- Phone and desktop look and work the same. The only phone-specific browsing difference is folding size and sort behind the small button beside the view switch.
- Quick choice is one segmented group styled like the view switch, in the order close (✕), entry (Choose a few / Select cards / N selected), All while editing, then the gold Picker at the far edge. Every segment shares one height; close is icon-only everywhere.
- The deck count always holds the left edge. Quick choice is only as wide as its segments: left-aligned directly beside the count on desktop, right-aligned on phones. Do not float it in an empty slot or stretch it to fill the row. When active, close takes its space from the entry, so close plus entry cover the idle Choose a few width; actions extend away from the aligned edge (right on desktop, left on phones). Owner decision after comparing six in-app variants.
- Segments keep comfortable padding on typical phones (360px and up); only the narrowest phones (370px and below) use compact sizes and shorten a filtered count to "49 of 184". Segments never shrink below their content.
- Pause drift and Instant pick sit under the Pick a deck button inside the stage at every width, hidden while a result shows.
- The view switch is the same bordered segmented group at every width.
- Search focus outlines the whole search bar in muted gold. The icon, hint text and Filters share the bar's exact vertical centre.
- Header logo, results row and quick-choice position are identical across views; no per-view header or toolbar overrides.
- The phone picker stage fills the remaining viewport without page scroll; the revealed card sits fully above the result panel.
- After a backup is chosen, the restore confirmation scrolls into view and takes focus.
