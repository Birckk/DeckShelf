# Design direction

Public name: **DeckShelf**. Subtitle: **Commander collection**. Keep it short.

Commander Archive is a personal Commander collection viewer and deck picker. Its character comes from actual Magic cards, commander artwork, mana symbols, and the spatial carousel. Preserve the dark card-studio look the owner likes. Improve specific details instead of periodically redesigning the whole app.

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

- Guide and About dialog titles use readable normal-case text, not tiny letter-spaced labels. Keep the whole guide card fan visible. All three guide pages share a stable dialog height and navigation position at each viewport size. About uses short purpose/benefit bullets and direct actions rather than paragraphs.
- Do not show a precon attribution/start-collection strip above search. Keep precon information in My collection and the optional guide.
- My collection controls the showcase. Deck editing and card inventory stay on the external platform.
- Public accounts, folders, and individual deck links are read-only sources. Do not ask for platform passwords.
- Discovering a source does not mean the user owns all its decks. New discoveries wait for selection; refresh preserves display and picker choices.
- Distinguish local saved decks, starter precons, and source listings. Deduplicate decks shared by multiple sources.
- Disconnecting a source or losing access to it must not delete saved decks. Keep the last usable snapshot when refresh fails.
- Preserve the version-1 collection backup format and existing local choices. Include source connections in exports.
- Select all / Deselect all affect the current deck results, including search and status filters. New source entries are staged until Add selected decks; bulk actions preserve choices outside the results. Keep list controls compact, with no repeated introductory banner.
- Open My collection on its showcase overview. Collection switches pause whole sources without changing individual deck selections or picker exclusions; “Only this” isolates one collection across all viewer modes.
- Overlapping enabled collections form a unique union of decks. Direct deck links may belong to Individual decks even when the same deck appears in another collection.
- Fresh profiles start with Official Commander precons: a dated, complete snapshot curated by Archidekt. Use precons/catalog in user-facing copy, never demo. Removing it preserves personal overlaps; restoring it keeps selections and exclusions. Start my collection removes the demo and opens the public-source form.
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
