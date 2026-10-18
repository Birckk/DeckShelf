export const COLLECTION_KEY = "commander-archive.collection.v1";
export const FIRST_VISIT_KEY = "deckshelf.first-visit.seen.v1";
// On for everyone (#54). Set to false to retire the offer; #71 parks the idea of dropping it after release.
export const ENABLE_FIRST_VISIT_IN_PRODUCTION = true;

export function isFreshProfile(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(COLLECTION_KEY) === null && storage.getItem(FIRST_VISIT_KEY) === null;
  } catch {
    return false;
  }
}

export function markFirstVisit(storage: Pick<Storage, "setItem" | "getItem">): boolean {
  try {
    storage.setItem(FIRST_VISIT_KEY, "1");
    return storage.getItem(FIRST_VISIT_KEY) === "1";
  } catch {
    return false;
  }
}
