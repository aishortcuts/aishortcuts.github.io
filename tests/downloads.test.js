'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dl = require('../downloads.js');

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'releases.json'), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const release = (tag, assets, extra) =>
  Object.assign({ tag_name: tag, draft: false, prerelease: false, assets }, extra);
const asset = (name, download_count) => ({ name, download_count });

// ---- summarize: AC-1..AC-5

test('AC-1 current version and count per platform (live fixture)', () => {
  const s = dl.summarize(FIXTURE);
  assert.deepEqual([s.windows.version, s.windows.current], ['v2', 22]);
  assert.deepEqual([s.linux.version, s.linux.current], ['v2', 5]);
  assert.deepEqual([s.macos.version, s.macos.current], ['v1.2', 3]);
});

test('AC-1 current version does not depend on array order', () => {
  assert.deepEqual(dl.summarize(clone(FIXTURE).reverse()), dl.summarize(FIXTURE));
});

test('AC-1 versions compare numerically, not as text', () => {
  const rels = [
    release('win-v9', [asset('a.exe', 1)]),
    release('win-v10', [asset('a.exe', 2)]),
    release('mac-v1.9', [asset('a.dmg', 3)]),
    release('mac-v1.10', [asset('a.dmg', 4)]),
  ];
  const s = dl.summarize(rels);
  assert.deepEqual([s.windows.version, s.windows.current, s.windows.total], ['v10', 2, 3]);
  assert.deepEqual([s.macos.version, s.macos.current, s.macos.total], ['v1.10', 4, 7]);
});

test('AC-2 all-time total per platform (live fixture)', () => {
  const s = dl.summarize(FIXTURE);
  assert.equal(s.windows.total, 41);
  assert.equal(s.linux.total, 7);
  assert.equal(s.macos.total, 20);
});

test('AC-3 grand total is the sum of platform totals, null when nothing matches', () => {
  assert.equal(dl.summarize(FIXTURE).grand, 68);
  assert.equal(dl.summarize([]).grand, null);
  assert.equal(dl.summarize([release('foo', [asset('a.exe', 5)])]).grand, null);
});

test('AC-4 checksum files, drafts and prereleases are ignored', () => {
  const rels = clone(FIXTURE).concat([
    release('win-v3', [asset('a.exe', 900), asset('b.tar.gz', 900)], { draft: true }),
    release('mac-v2.0', [asset('a.dmg', 900)], { prerelease: true }),
    release('win-v4', [asset('SHA256SUMS.txt', 900)]),
  ]);
  assert.deepEqual(dl.summarize(rels), dl.summarize(FIXTURE));
});

test('AC-5 tag classification', () => {
  const win = dl.summarize([release('win-v2', [asset('a.exe', 1), asset('b.tar.gz', 2)])]);
  assert.equal(win.windows.total, 1);
  assert.equal(win.linux.total, 2);
  assert.equal(win.macos, null);

  assert.equal(dl.summarize([release('mac-v1.2', [asset('a.dmg', 3)])]).macos.version, 'v1.2');
  assert.equal(dl.summarize([release('v1.0', [asset('a.dmg', 3)])]).macos.version, 'v1.0');
  assert.equal(dl.summarize([release('v1.0.1', [asset('a.dmg', 3)])]).macos.version, 'v1.0.1');

  for (const tag of ['foo-1', 'win-v2-beta', 'v1.0.0-rc', 'mac-v', 'win-v1.2', 'Win-v2', '']) {
    const s = dl.summarize([release(tag, [asset('a.exe', 1), asset('b.tar.gz', 1), asset('c.dmg', 1)])]);
    assert.equal(s.grand, null, `tag "${tag}" must be ignored`);
  }
});

test('a release without the platform asset leaves the previous release as current', () => {
  const rels = clone(FIXTURE).concat([release('win-v3', [asset('b.tar.gz', 9)])]);
  const s = dl.summarize(rels);
  assert.deepEqual([s.windows.version, s.windows.current], ['v2', 22]);
  assert.deepEqual([s.linux.version, s.linux.current, s.linux.total], ['v3', 9, 16]);
});

test('invalid download_count skips that release for the platform', () => {
  for (const bad of ['5', -1, 1.5, null, undefined, NaN, Infinity]) {
    const rels = [release('win-v2', [asset('a.exe', 7)]), release('win-v3', [asset('a.exe', bad)])];
    const s = dl.summarize(rels);
    assert.deepEqual([s.windows.version, s.windows.total], ['v2', 7], `count ${String(bad)}`);
  }
});

test('malformed input never throws and yields an empty summary', () => {
  const empty = { windows: null, macos: null, linux: null, grand: null };
  for (const input of [null, undefined, {}, 'x', 42, [null], [{}], [{ tag_name: 'win-v2' }], [{ tag_name: 'win-v2', assets: 'x' }]]) {
    assert.deepEqual(dl.summarize(input), empty);
  }
});

test('a zero count is valid and counts as a release', () => {
  const s = dl.summarize([release('win-v5', [asset('a.exe', 0)])]);
  assert.deepEqual([s.windows.version, s.windows.current, s.windows.total, s.grand], ['v5', 0, 0, 0]);
});

