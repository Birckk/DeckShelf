import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream';
import { handleApi } from './api.mjs';
import { staticFile } from './static.mjs';

export function createRequestHandler(root, api = handleApi) {
  let activeImports = 0;
  return (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.url === '/healthz' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok' }));
      return;
    }
    // Bound upstream work globally without trusting spoofable forwarding headers.
    if (req.url?.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (activeImports >= 8) {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
        res.end(JSON.stringify({ error: 'Source imports are busy. Please try again shortly.' }));
        return;
      }
      activeImports++;
      Promise.resolve(api(req, res)).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end(JSON.stringify({ error: 'Could not complete the source request.' }));
      }).finally(() => { activeImports--; });
      return;
    }
    return api(req, res, async () => {
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const result = await staticFile(root, path);
        if (result.status) { res.writeHead(result.status); res.end(result.body); return; }
        res.writeHead(200, { 'Content-Type': result.type, 'Content-Length': result.content.size, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
        // pipeline destroys both streams on a read error or a closed connection instead of crashing.
        if (req.method === 'HEAD') res.end(); else pipeline(createReadStream(result.file), res, () => {});
      } catch { res.writeHead(400); res.end('Bad request'); }
    });
  };
}
