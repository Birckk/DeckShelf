import { readFile, readdir, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = join(root, 'build/notices');
await mkdir(destination, { recursive: true });
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const inventory = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const directory = join(root, path);
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const licenses = (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  if (!licenses.length) throw new Error(`Missing license text for shipped dependency ${pkg.name}`);
  const target = pkg.name.replaceAll('/', '__').replaceAll('@', '') + '-' + pkg.version;
  await mkdir(join(destination, target), { recursive: true });
  for (const file of licenses) await copyFile(join(directory, file), join(destination, target, file));
  inventory.push({ name: pkg.name, version: pkg.version, license: pkg.license, texts: licenses.map(file => `${target}/${file}`) });
}
// electron-builder renames Electron's LICENSE in the runtime distribution.
const electron = JSON.parse(await readFile(join(root, 'node_modules/electron/package.json'), 'utf8'));
inventory.push({ name: 'electron', version: electron.version, license: electron.license, texts: ['../../LICENSE.electron.txt', '../../LICENSES.chromium.html'] });
await writeFile(join(destination, 'dependencies.json'), JSON.stringify(inventory, null, 2) + '\n');
const artwork = JSON.parse(await readFile(join(root, 'src/data/help-artwork.json'), 'utf8'));
await writeFile(join(destination, 'artwork.json'), JSON.stringify(artwork.map(card => ({ deck: card.deck, source: card.source, name: card.name, artist: card.artist, image: card.image, art: card.art })), null, 2) + '\n');
console.log(`Collected notices for ${inventory.length} dependencies and ${artwork.length} artworks.`);
