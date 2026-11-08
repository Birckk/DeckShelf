import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './request.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
if (!existsSync(resolve(root, 'index.html'))) { console.error('Build the app first: npm run build'); process.exit(1); }
const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '127.0.0.1';
const server = createServer(createRequestHandler(root));
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, host, () => console.log(`DeckShelf is ready: http://${host}:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25000).unref();
  });
}
