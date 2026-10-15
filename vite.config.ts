import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
// Both local development and the production server use the same small importer.
// @ts-expect-error The Node server is plain JavaScript.
import { handleApi } from './server/api.mjs';

// Writes dist/sw.js with every built file precached. The version is a hash of those files,
// so any change produces a new worker and the old cache is removed on activation.
function serviceWorker(): Plugin {
  return {
    name: 'deckshelf-service-worker',
    apply: 'build',
    async writeBundle({ dir }) {
      const files = (await readdir(dir!, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile())
        .map(entry => relative(dir!, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter(file => file !== 'sw.js' && !file.endsWith('.woff'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(await readFile(join(dir!, file)));
      const source = await readFile('src/sw.js', 'utf8');
      await writeFile(join(dir!, 'sw.js'), source
        .replace('"__VERSION__"', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__PRECACHE__', JSON.stringify(files.map(file => '/' + file))));
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker(), { name: 'archidekt-import', configureServer(server) { server.middlewares.use(handleApi); } }],
  // Agent worktrees live under .claude/; watching or scanning them reloads this checkout's dev server.
  server: { port: 4317, strictPort: true, watch: { ignored: ['**/.claude/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  preview: { port: 4318, strictPort: true },
});
