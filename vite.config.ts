import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Both local development and the production server use the same small importer.
// @ts-expect-error The Node server is plain JavaScript.
import { handleApi } from './server/api.mjs';

export default defineConfig({
  plugins: [react(), { name: 'archidekt-import', configureServer(server) { server.middlewares.use(handleApi); } }],
  // Agent worktrees live under .claude/; watching or scanning them reloads this checkout's dev server.
  server: { port: 4317, strictPort: true, watch: { ignored: ['**/.claude/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  preview: { port: 4318, strictPort: true },
});
