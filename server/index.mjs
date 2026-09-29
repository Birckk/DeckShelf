import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(resolve(root, 'index.html'))) { console.error('Build the app first: npm run build'); process.exit(1); }
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2', '.ico':'image/x-icon'};
const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '127.0.0.1';
const server = createServer((req,res) => {
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
    Promise.resolve(handleApi(req, res)).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end(JSON.stringify({ error: 'Could not complete the source request.' }));
    }).finally(() => { activeImports--; });
    return;
  }
  return handleApi(req,res, async () => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    let info;
    try { info = await stat(file); } catch {
      if (extname(path)) { res.writeHead(404); res.end('Not found'); return; }
      file = resolve(root,'index.html'); info = await stat(file);
    }
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Content-Length':info.size, 'X-Content-Type-Options':'nosniff', 'Cache-Control':path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch { res.writeHead(400); res.end('Bad request'); }
  });
});
let activeImports = 0;
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, host, () => console.log(`DeckShelf is ready: http://${host}:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25000).unref();
  });
}
