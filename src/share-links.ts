import { type CollectionSource } from './domain.ts';
import { parseSourceInput } from './collection.ts';

export type SharedSource = { kind: 'account' | 'folder'; value: string };

// Source-only v1 links. No upstream URL, selection payload or arbitrary filters.
export function parseSharePath(path: string, search = ''): SharedSource | null {
  if (!/^\/(u|f)(\/|$)/.test(path)) return null;
  const match = /^\/(u|f)\/([^/]+)\/?$/.exec(path);
  if (!match || search.length > 100) throw new Error('This collection link is invalid.');
  const params = new URLSearchParams(search);
  if ([...params.keys()].some(key => key !== 'format') || params.getAll('format').length > 1 ||
      (params.has('format') && params.get('format') !== 'commander'))
    throw new Error('This collection link uses an unsupported format or selection.');
  const kind = match[1] === 'u' ? 'account' : 'folder';
  const value = decodeURIComponent(match[2]);
  if (/^https?:/i.test(value)) throw new Error('Use a username or folder ID.');
  const parsed = parseSourceInput(value, kind);
  if (parsed.kind !== kind) throw new Error('This collection link is invalid.');
  return { kind, value: parsed.value };
}

export function buildSharePath(source: SharedSource): string {
  if (!['account', 'folder'].includes(source.kind)) throw new Error('Use an Archidekt account or folder.');
  const parsed = parseSourceInput(source.value, source.kind);
  if (parsed.kind !== source.kind) throw new Error('Use an Archidekt username or folder ID.');
  return `/${source.kind === 'account' ? 'u' : 'f'}/${encodeURIComponent(parsed.value)}`;
}

export function buildShareUrl(base: string, source: SharedSource): string {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Enter the web address of your DeckShelf installation.');
  return new URL(buildSharePath(source), url.origin).href;
}

export function shareSourceOptions(sources: CollectionSource[]): (SharedSource & { key: string; name: string })[] {
  const options = new Map<string, SharedSource & { key: string; name: string }>();
  for (const source of sources) {
    if (source.connectionKey?.startsWith('account:')) {
      const value = source.connectionKey.slice('account:'.length);
      try {
        const account = parseSourceInput(value, 'account');
        if (account.kind === 'account' && account.key === source.connectionKey)
          options.set(account.key, { ...account, kind: 'account', name: source.connectionName || value });
      } catch { /* Invalid connection metadata must not become a share target. */ }
    }
    options.set(source.key, { key: source.key, kind: source.kind, value: source.value, name: source.name });
  }
  return [...options.values()];
}
