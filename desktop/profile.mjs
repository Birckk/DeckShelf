import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

// The desktop app shipped as Commander Archive before 1.0.
export const LEGACY_PROFILE = 'Commander Archive';
export const PROFILE = 'DeckShelf';

// Chromium recreates locks, caches and crash data; copying them can fail or waste space.
const skipped = new Set(['lockfile', 'LOCK', 'SingletonLock', 'SingletonCookie', 'SingletonSocket', 'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache', 'Crashpad', 'startup.log']);

export function profilePaths(appData) {
  return { profile: join(appData, PROFILE), legacy: join(appData, LEGACY_PROFILE) };
}

// Copy a Commander Archive profile into an unused DeckShelf profile before
// Chromium opens it. The app keeps the archive://app origin, so the copied
// local storage still holds the collection. The old profile stays untouched.
export function migrateLegacyProfile(legacy, profile) {
  if (!legacy || !existsSync(legacy)) return 'no legacy profile';
  if (existsSync(profile) && readdirSync(profile).some(name => !skipped.has(name))) return 'kept existing profile';
  const pending = `${profile}.migrating`;
  try {
    rmSync(pending, { recursive: true, force: true });
    cpSync(legacy, pending, { recursive: true, filter: source => !skipped.has(basename(source)) });
    mkdirSync(profile, { recursive: true });
    for (const name of readdirSync(pending)) renameSync(join(pending, name), join(profile, name));
    rmSync(pending, { recursive: true, force: true });
    return `copied ${LEGACY_PROFILE} profile`;
  } catch (error) {
    rmSync(pending, { recursive: true, force: true });
    return `could not copy ${LEGACY_PROFILE} profile: ${error.message}`;
  }
}
