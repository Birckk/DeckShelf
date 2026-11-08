// Eight upstream requests at most. Source listings wait in the source cache's serial
// queue while they hold a slot, so a backlog of listing checks could take all eight
// and turn every deck load into a 503. Listings may hold half; deck loads use the rest.
// Counting by request type rather than client address also works behind a reverse
// proxy, where every visitor shares one address.
const LISTINGS = new Set(['/api/sources', '/api/source-folders']);

export function createImportSlots({ total = 8, listings = 4 } = {}) {
  let active = 0;
  let listing = 0;
  return function acquire(req) {
    const isListing = LISTINGS.has(new URL(req.url, 'http://localhost').pathname);
    if (active >= total || (isListing && listing >= listings)) return undefined;
    active++;
    if (isListing) listing++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--;
      if (isListing) listing--;
    };
  };
}
