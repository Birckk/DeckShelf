// Switches that prototype builds saved and nothing reads any more: the List, sort and shelf-bar
// variants (#91, #24) and the Follow trial flags (#23). Removing an absent key does nothing, so
// this runs on every start rather than recording that it ran (#114).
export const RETIRED_KEYS = [
  "commander-archive.list-columns.v1",
  "commander-archive.manager-list-columns.v1",
  "deckshelf.dev.list-columns-variant",
  "deckshelf.dev.list-variant",
  "deckshelf.dev.shelf-bar",
  "deckshelf.dev.shelf-variant",
  "deckshelf.dev.sort-variant",
  "deckshelf.follow-prototype",
  "deckshelf.follow-variant",
];

export function clearRetiredKeys(storage: Pick<Storage, "removeItem">) {
  try {
    for (const key of RETIRED_KEYS) storage.removeItem(key);
  } catch {
    // Blocked storage keeps whatever it has; none of these keys change behavior.
  }
}
