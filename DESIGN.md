# Design direction

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
- Do not restore the repeated `COMMANDER ✦` stamps on every carousel card.
- Keep meaningful labels on unfamiliar controls. Preserve visible keyboard focus even when mouse hover styling is subtle.
- Keep Outfit and DM Sans, the charcoal palette, and restrained warm accents. No font is inherently an “AI font”; do not churn typography to follow a generic banned-font list.
- Avoid unsolicited neon gradients, glowing borders everywhere, nested decorative panels, oversized hero banners, and repeated badges with no purpose.

## Layout and density

- The cards and collection should dominate the page. Keep navigation, filters, and controls compact.
- Filters drop down beside their trigger; they do not open a modal.
- Collection offers Details, Cards only, and List with adjustable size. Large is the default; remember a user's explicit choice.
- Details has compact information below the card, without reserved blank title space. Keep names, releases, mana symbols, and picker inclusion easy to locate.
- The pick button floats over the spiral. Do not restore a large footer console that consumes carousel space.
- Do not remove useful spacing or flatten everything in the name of being “less AI.” Preserve readability and the distinctive card presentation.

## Collection management

- My collection controls the showcase. Deck editing and card inventory stay on the external platform.
- Public accounts, folders, and individual deck links are read-only sources. Do not ask for platform passwords.
- Discovering a source does not mean the user owns all its decks. New discoveries wait for selection; refresh preserves display and picker choices.
- Distinguish local saved decks, starter precons, and source listings. Deduplicate decks shared by multiple sources.
- Disconnecting a source or losing access to it must not delete saved decks. Keep the last usable snapshot when refresh fails.
- Preserve the version-1 collection backup format and existing local choices. Include source connections in exports.
- Open My collection on its showcase overview. Collection switches pause whole sources without changing individual deck selections or picker exclusions; “Only this” isolates one collection across all viewer modes.
- Overlapping enabled collections form a unique union of decks. Direct deck links may belong to Individual decks even when the same deck appears in another collection.
- “Included precons” means the original 29 requested decks with bundled artwork. Keep that distinct from Archidekt’s larger curated precon catalog; browsing the catalog never selects decks automatically.

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
