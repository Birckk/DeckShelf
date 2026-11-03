import { defineConfig, lazyPlugins, normalizePath, type Plugin } from 'vite-plus';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
// Both local development and the production server use the same small importer.
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
  // Plugins load lazily so `vp check` and `vp lint` don't start the React plugin or the importer.
  plugins: lazyPlugins(() => [react(), serviceWorker(), { name: 'archidekt-import', configureServer(server) { server.middlewares.use(handleApi); } }]),
  // The code is formatted by hand; Oxfmt would rewrite every file, so `vp check` only lints and type-checks.
  check: { fmt: false },
  lint: {
    ignorePatterns: ['docs/archive/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error', 'typescript/require-array-sort-compare': ['warn', { ignoreStringArrays: true }] },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      // node:test registers tests through the promise test() returns; nothing awaits it.
      { files: ['tests/*.test.mjs'], rules: { 'typescript/no-floating-promises': 'off' } },
      // Browser tests keep Storage and File prototype methods to patch them and call the originals.
      { files: ['tests/browser/**'], rules: { 'typescript/unbound-method': 'off' } },
    ],
  },
  // Agent worktrees live under .claude/; watching them reloads this checkout's dev server. Ignore only
  // this checkout's own folder, so a server started inside a worktree still watches its files.
  server: { port: 4317, strictPort: true, watch: { ignored: [normalizePath(fileURLToPath(new URL('./.claude', import.meta.url))) + '/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  preview: { port: 4318, strictPort: true },
});
