// One process-wide Archidekt cooldown, shared by discovery and snapshots in Node/desktop.
export function createUpstreamCooldown(now = () => Date.now()) {
  let retryAt = 0;
  return {
    get retryAt() { return retryAt; },
    defer(delay) { retryAt = Math.max(retryAt, now() + delay); },
    check() {
      if (now() < retryAt) throw Object.assign(new Error('Archidekt is rate limited. Try again later.'), { retryAfter: retryAt - now() });
    },
    observe(response) {
      if (response.status !== 429) return;
      const retry = response.headers?.get('retry-after');
      const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Date.parse(retry || '') - now();
      this.defer(Math.max(60000, Number.isFinite(delay) ? delay : 60000));
    },
  };
}
export const upstreamCooldown = createUpstreamCooldown();
export async function fetchArchidekt(url, options) {
  upstreamCooldown.check();
  const response = await fetch(url, options);
  upstreamCooldown.observe(response);
  return response;
}
