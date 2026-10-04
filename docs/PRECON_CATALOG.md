# Precon catalog and demo profiles

The shipped `src/data/precons.json` is a complete metadata snapshot of the public
Commander decks owned by Archidekt_Precons, linked from
https://archidekt.com/commander-precons. It is not a list of all legendary cards.
The snapshot records its source, UTC completion date, page count, expected count
and normalized commander artwork URLs. Artwork is remote and needs connectivity;
missing images use the existing labeled fallback.

## Updating

Run `npm run catalog:update` with Node 22.12+ and internet access. Review the diff,
run `npm test` and `npm run build`, then ship through the normal release process.
There is no visitor-triggered catalog refresh and no scheduled upstream job.

Discovery constructs its own pagination URLs, verifies stable reported counts,
unique IDs, owner and Commander format, and checks membership again after fetching.
Fetching is sequential with 1.2 seconds between decks, a 20-second request timeout,
at most three attempts for rate limits, and a 15-minute overall budget. Retry-After
up to 60 seconds is respected; longer limits stop the update. Maximum 1,000 decks.
The shared adapter normalizes partners, color identity, artwork and deck metadata.

Any unavailable deck, invalid metadata, incomplete pagination or changed membership
fails the update and prints the affected IDs. The previous snapshot remains byte-for-byte
untouched; only a complete candidate is atomically renamed into place. A count drop
of more than 10% also fails for investigation. Do not mark a partial snapshot complete.
The UI shows the saved snapshot date, and warns when it is over 30 days old.

## Local profile rules

The collection storage key and version-1 backup envelope are retained. Optional
`starter` and `demo` fields distinguish new profiles from legacy profiles:

- No saved profile: `starter: false`, full demo enabled. No upstream deck API calls.
- Existing v1 profile or old backup without those fields: original 29-deck baseline,
  with all selections, exclusions, sources and switches preserved. No automatic expansion.
- Demo membership is a pinned snapshot saved with the profile and backup. A future
  shipped catalog never adds decks silently to an existing profile. Restore demo restores
  that profile's snapshot and choices; new opt-ins use the shipped snapshot.
- Demo off pauses its membership. Remove demo marks it removed, retaining its choices
  for restoration. Neither operation hides overlapping personal memberships globally.
- Personal source selections copy accepted metadata into `added`, including demo
  overlaps. Individual imports retain explicit `manualIds`. Disconnect keeps those
  snapshots as individual decks. Metadata refresh alone does not create ownership.
- Corrupt/unreadable storage runs in a temporary legacy view with a visible warning.
  Session changes do not overwrite it. Export retains the recoverable original bytes;
  explicitly confirming a valid backup restore unlocks writes.

Backups remain version 1 and old backups are accepted. The new optional fields are
understood by this release; older app versions cannot reproduce the full demo.
Source links and personal snapshots remain in the existing fields.

## Validation

`npm test` covers snapshot failure/atomicity and profile membership/migration.
`node scripts/smoke-demo.mjs` exercises a production server at `BASE_URL` (default
http://127.0.0.1:4331) with disposable Chromium contexts at desktop and phone sizes.
It checks the full pool, filtering, picker exclusions, pause/remove/restore, personal
start, old/new backup restoration, corrupt-profile protection and no catalog API fan-out.
Screenshots are saved in `qa/demo`. Do not use an existing personal browser profile.
