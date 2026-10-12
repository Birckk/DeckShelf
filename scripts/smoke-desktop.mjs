import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

if (process.platform !== 'win32') throw new Error('The packaged desktop smoke test requires Windows.');
const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const qa = join(root, 'qa');
await mkdir(qa, { recursive: true });
// Workspace-local test directories avoid inherited sandbox ACLs in Windows TEMP.
const temp = await mkdtemp(join(qa, 'smoke-'));
const appDirectoryArg = process.argv.indexOf('--app-dir');
if (appDirectoryArg !== -1 && !process.argv[appDirectoryArg + 1]) throw new Error('--app-dir requires an installed application directory.');
const installedDirectory = appDirectoryArg === -1 ? null : resolve(process.argv[appDirectoryArg + 1]);
const extracted = installedDirectory || join(temp, 'extracted app');
const moved = installedDirectory || join(temp, 'upgraded app');
const profile = join(temp, 'isolated-profile');
const zip = join(root, 'release', `DeckShelf-${pkg.version}-windows-x64.zip`);
function extract(destination) {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:CA_SMOKE_ZIP -DestinationPath $env:CA_SMOKE_EXTRACT'], {
    env: { ...process.env, CA_SMOKE_ZIP: zip, CA_SMOKE_EXTRACT: destination }, stdio: 'inherit',
  });
}
if (!installedDirectory) extract(extracted);
const env = { ...process.env, CA_TEST_PROFILE: profile, PATH: join(process.env.SystemRoot, 'System32') };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const key = 'commander-archive.collection.v1';
const seed = JSON.parse(await readFile(join(root, 'src/data/decks.json'), 'utf8'));
const snapshot = seed[2];
const fixture = {
  version: 1, hidden: [seed[0].id], excluded: [seed[1].id], added: [snapshot],
  disabledGroups: ['account:smoketest'], manualIds: [snapshot.id],
  sources: [{ key: 'account:smoketest', kind: 'account', value: 'smoketest', name: 'Smoke test',
    url: 'https://archidekt.com/u/smoketest', checkedAt: new Date().toISOString(),
    entries: [{ id: snapshot.id, name: snapshot.name, image: snapshot.commanders[0].image, colors: snapshot.colors }],
    knownIds: [snapshot.id], selectedIds: [snapshot.id] }],
};
const backup = join(temp, 'version-1-backup.json');
await writeFile(backup, JSON.stringify(fixture));
let running;
const errors = [];
async function launch(directory) {
  running = await electron.launch({ executablePath: join(directory, 'DeckShelf.exe'), args: ['--smoke-test'], env, timeout: 45000 });
  const page = await running.firstWindow();
  // A hidden Electron window may not produce compositor frames on the hosted
  // Windows runner. Show it only on that disposable machine for screenshots.
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows') {
    await running.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  }
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByRole('button', { name: /^My collection/ })).toBeVisible();
  expect(page.url()).toBe('archive://app/');
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  return page;
}
try {
  // Test a normal production window without Playwright's inspector/startup hooks.
  const nativeProfile = join(temp, 'native-profile');
  await mkdir(nativeProfile, { recursive: true });
  const native = spawn(join(extracted, 'DeckShelf.exe'), ['--smoke-test', '--production-window'], {
    env: { ...env, CA_TEST_PROFILE: nativeProfile }, windowsHide: true, stdio: 'ignore',
  });
  try {
    await expect.poll(async () => {
      try { return await readFile(join(nativeProfile, 'startup.log'), 'utf8'); } catch { return ''; }
    }, { timeout: 20000 }).toContain('Loaded application window');
  } finally {
    if (native.pid && native.exitCode === null) {
      try { execFileSync('taskkill', ['/PID', String(native.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
    }
  }
  let page = await launch(extracted);
  // No developer runtime is in the launched application's PATH.
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
  await page.screenshot({ path: join(qa, 'desktop-start.png') });
  const unknown = await page.evaluate(async () => { const r = await fetch('/api/unknown'); return { status: r.status, body: await r.json() }; });
  expect(unknown.status).toBe(404);
  expect(unknown.body.error).toBeTruthy();
  // Exercise the real adapter through the renderer protocol, with controlled upstream data.
  await running.evaluate(() => {
    globalThis.__originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [], next: null, count: 0 }), { headers: { 'Content-Type': 'application/json' } });
  });
  const source = await page.evaluate(async () => { const r = await fetch('/api/sources?kind=account&value=smoketest'); return { status: r.status, body: await r.json() }; });
  expect(source.status).toBe(200);
  expect(source.body.key).toBe('account:smoketest');
  await running.evaluate(() => { globalThis.fetch = globalThis.__originalFetch; });
  if (process.argv.includes('--live')) {
    const deck = await page.evaluate(async () => { const r = await fetch('/api/decks/26549829'); return { status: r.status, body: await r.json() }; });
    expect(deck.status).toBe(200);
    expect(deck.body.id).toBe('26549829');
    console.log(`Live read-only Archidekt check: ${deck.body.name}`);
  }
  await page.getByRole('button', { name: /^My collection/ }).click();
  await page.locator('input[type=file]').setInputFiles(backup);
  await page.getByRole('button', { name: 'Restore this backup', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(fixture);
  const saved = join(temp, 'exported.json');
  await running.evaluate(({ session }, path) => { session.defaultSession.once('will-download', (_event, item) => item.setSavePath(path)); }, saved);
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  await expect.poll(async () => { try { return JSON.parse(await readFile(saved, 'utf8')); } catch { return null; } }).toEqual(fixture);
  await running.close(); running = undefined;
  // An upgrade/extraction path change must not create a new collection.
  if (!installedDirectory) extract(moved);
  page = await launch(moved);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(fixture);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /^My collection/ })).toBeVisible();
  await expect.poll(() => page.locator('img').evaluateAll(images => images.filter(i => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
  await page.screenshot({ path: join(qa, 'desktop-offline.png') });
  expect(errors).toEqual([]);
  console.log(`PASS: ${installedDirectory ? 'application directory' : 'extracted ZIP'}, production startup, packaged artwork, sandbox, API routing, v1 restore/export, persistent relaunch, offline reload.`);
  console.log(`Isolated test data: ${temp}`);
} finally { if (running) await running.close(); }



