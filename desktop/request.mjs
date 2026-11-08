import { staticFile } from '../server/static.mjs';
import { handleApi } from '../server/api.mjs';

export const APP_URL = 'archive://app/';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

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
    const result = await staticFile(root, decodeURIComponent(url.pathname), { desktop: true });
    if (result.status) return new Response(result.body, { status: result.status });
    return new Response(request.method === 'HEAD' ? null : result.content, { headers: {
      'Content-Type': result.type,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    } });
  } catch { return new Response('Not found', { status: 404 }); }
}
