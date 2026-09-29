import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

export default async function afterPack({ appOutDir, electronPlatformName }) {
  if (process.platform !== 'win32' || process.arch !== 'x64' || electronPlatformName !== 'win32') {
    throw new Error('This package target must be built on Windows x64 with its matching pinned runtime.');
  }
  // The custom runtime-copy path keeps Electron's demo app; it is not part of ours.
  for (const file of ['resources/default_app.asar', 'version']) {
    await unlink(join(appOutDir, file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
