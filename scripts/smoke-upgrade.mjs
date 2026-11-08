import { _electron as electron, expect } from '@playwright/test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

// Called by smoke-installer.ps1 on the disposable Windows runner:
//   seed <Commander Archive.exe> <profile>  restores a backup in the old app
//   verify <DeckShelf.exe> <appData>        starts DeckShelf normally, then checks the copied collection
// It writes the real %APPDATA% profiles, so never run it against the owner's account.
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Windows') throw new Error('The desktop upgrade test requires a disposable GitHub Windows runner.');
const [mode, executable, location] = process.argv.slice(2);
if (!['seed', 'verify'].includes(mode) || !executable || !location) throw new Error('Usage: smoke-upgrade.mjs seed|verify <executable> <profile|appData>');
const root = resolve(import.meta.dirname, '..');
const qa = join(root, 'qa');
await mkdir(qa, { recursive: true });
const temp = await mkdtemp(join(qa, 'upgrade-'));
const env = { ...process.env, PATH: join(process.env.SystemRoot, 'System32') };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const key = 'commander-archive.collection.v1';
const seed = JSON.parse(await readFile(join(root, 'src/data/decks.json'), 'utf8'));
const snapshot = seed[2];
// The same shape smoke-desktop.mjs round-trips, with a fixed date so both runs agree.
const fixture = {
  version: 1, hidden: [seed[0].id], excluded: [seed[1].id], added: [snapshot],
  disabledGroups: ['account:smoketest'], manualIds: [snapshot.id],
  sources: [{ key: 'account:smoketest', kind: 'account', value: 'smoketest', name: 'Smoke test',
    url: 'https://archidekt.com/u/smoketest', checkedAt: '2026-10-12T00:00:00.000Z',
    entries: [{ id: snapshot.id, name: snapshot.name, image: snapshot.commanders[0].image, colors: snapshot.colors }],
    knownIds: [snapshot.id], selectedIds: [snapshot.id] }],
};
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

async function open(profile) {
  const app = await electron.launch({ executablePath: executable, args: ['--smoke-test'], env: { ...env, CA_TEST_PROFILE: profile }, timeout: 45000 });
  const page = await app.firstWindow();
  if (process.env.GITHUB_ACTIONS === 'true') await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible();
  expect(page.url()).toBe('archive://app/');
  return { app, page };
}

if (mode === 'seed') {
  const backup = join(temp, 'backup.json');
  await writeFile(backup, JSON.stringify(fixture));
  const { app, page } = await open(location);
  try {
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles(backup);
    await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
    await expect.poll(() => stored(page)).toEqual(fixture);
  } finally { await app.close(); }
  console.log(`PASS: restored a backup in ${location}`);
} else {
  // A normal start (no test profile) chooses %APPDATA%\DeckShelf and copies the old profile.
  const profile = join(location, 'DeckShelf');
  const native = spawn(executable, [], { env, windowsHide: true, stdio: 'ignore' });
  try {
    await expect.poll(async () => {
      try { return await readFile(join(profile, 'startup.log'), 'utf8'); } catch { return ''; }
    }, { timeout: 30000 }).toMatch(/Profile: copied Commander Archive profile[\s\S]*Loaded application window/);
  } finally {
    if (native.pid && native.exitCode === null) {
      try { execFileSync('taskkill', ['/PID', String(native.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
    }
  }
  const { app, page } = await open(profile);
  // The daily new-decks check may note its result on a source once the app is running. That
  // note isn't part of what the upgrade has to keep.
  const withoutCheck = collection => ({ ...collection, sources: collection?.sources?.map(({ refresh, ...source }) => source) });
  try { await expect.poll(async () => withoutCheck(await stored(page))).toEqual(fixture); } finally { await app.close(); }
  console.log('PASS: DeckShelf copied the Commander Archive profile and kept its collection.');
}