// ---- isValidSummary: guards the cached copy (AC-8, AC-9)

test('isValidSummary accepts real summaries and rejects tampered ones', () => {
  const good = dl.summarize(FIXTURE);
  assert.equal(dl.isValidSummary(good), true);
  assert.equal(dl.isValidSummary(dl.summarize([])), true);

  const bad = (mutate) => {
    const s = clone(good);
    mutate(s);
    return dl.isValidSummary(s);
  };
  assert.equal(bad((s) => { s.windows.version = '<img src=x onerror=alert(1)>'; }), false);
  assert.equal(bad((s) => { s.windows.version = 'v2 '; }), false);
  assert.equal(bad((s) => { s.windows.current = '22'; }), false);
  assert.equal(bad((s) => { s.windows.total = -1; }), false);
  assert.equal(bad((s) => { s.windows.current = 99; }), false, 'current must not exceed total');
  assert.equal(bad((s) => { s.grand = 999; }), false, 'grand must equal the sum of totals');
  assert.equal(bad((s) => { s.grand = null; }), false);
  assert.equal(bad((s) => { delete s.linux; }), false);
  assert.equal(bad((s) => { s.macos = 5; }), false);

  for (const v of [null, undefined, 'x', 1, [], { windows: null }]) {
    assert.equal(dl.isValidSummary(v), false);
  }
});

// ---- format: AC-6

test('AC-6 card text in English and Vietnamese, with digit grouping', () => {
  const s = { version: 'v2', current: 22, total: 41 };
  assert.equal(dl.formatCard('en', s), 'v2: 22 downloads · 41 total');
  assert.equal(dl.formatCard('vi', s), 'v2: 22 lượt tải · tổng 41');
  assert.equal(dl.formatCard('en', { version: 'v1.2', current: 1, total: 1 }), 'v1.2: 1 download · 1 total');
  assert.equal(dl.formatCard('en', { version: 'v2', current: 1234, total: 12345 }), 'v2: 1,234 downloads · 12,345 total');
  assert.equal(dl.formatCard('vi', { version: 'v2', current: 1234, total: 12345 }), 'v2: 1.234 lượt tải · tổng 12.345');
});

test('AC-6 grand total text', () => {
  assert.equal(dl.formatTotal('en', 68), '68 downloads so far');
  assert.equal(dl.formatTotal('en', 1), '1 download so far');
  assert.equal(dl.formatTotal('vi', 68), '68 lượt tải tính đến nay');
});

// ---- cache: AC-8

function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}
const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('quota'); },
};
const NOW = 1_800_000_000_000;
const SUMMARY = dl.summarize(FIXTURE);
const entry = (t, data) => JSON.stringify({ t, data });

test('AC-8 cache round trip and expiry at one hour', () => {
  const st = memoryStorage();
  dl.writeCache(st, SUMMARY, NOW);
  assert.deepEqual(dl.readCache(st, NOW + 1000), SUMMARY);
  assert.deepEqual(dl.readCache(st, NOW + dl.TTL_MS - 1), SUMMARY);
  assert.equal(dl.readCache(st, NOW + dl.TTL_MS), null);
  assert.equal(dl.readCache(st, NOW - 1), null, 'entry from the future is a miss');
});

test('AC-8 corrupt, tampered or missing cache entries are a miss', () => {
  const bad = ['{', 'null', '[]', '"x"', entry('now', SUMMARY), entry(NOW, null), entry(NOW, { windows: null }),
    entry(NOW, Object.assign({}, SUMMARY, { windows: { version: '<b>v2</b>', current: 1, total: 1 } }))];
  for (const raw of bad) {
    assert.equal(dl.readCache(memoryStorage({ [dl.CACHE_KEY]: raw }), NOW), null, raw.slice(0, 40));
  }
  assert.equal(dl.readCache(memoryStorage(), NOW), null);
  assert.equal(dl.readCache(null, NOW), null);
});

test('AC-8 unusable storage never throws', () => {
  assert.equal(dl.readCache(throwingStorage, NOW), null);
  assert.doesNotThrow(() => dl.writeCache(throwingStorage, SUMMARY, NOW));
  assert.doesNotThrow(() => dl.writeCache(null, SUMMARY, NOW));
});

// ---- getSummary: AC-7, AC-8

function fakeFetch(respond) {
  const calls = [];
  const fn = (url, init) => { calls.push({ url, init }); return respond(url, init); };
  fn.calls = calls;
  return fn;
}
const okJson = (body) => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

test('AC-8 fresh cache means no network call', async () => {
  const st = memoryStorage();
  dl.writeCache(st, SUMMARY, NOW);
  const f = fakeFetch(() => assert.fail('fetch must not run'));
  assert.deepEqual(await dl.getSummary({ fetch: f, storage: st, now: () => NOW + 5000 }), SUMMARY);
  assert.equal(f.calls.length, 0);
});

