import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The breakpoint set documented in src/layout.css. Add a width there before using it here.
const tiers = { 'max-width': [1100, 850, 700, 550, 380], 'min-width': [1500, 701], 'max-height': [500] };
// Content-driven exceptions, each explained beside its rule.
const exceptions = { 'collection.css': ['max-width:1280px'] };
const dir = new URL('../src/', import.meta.url);
const sheets = readdirSync(dir).filter(f => f.endsWith('.css')).map(f => [f, readFileSync(new URL(f, dir), 'utf8')]);

test('media queries use only the layout breakpoints', () => {
  const stray = [];
  for (const [file, css] of sheets) {
    for (const [, query] of css.matchAll(/@media([^{]*)\{/g)) {
      for (const [match, kind, width] of query.matchAll(/(max-width|min-width|max-height):\s*(\d+)px/g)) {
        const exception = (exceptions[file] ?? []).includes(match.replace(/\s/g, ''));
        if (!tiers[kind].includes(Number(width)) && !exception) stray.push(`${file}: ${query.trim()}`);
      }
    }
  }
  assert.deepEqual(stray, []);
});

test('page gutters come from --gutter, not fixed side padding', () => {
  // Top-level containers must not hard-code their side padding again.
  const sides = (prop, value) => {
    if (/padding-(inline|left|right)$/.test(prop)) return [value];
    const parts = value.trim().split(/\s+(?![^(]*\))/);
    return prop === 'padding' && parts.length > 1 ? [parts[1], parts[3] ?? parts[1]] : [];
  };
  const fixed = [];
  for (const [file, css] of sheets) {
    for (const [, selector, body] of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      if (!/\.(studio-header|studio-workspace|collection-workspace|help-workspace)\s*$/.test(selector.trim())) continue;
      for (const [, prop, value] of body.matchAll(/(padding(?:-inline|-left|-right)?)\s*:\s*([^;]+)/g)) {
        if (sides(prop, value).some(side => side !== '0' && !side.includes('var(--gutter)'))) fixed.push(`${file}: ${selector.trim()} { ${prop}: ${value} }`);
      }
    }
  }
  assert.deepEqual(fixed, []);
});

test('the header looks the same in every view', () => {
  // Switching views must not resize the logo or move header controls, so no header rule may
  // depend on which view's workspace is open.
  const scoped = [];
  for (const [file, css] of sheets) {
    for (const [, selector] of css.matchAll(/([^{}@]*)\{[^{}]*\}/g)) {
      if (/:has\(\.(studio|collection|help)-workspace\)[^,]*\.(studio-header|studio-nav|brand)/.test(selector)) scoped.push(`${file}: ${selector.trim()}`);
    }
  }
  assert.deepEqual(scoped, []);
});
