# Deck format adapter

Archidekt format IDs were audited on 2026-10-16 against its published search client:
https://archidekt.com/search/decks and
https://cdn.archidekt.com/_next/static/chunks/pages/_app-4f8fc056fe04747b.js
(the `S` format-name map). This is an upstream implementation detail, not a stable API contract.

`shared/formats.mjs` maps IDs 1–18 and 20–27 to the exact current names. ID 19 is not listed. Missing, malformed and unlisted IDs are explicitly Unknown; numeric unlisted IDs are retained and scoped separately. Commander variants and Brawl remain separate formats, never aliases of Commander.

Version-1 snapshots and source entries without `format` retain their original bytes and mean Commander through `formatOf`. New upstream snapshots store `{ id, name, sourceId }`. This additive migration preserves hidden/excluded IDs, source membership, selections, built-in precons and v1 backup shape without resaving card artwork or expanding a collection.

Non-Commander decks may have no commanders. `cover` then stores separate featured-card artwork or a labelled fallback. Views use `coverOf` and preserve the original commander/partner artwork for old snapshots. A source's featured card remains editable on Archidekt; DeckShelf does not edit decklists or select an arbitrary first card.

Folder setup initially requests Commander-only discovery. Choosing All formats (or another format) makes an additional full-listing request, subject to the same limits; subsequent preview filters reuse that listing. A failed widening request leaves the Commander preview and selections intact. Unrelated formats therefore do not consume the default preview's aggregate deck limit.

Saving only Commander keeps new sources restricted on refresh. All-format selections save `formatScope: all`; absent scope on existing sources means Commander. Re-adding a Commander deck does not narrow an existing all-format connection or discard its other listing entries. Before widening a legacy source's known IDs, imports materialize its previous membership so already-saved decks in other collections cannot become silently selected. Selection filters never clear choices outside their results. Catalog discovery remains strictly Commander.

The shelf defaults to Commander and allows All or actual formats. The picker has no All scope: it starts with the shelf/shortlist's single format, otherwise Commander, and applies search, colour and shortlist constraints within that explicit scope. Unknown numeric IDs stay separate. Format labels describe upstream metadata, not verified deck legality.

The trimmed real Modern fixture (`tests/fixtures/archidekt-modern.json`) was read from public deck 25228988 on 2026-10-16, after a single format-filtered listing request and a pause. Only the first three card rows were retained, so its card count is intentionally incomplete. Other format/error cases are synthetic mutations and do not claim live source validation.