test('live call asks the Releases API for the repository and stores the result', async () => {
  const st = memoryStorage();
  const f = fakeFetch(okJson(FIXTURE));
  const s = await dl.getSummary({ fetch: f, storage: st, now: () => NOW });
  assert.deepEqual(s, SUMMARY);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/gemkids275/AIShortcuts/releases?per_page=100');
  assert.equal(f.calls[0].init.headers.Accept, 'application/vnd.github+json');
  assert.deepEqual(dl.readCache(st, NOW), SUMMARY);
});

test('AC-8 stale cache is refreshed from the network', async () => {
  const st = memoryStorage();
  dl.writeCache(st, SUMMARY, NOW - dl.TTL_MS - 1);
  const f = fakeFetch(okJson(FIXTURE));
  await dl.getSummary({ fetch: f, storage: st, now: () => NOW });
  assert.equal(f.calls.length, 1);
});

test('AC-8 unusable storage still renders from the live call', async () => {
  const f = fakeFetch(okJson(FIXTURE));
  assert.deepEqual(await dl.getSummary({ fetch: f, storage: throwingStorage, now: () => NOW }), SUMMARY);
  assert.deepEqual(await dl.getSummary({ fetch: f, storage: null, now: () => NOW }), SUMMARY);
});

test('AC-7 every failure resolves null and caches nothing', async () => {
  const cases = {
    'network error': () => Promise.reject(new Error('offline')),
    'rate limit 403': () => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) }),
    'server error 500': () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve([]) }),
    'invalid JSON': () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) }),
    'empty list': okJson([]),
    'object instead of list': okJson({ message: 'nope' }),
    'no matching release': okJson([release('foo', [asset('a.exe', 1)])]),
    'fetch throws synchronously': () => { throw new Error('boom'); },
  };
  for (const [name, respond] of Object.entries(cases)) {
    const st = memoryStorage();
    assert.equal(await dl.getSummary({ fetch: fakeFetch(respond), storage: st, now: () => NOW }), null, name);
    assert.equal(st.map.size, 0, `${name}: nothing cached`);
  }
});

test('AC-7 a request that never answers is aborted by the timeout', async () => {
  const f = fakeFetch((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  assert.equal(await dl.getSummary({ fetch: f, storage: null, now: () => NOW, timeoutMs: 20 }), null);
});

// ---- render: AC-3, AC-6, AC-7, AC-9, AC-12

function fakeDoc(keys) {
  const els = keys.map((k) => {
    const el = {
      key: k, hidden: true, textContent: '',
      getAttribute: (n) => (n === 'data-dl' ? k : null),
    };
    Object.defineProperty(el, 'innerHTML', { set() { assert.fail('innerHTML must never be written'); }, get() { return ''; } });
    return el;
  });
  return { els, querySelectorAll: () => els, by: (k) => els.find((e) => e.key === k) };
}
const KEYS = ['windows', 'macos', 'linux', 'total', 'note'];

test('AC-3 AC-6 AC-12 render fills platforms, grand total and the note', () => {
  const doc = fakeDoc(KEYS);
  dl.render(SUMMARY, doc, 'en');
  assert.equal(doc.by('windows').textContent, 'v2: 22 downloads · 41 total');
  assert.equal(doc.by('macos').textContent, 'v1.2: 3 downloads · 20 total');
  assert.equal(doc.by('linux').textContent, 'v2: 5 downloads · 7 total');
  assert.equal(doc.by('total').textContent, '68 downloads so far');
  for (const k of KEYS) assert.equal(doc.by(k).hidden, false, k);
  const vi = fakeDoc(KEYS);
  dl.render(SUMMARY, vi, 'vi');
  assert.equal(vi.by('total').textContent, '68 lượt tải tính đến nay');
});

test('AC-7 render with no summary touches nothing', () => {
  const doc = fakeDoc(KEYS);
  dl.render(null, doc, 'en');
  for (const k of KEYS) assert.deepEqual([doc.by(k).hidden, doc.by(k).textContent], [true, ''], k);
});

test('AC-7 a platform without data stays hidden while the others show', () => {
  const doc = fakeDoc(KEYS);
  dl.render(dl.summarize(clone(FIXTURE).filter((r) => r.tag_name !== 'mac-v1.2' && r.tag_name !== 'mac-v1.1' && r.tag_name !== 'v1.0')), doc, 'en');
  assert.equal(doc.by('macos').hidden, true);
  assert.equal(doc.by('windows').hidden, false);
  assert.equal(doc.by('total').textContent, '48 downloads so far');
});

test('AC-9 hostile values reach the page only as text', () => {
  const doc = fakeDoc(KEYS);
  const hostile = { windows: { version: '<img src=x onerror=alert(1)>', current: 1, total: 1 }, macos: null, linux: null, grand: 1 };
  assert.equal(dl.isValidSummary(hostile), false);
  dl.render(hostile, doc, 'en'); // render re-validates, so nothing is shown
  for (const k of KEYS) assert.equal(doc.by(k).hidden, true, k);
});

test('AC-7 getSummary resolves null instead of throwing when no fetch exists', async () => {
  // Node has no `window`, so the default browser fetch is unavailable here.
  assert.equal(await dl.getSummary({ storage: null, now: () => NOW }), null);
});
