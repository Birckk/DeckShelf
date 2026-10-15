import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { handleApi } from '../server/api.mjs';

export const APP_URL = 'archive://app/';
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

export function isAppUrl(value) {
  try { const url = new URL(value); return url.protocol === 'archive:' && url.host === 'app' && !url.username && !url.password; }
  catch { return false; }
}

export function isExternalUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}

// Adapt the same read-only importer used by the web server, without opening a port.
export async function desktopResponse(request, root, api = handleApi) {
  if (!isAppUrl(request.url)) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    let status = 200;
    const headers = new Headers();
    let body = '';
    await api({ url: url.pathname + url.search, method: request.method }, {
      setHeader(name, value) { headers.set(name, value); },
      writeHead(code) { status = code; },
      end(value = '') { body = value; },
    });
    headers.set('Cache-Control', 'no-store');
    return new Response(request.method === 'HEAD' ? null : body, { status, headers });
  }
  try {
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) return new Response('Bad path', { status: 400 });
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const local = relative(root, file);
    if (local.startsWith('..') || isAbsolute(local)) return new Response('Forbidden', { status: 403 });
    // Like the web server, app routes such as /help/faq load the single page.
    const page = extname(pathname) ? file : await readFile(file).then(() => file, () => resolve(root, 'index.html'));
    const bytes = await readFile(page);
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      'Content-Type': mime[extname(page)] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    } });
  } catch { return new Response('Not found', { status: 404 }); }
}
