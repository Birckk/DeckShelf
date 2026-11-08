import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute, sep } from 'node:path';

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const failure = (status, body = '') => ({ status, body });

// Keep the protocol's buffered responses and error policy separate from HTTP streaming.
export async function staticFile(root, pathname, { desktop = false } = {}) {
  if (desktop && (pathname.includes('\\') || pathname.includes('\0'))) return failure(400, 'Bad path');
  let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const local = relative(root, file);
  const forbidden = desktop ? local.startsWith('..') || isAbsolute(local) : !file.startsWith(resolve(root) + sep);
  if (forbidden) return failure(403, desktop ? 'Forbidden' : '');
  let content;
  try { content = await (desktop ? readFile(file) : stat(file)); } catch {
    if (extname(pathname) && !/^\/(u|f)\//.test(pathname)) return failure(404, 'Not found');
    file = resolve(root, 'index.html');
    content = await (desktop ? readFile(file) : stat(file));
  }
  if (!desktop && !content.isFile()) return failure(404);
  const type = mime[extname(file)] || 'application/octet-stream';
  return { file, content, type: desktop && type === 'text/html' ? type + '; charset=utf-8' : type };
}
