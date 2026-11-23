/*
 * Download counts for the Download section (see index.html and vi/index.html).
 *
 * Reads the public GitHub Releases API in the visitor's browser and shows, per platform,
 * the downloads of the current version and the all-time total, plus a grand total.
 *
 * KEEP IN SYNC: the tag regexes and asset suffixes below mirror
 * .github/scripts/update_site_downloads.py in gemkids275/AIShortcuts, which decides which
 * release the download buttons point at. Change both together.
 */
(function () {
  'use strict';

  var PLATFORMS = ['windows', 'macos', 'linux'];
  var WIN_TAG = /^win-v(\d+)$/;
  var MAC_TAG = /^(?:mac-)?v(\d+(?:\.\d+)*)$/;
  var KINDS = {
    windows: { tag: WIN_TAG, suffix: '.exe' },
    linux: { tag: WIN_TAG, suffix: '.tar.gz' },
    macos: { tag: MAC_TAG, suffix: '.dmg' }
  };
  var VERSION_LABEL = /^v\d+(\.\d+)*$/;

  function isCount(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0;
  }

  // Numeric compare of "1.10" style parts; missing parts count as 0.
  function compareParts(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var d = (a[i] || 0) - (b[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  // The first asset whose name ends with the suffix, like update_site_downloads.py.
  function findAsset(assets, suffix) {
    if (!Array.isArray(assets)) return null;
    for (var i = 0; i < assets.length; i++) {
      var a = assets[i];
      if (a && typeof a.name === 'string' && a.name.slice(-suffix.length) === suffix) return a;
    }
    return null;
  }

  function summarizeKind(releases, kind) {
    var best = null;
    var total = 0;
    for (var i = 0; i < releases.length; i++) {
      var rel = releases[i];
      if (!rel || typeof rel !== 'object' || rel.draft || rel.prerelease) continue;
      var m = typeof rel.tag_name === 'string' ? kind.tag.exec(rel.tag_name) : null;
      if (!m) continue;
      var asset = findAsset(rel.assets, kind.suffix);
      if (!asset || !isCount(asset.download_count)) continue;
      total += asset.download_count;
      var parts = m[1].split('.').map(Number);
      if (!best || compareParts(parts, best.parts) > 0) {
        best = { parts: parts, version: 'v' + m[1], current: asset.download_count };
      }
    }
    return best ? { version: best.version, current: best.current, total: total } : null;
  }

  function summarize(releases) {
    var list = Array.isArray(releases) ? releases : [];
    var out = { windows: null, macos: null, linux: null, grand: null };
    PLATFORMS.forEach(function (p) {
      out[p] = summarizeKind(list, KINDS[p]);
      if (out[p]) out.grand = (out.grand || 0) + out[p].total;
    });
    return out;
  }

  // Guards a summary read back from localStorage before it is rendered.
  function isValidSummary(s) {
    if (!s || typeof s !== 'object') return false;
    var sum = null;
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = s[PLATFORMS[i]];
      if (p === undefined) return false;
      if (p === null) continue;
      if (typeof p !== 'object' || typeof p.version !== 'string' || !VERSION_LABEL.test(p.version)) return false;
      if (!isCount(p.current) || !isCount(p.total) || p.current > p.total) return false;
      sum = (sum || 0) + p.total;
    }
    return s.grand === sum;
  }

  // ---- text

  var I18N = {
    en: {
      locale: 'en-US',
      card: function (v, cur, total, n) { return v + ': ' + cur + (n === 1 ? ' download' : ' downloads') + ' · ' + total + ' total'; },
      total: function (num, n) { return num + (n === 1 ? ' download' : ' downloads') + ' so far'; }
    },
    vi: {
      locale: 'vi-VN',
      card: function (v, cur, total) { return v + ': ' + cur + ' lượt tải · tổng ' + total; },
      total: function (num) { return num + ' lượt tải tính đến nay'; }
    }
  };

  function strings(lang) { return lang === 'vi' ? I18N.vi : I18N.en; }

  function num(lang, n) {
    try { return new Intl.NumberFormat(strings(lang).locale).format(n); } catch (e) { return String(n); }
  }

  function formatCard(lang, p) {
    return strings(lang).card(p.version, num(lang, p.current), num(lang, p.total), p.current);
  }

  function formatTotal(lang, n) {
    return strings(lang).total(num(lang, n), n);
  }

  // ---- cache (localStorage, 1 hour)

  var REPO = 'gemkids275/AIShortcuts';
  var CACHE_KEY = 'aishortcuts.downloads.v1';
  var TTL_MS = 60 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 8000;

  function readCache(storage, now) {
    try {
      var entry = JSON.parse(storage.getItem(CACHE_KEY));
      if (entry && typeof entry.t === 'number' && entry.t <= now && now - entry.t < TTL_MS && isValidSummary(entry.data)) {
        return entry.data;
      }
    } catch (e) { /* storage unavailable or corrupt entry: treat as a miss */ }
    return null;
  }

  function writeCache(storage, summary, now) {
    try { storage.setItem(CACHE_KEY, JSON.stringify({ t: now, data: summary })); } catch (e) { /* ignore */ }
  }

  function localStorageOrNull() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  // ---- network

  function fetchReleases(opts) {
    var timer = null;
    return new Promise(function (resolve) {
      var doFetch = opts.fetch || fetch.bind(window);
      var init = { headers: { Accept: 'application/vnd.github+json' } };
      if (typeof AbortController === 'function') {
        var controller = new AbortController();
        timer = setTimeout(function () { controller.abort(); }, opts.timeoutMs || FETCH_TIMEOUT_MS);
        init.signal = controller.signal;
      }
      resolve(doFetch('https://api.github.com/repos/' + REPO + '/releases?per_page=100', init));
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (body) {
      clearTimeout(timer);
      return body;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // Resolves a summary, or null on any failure. Never rejects.
  function getSummary(opts) {
    opts = opts || {};
    var storage = 'storage' in opts ? opts.storage : localStorageOrNull();
    var now = opts.now || Date.now;
    var cached = readCache(storage, now());
    if (cached) return Promise.resolve(cached);
    return fetchReleases(opts).then(function (releases) {
      if (!Array.isArray(releases)) return null;
      var summary = summarize(releases);
      if (summary.grand === null) return null;
      writeCache(storage, summary, now());
      return summary;
    }).catch(function () { return null; });
  }

  // ---- page

  function show(el, text) {
    el.textContent = text;
    el.hidden = false;
  }

  // Fills the [data-dl] placeholders. Values reach the page only through textContent.
  function render(summary, doc, lang) {
    if (!isValidSummary(summary)) return;
    var els = doc.querySelectorAll('[data-dl]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-dl');
      if (PLATFORMS.indexOf(key) !== -1) {
        if (summary[key]) show(els[i], formatCard(lang, summary[key]));
      } else if (summary.grand !== null) {
        if (key === 'total') show(els[i], formatTotal(lang, summary.grand));
        else if (key === 'note') els[i].hidden = false;
      }
    }
  }

  function start() {
    var lang = document.documentElement.lang === 'vi' ? 'vi' : 'en';
    getSummary().then(function (summary) { render(summary, document, lang); }).catch(function () { /* leave the page as is */ });
  }

  var api = {
    CACHE_KEY: CACHE_KEY,
    TTL_MS: TTL_MS,
    summarize: summarize,
    isValidSummary: isValidSummary,
    formatCard: formatCard,
    formatTotal: formatTotal,
    readCache: readCache,
    writeCache: writeCache,
    getSummary: getSummary,
    render: render
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})();
