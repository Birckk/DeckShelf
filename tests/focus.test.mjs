import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../src/', import.meta.url);
const sheets = readdirSync(dir).filter(f => f.endsWith('.css') && f !== 'focus.css').map(f => [f, readFileSync(new URL(f, dir), 'utf8')]);
// Text fields may style their own focus, since a click there really does put the caret in them.
const allowed = /\binput\b|\.manager-search label|\.navigator-switch-option/;

test('focus rings come from focus.css, so a pointer can switch them off in one place', () => {
  const stray = [];
  for (const [file, css] of sheets) {
    for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/:focus/.test(selector) || allowed.test(selector)) continue;
      for (const [, value] of body.matchAll(/(?:^|;|\s)outline\s*:\s*([^;]+)/g)) {
        if (!/^(none|0|var\(--focus-ring\))$/.test(value.trim())) stray.push(`${file}: ${selector.trim()}`);
      }
    }
  }
  assert.deepEqual(stray, []);
});
