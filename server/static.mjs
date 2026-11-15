import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute, sep } from 'node:path';

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const failure = (status, body = '') => ({ status, body });
// Addresses the app draws itself. Anything else still gets the app (so a typo lands somewhere
// useful) but with a 404, so search engines don't index it as a copy of the home page.
const appRoute = /^\/(?:settings|help(?:\/[\w-]+)?|[uf]\/[^/]+)?\/?$/;
// Shared collections are other people's shelves, loaded live; keep them out of search results.
const sharedRoute = /^\/[uf]\//;

// Keep the protocol's buffered responses and error policy separate from HTTP streaming.
export async function staticFile(root, pathname, { desktop = false } = {}) {
  if (desktop && (pathname.includes('\\') || pathname.includes('\0'))) return failure(400, 'Bad path');
  let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const local = relative(root, file);
  const forbidden = desktop ? local.startsWith('..') || isAbsolute(local) : !file.startsWith(resolve(root) + sep);
  if (forbidden) return failure(403, desktop ? 'Forbidden' : '');
  let content;
  try { content = await (desktop ? readFile(file) : stat(file)); } catch {
    if (extname(pathname) && !sharedRoute.test(pathname)) return failure(404, 'Not found');
    file = resolve(root, 'index.html');
    content = await (desktop ? readFile(file) : stat(file));
    if (!desktop) {
      if (!appRoute.test(pathname)) return { file, content, type: mime['.html'], code: 404 };
      if (sharedRoute.test(pathname)) return { file, content, type: mime['.html'], robots: 'noindex' };
    }
  }
  if (!desktop && !content.isFile()) return failure(404);
  const type = mime[extname(file)] || 'application/octet-stream';
  return { file, content, type: desktop && type === 'text/html' ? type + '; charset=utf-8' : type };
}
