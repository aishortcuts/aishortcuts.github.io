'use strict';
// Static checks of the two home pages: AC-3, AC-6, AC-10, AC-12.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const PAGES = { en: 'index.html', vi: 'vi/index.html' };
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const KEYS = ['windows', 'macos', 'linux', 'total', 'note'];

// Same pattern as .github/scripts/update_site_downloads.py in gemkids275/AIShortcuts.
const REWRITER_HREF = /href="https:\/\/github\.com\/gemkids275\/AIShortcuts\/releases\/download\/[^"]+?(\.exe|\.tar\.gz|\.dmg)"/g;

for (const [lang, rel] of Object.entries(PAGES)) {
  const html = read(rel);

  test(`${lang}: one hidden placeholder per key (AC-3, AC-6)`, () => {
    for (const key of KEYS) {
      const tags = html.match(new RegExp(`<[a-z]+[^>]*data-dl="${key}"[^>]*>`, 'g')) || [];
      assert.equal(tags.length, 1, `data-dl="${key}" must appear exactly once`);
      assert.match(tags[0], /\shidden[\s>]/, `data-dl="${key}" must start hidden`);
    }
  });

  test(`${lang}: each platform placeholder sits in its own card above the button (AC-1, AC-2)`, () => {
    const order = [['windows', 'Windows', '.exe"'], ['macos', 'macOS', '.dmg"'], ['linux', 'Linux', '.tar.gz"']];
    for (const [key, heading, suffix] of order) {
      const h = html.indexOf(`<h3>${heading}</h3>`);
      const p = html.indexOf(`data-dl="${key}"`);
      const b = html.indexOf(suffix, h);
      assert.ok(h > 0 && p > h && b > p, `${key}: heading < placeholder < button`);
    }
  });

  test(`${lang}: grand total sits under the Download heading`, () => {
    const section = html.slice(html.indexOf('<section id="download">'));
    const h2 = section.indexOf('<h2>');
    const total = section.indexOf('data-dl="total"');
    const firstCard = section.indexOf('<div class="dl">');
    assert.ok(h2 >= 0 && total > h2 && total < firstCard, 'total is between the h2 and the cards');
  });

  test(`${lang}: the note sentence is inside .dl-note and not empty (AC-12)`, () => {
    const m = html.match(/<p class="dl-note">[\s\S]*?<span data-dl="note" hidden>([^<]+)<\/span>[\s\S]*?<\/p>/);
    assert.ok(m, 'note span inside .dl-note');
    assert.ok(m[1].trim().length > 20, 'note has real text');
  });

  test(`${lang}: loads downloads.js once with defer`, () => {
    const tags = html.match(/<script[^>]*src="\/downloads\.js"[^>]*>/g) || [];
    assert.equal(tags.length, 1);
    assert.match(tags[0], /\sdefer[\s>]/);
  });

  test(`${lang}: still exactly three links for the CI rewriter (AC-10)`, () => {
    const found = (html.match(REWRITER_HREF) || []).map((h) => h.match(/(\.exe|\.tar\.gz|\.dmg)"$/)[1]).sort();
    assert.deepEqual(found, ['.dmg', '.exe', '.tar.gz']);
  });
}

test('downloads.js creates no links and writes no HTML (AC-9, AC-10)', () => {
  const code = read('downloads.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /createElement|innerHTML|insertAdjacentHTML|outerHTML|document\.write|href/i);
});

test('stylesheet defines the new classes', () => {
  const css = read('style.css');
  assert.match(css, /\.dl-count\s*\{/);
  assert.match(css, /\.dl-total\s*\{/);
});

test('new classes never set display, so the hidden attribute keeps working (AC-7)', () => {
  const css = read('style.css');
  for (const cls of ['dl-count', 'dl-total']) {
    const rules = css.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`, 'g')) || [];
    assert.ok(rules.length > 0, `.${cls} rule exists`);
    for (const r of rules) assert.doesNotMatch(r, /display\s*:/, `.${cls} must not set display`);
  }
});
