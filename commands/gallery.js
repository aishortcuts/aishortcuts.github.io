(function () {
  'use strict';

  var lang = document.documentElement.lang === 'vi' ? 'vi' : 'en';

  var I18N = {
    en: {
      all: 'All',
      searchPlaceholder: 'Search commands by name, tag, author, or prompt...',
      countZero: '0 commands found',
      countOne: '1 command found',
      countMany: function (n) { return n + ' commands found'; },
      by: 'by ',
      showPrompt: 'Show prompt',
      copyPrompt: 'Copy prompt',
      copied: '✓ Copied',
      download: 'Download',
      select: 'Select',
      selectedCount: function (n) { return n + ' selected'; },
      downloadSelected: function (n) { return 'Download selected (' + n + ')'; },
      downloadAll: function (n) { return 'Download all (' + n + ')'; },
      packError: 'Could not build the file. Please try again, or download the commands one by one.',
      loading: 'Loading commands...',
      empty: 'No commands found matching your criteria.',
      error: 'Could not load commands at this time. Please refresh the page or browse commands directly on GitHub.',
      categories: {
        writing: 'Writing',
        email: 'Email',
        translation: 'Translation',
        summarizing: 'Summarizing',
        coding: 'Coding',
        learning: 'Learning',
        productivity: 'Productivity'
      }
    },
    vi: {
      all: 'Tất cả',
      searchPlaceholder: 'Tìm kiếm lệnh theo tên, thẻ, tác giả hoặc prompt...',
      countZero: 'Không tìm thấy lệnh nào',
      countOne: 'Tìm thấy 1 lệnh',
      countMany: function (n) { return 'Tìm thấy ' + n + ' lệnh'; },
      by: 'Bởi ',
      showPrompt: 'Xem prompt',
      copyPrompt: 'Sao chép prompt',
      copied: '✓ Đã sao chép',
      download: 'Tải về',
      select: 'Chọn',
      selectedCount: function (n) { return 'Đã chọn ' + n; },
      downloadSelected: function (n) { return 'Tải các lệnh đã chọn (' + n + ')'; },
      downloadAll: function (n) { return 'Tải tất cả (' + n + ')'; },
      packError: 'Không thể tạo tệp. Vui lòng thử lại hoặc tải từng lệnh một.',
      loading: 'Đang tải danh sách lệnh...',
      empty: 'Không tìm thấy lệnh nào phù hợp với tìm kiếm.',
      error: 'Không thể tải danh sách lệnh lúc này. Vui lòng tải lại trang hoặc xem trực tiếp trên GitHub.',
      categories: {
        writing: 'Viết lách',
        email: 'Email',
        translation: 'Dịch thuật',
        summarizing: 'Tóm tắt',
        coding: 'Lập trình',
        learning: 'Học tập',
        productivity: 'Năng suất'
      }
    }
  };

  var t = I18N[lang];

  var CATEGORY_PATHS = {
    writing: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    email: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2l8 5 8-5',
    translation: 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    summarizing: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    coding: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    learning: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z',
    productivity: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z'
  };
  var DEFAULT_PATH = 'm4 17 6-6-6-6M12 19h8';

  var allCommands = [];
  var activeCategory = 'all';
  var searchQuery = '';
  var selected = {};

  var searchInput = document.getElementById('command-search');
  var filtersContainer = document.getElementById('category-filters');
  var resultCountEl = document.getElementById('result-count');
  var gridEl = document.getElementById('cmd-grid');
  var loadingEl = document.getElementById('loading-state');
  var emptyEl = document.getElementById('empty-state');
  var errorEl = document.getElementById('error-state');
  var packBar = document.getElementById('pack-bar');
  var selectedCountEl = document.getElementById('selected-count');
  var selectVisibleBtn = document.getElementById('select-visible');
  var clearSelectionBtn = document.getElementById('clear-selection');
  var downloadSelectedBtn = document.getElementById('download-selected');
  var downloadAllBtn = document.getElementById('download-all');
  var packErrorEl = document.getElementById('pack-error');
  var visibleCommands = [];

  function removeDiacritics(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, function (m) { return m === 'đ' ? 'd' : 'D'; });
  }

  function normalize(str) {
    return removeDiacritics(str || '').toLowerCase().trim();
  }

  function createCategorySvg(category) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var d = CATEGORY_PATHS[category] || DEFAULT_PATH;
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function getCategoryLabel(category) {
    if (!category) return '';
    if (t.categories && t.categories[category]) {
      return t.categories[category];
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  function showCopiedState(btn) {
    var original = btn.textContent;
    btn.textContent = t.copied;
    btn.classList.add('btn-copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('btn-copied');
    }, 2000);
  }

  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopiedState(btn);
      }).catch(function () {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showCopiedState(btn);
    } catch (e) {
      console.error('Copy failed', e);
    }
    document.body.removeChild(ta);
  }

  var SLUG_RE = /^[a-zA-Z0-9_-]+$/;
  // Apple's reference date (2001-01-01) in Unix seconds: the apps decode exportDate with it.
  var APPLE_EPOCH = 978307200;

  function safeSlug(cmd) {
    return cmd && typeof cmd.slug === 'string' && SLUG_RE.test(cmd.slug) ? cmd.slug : '';
  }

  function selectedList() {
    return allCommands.filter(function (cmd) { return selected[safeSlug(cmd)]; });
  }

  function updatePackBar() {
    if (!packBar) return;
    var n = selectedList().length;
    packBar.hidden = allCommands.length === 0;
    selectedCountEl.textContent = t.selectedCount(n);
    downloadSelectedBtn.textContent = t.downloadSelected(n);
    downloadSelectedBtn.disabled = n === 0;
    clearSelectionBtn.disabled = n === 0;
    downloadAllBtn.textContent = t.downloadAll(allCommands.length);
  }

  // Keeps only the fields the apps read, so a pack never carries anything else.
  function pickCommand(file) {
    var c = file && Array.isArray(file.commands) ? file.commands[0] : null;
    if (!c || typeof c !== 'object') throw new Error('bad command file');
    ['id', 'name', 'prompt', 'icon'].forEach(function (k) {
      if (typeof c[k] !== 'string' || !c[k]) throw new Error('bad field ' + k);
    });
    return {
      id: c.id,
      name: c.name,
      prompt: c.prompt,
      icon: c.icon,
      useResponseWindow: c.useResponseWindow === true,
      isBuiltIn: false,
      hasShortcut: false,
      preserveFormatting: c.preserveFormatting === true
    };
  }

  function downloadPack(cmds, fileName) {
    packErrorEl.hidden = true;
    var requests = cmds.map(function (cmd) {
      var slug = safeSlug(cmd);
      if (!slug) return Promise.reject(new Error('bad slug'));
      return fetch('/data/commands/' + encodeURIComponent(slug) + '.json').then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(pickCommand);
    });
    Promise.all(requests).then(function (commands) {
      var pack = {
        appIdentifier: 'AIShortcuts',
        version: 1,
        exportDate: Date.now() / 1000 - APPLE_EPOCH,
        commands: commands
      };
      var blob = new Blob([JSON.stringify(pack, null, 2) + '\n'], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }).catch(function (err) {
      console.error('Pack download failed', err);
      packErrorEl.textContent = t.packError;
      packErrorEl.hidden = false;
    });
  }

  function renderCard(cmd) {
    var pickSlug = safeSlug(cmd);
    var isSelected = pickSlug && !!selected[pickSlug];

    var card = document.createElement('article');
    card.className = 'card cmd-card' + (isSelected ? ' is-selected' : '');

    var header = document.createElement('div');
    header.className = 'cmd-header';

    var catBadge = document.createElement('div');
    catBadge.className = 'cmd-cat-badge';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'cmd-cat-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.appendChild(createCategorySvg(cmd.category));
    catBadge.appendChild(iconSpan);

    var catChip = document.createElement('span');
    catChip.className = 'cmd-category-chip';
    catChip.textContent = getCategoryLabel(cmd.category);
    catBadge.appendChild(catChip);

    header.appendChild(catBadge);

    if (pickSlug) {
      var selectTarget = document.createElement('label');
      selectTarget.className = 'cmd-select cmd-select-target';
      var selectTitle = t.select + ': ' + (cmd.name || pickSlug);
      selectTarget.title = selectTitle;

      var pickBox = document.createElement('input');
      pickBox.type = 'checkbox';
      pickBox.className = 'cmd-select-input';
      pickBox.checked = isSelected;
      pickBox.setAttribute('aria-label', selectTitle);
      pickBox.addEventListener('change', function () {
        if (pickBox.checked) {
          selected[pickSlug] = true;
          card.classList.add('is-selected');
        } else {
          delete selected[pickSlug];
          card.classList.remove('is-selected');
        }
        updatePackBar();
      });

      var hiddenText = document.createElement('span');
      hiddenText.className = 'visually-hidden';
      hiddenText.textContent = selectTitle;

      selectTarget.appendChild(pickBox);
      selectTarget.appendChild(hiddenText);
      header.appendChild(selectTarget);
    }

    card.appendChild(header);

    var nameEl = document.createElement('h3');
    nameEl.className = 'cmd-name';
    nameEl.textContent = cmd.name || '';
    card.appendChild(nameEl);

    // Description: localized fallback
    var descText = '';
    if (cmd.description) {
      if (typeof cmd.description === 'string') {
        descText = cmd.description;
      } else if (lang === 'vi' && cmd.description.vi) {
        descText = cmd.description.vi;
      } else if (cmd.description.en) {
        descText = cmd.description.en;
      } else if (cmd.description.vi) {
        descText = cmd.description.vi;
      }
    }
    var descEl = document.createElement('p');
    descEl.className = 'cmd-desc';
    descEl.textContent = descText;
    card.appendChild(descEl);

    // Tags
    if (Array.isArray(cmd.tags) && cmd.tags.length > 0) {
      var tagsWrap = document.createElement('div');
      tagsWrap.className = 'cmd-tags';
      for (var i = 0; i < cmd.tags.length; i++) {
        var tag = cmd.tags[i];
        if (typeof tag === 'string' && tag.trim()) {
          var tagSpan = document.createElement('span');
          tagSpan.className = 'cmd-tag';
          tagSpan.textContent = '#' + tag.trim();
          tagsWrap.appendChild(tagSpan);
        }
      }
      card.appendChild(tagsWrap);
    }

    // Author
    var author = typeof cmd.author === 'string' ? cmd.author.trim() : '';
    if (author) {
      var metaEl = document.createElement('div');
      metaEl.className = 'cmd-meta';

      var byLabel = document.createElement('span');
      byLabel.className = 'cmd-by-label';
      byLabel.textContent = t.by;
      metaEl.appendChild(byLabel);

      var validGithubUser = /^[A-Za-z0-9-]{1,39}$/.test(author);
      if (validGithubUser) {
        var authorLink = document.createElement('a');
        authorLink.className = 'cmd-author-link';
        authorLink.href = 'https://github.com/' + encodeURIComponent(author);
        authorLink.target = '_blank';
        authorLink.rel = 'noopener noreferrer';
        authorLink.textContent = '@' + author;
        metaEl.appendChild(authorLink);
      } else {
        var authorSpan = document.createElement('span');
        authorSpan.className = 'cmd-author-name';
        authorSpan.textContent = author;
        metaEl.appendChild(authorSpan);
      }
      card.appendChild(metaEl);
    }

    // Prompt details
    var details = document.createElement('details');
    details.className = 'cmd-prompt-details';

    var summary = document.createElement('summary');
    summary.className = 'cmd-prompt-summary';
    summary.textContent = t.showPrompt;
    details.appendChild(summary);

    var pre = document.createElement('pre');
    pre.className = 'cmd-prompt-text';
    pre.textContent = cmd.prompt || '';
    details.appendChild(pre);

    card.appendChild(details);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'cmd-actions';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn alt cmd-btn-copy';
    copyBtn.textContent = t.copyPrompt;
    copyBtn.setAttribute('aria-label', t.copyPrompt + ': ' + (cmd.name || ''));
    copyBtn.addEventListener('click', function () {
      copyText(cmd.prompt || '', copyBtn);
    });
    actions.appendChild(copyBtn);

    // Download link strictly built from validated slug
    var slug = safeSlug(cmd);
    if (slug) {
      var dlLink = document.createElement('a');
      dlLink.className = 'btn btn-primary cmd-btn-download';
      dlLink.href = '/data/commands/' + encodeURIComponent(slug) + '.json';
      dlLink.setAttribute('download', slug + '.json');
      dlLink.textContent = t.download;
      dlLink.setAttribute('aria-label', t.download + ': ' + (cmd.name || slug));
      actions.appendChild(dlLink);
    }

    card.appendChild(actions);
    return card;
  }

  function filterAndRender() {
    var q = normalize(searchQuery);
    var filtered = [];

    for (var i = 0; i < allCommands.length; i++) {
      var cmd = allCommands[i];

      // Category check
      if (activeCategory !== 'all' && cmd.category !== activeCategory) {
        continue;
      }

      // Search check
      if (q) {
        var nameMatch = normalize(cmd.name).indexOf(q) !== -1;
        var descEnMatch = cmd.description && cmd.description.en && normalize(cmd.description.en).indexOf(q) !== -1;
        var descViMatch = cmd.description && cmd.description.vi && normalize(cmd.description.vi).indexOf(q) !== -1;
        var authorMatch = normalize(cmd.author).indexOf(q) !== -1;
        var tagsMatch = false;
        if (Array.isArray(cmd.tags)) {
          for (var j = 0; j < cmd.tags.length; j++) {
            if (normalize(cmd.tags[j]).indexOf(q) !== -1) {
              tagsMatch = true;
              break;
            }
          }
        }
        var promptMatch = normalize(cmd.prompt).indexOf(q) !== -1;

        if (!nameMatch && !descEnMatch && !descViMatch && !authorMatch && !tagsMatch && !promptMatch) {
          continue;
        }
      }

      filtered.push(cmd);
    }

    visibleCommands = filtered;

    // Update result count
    if (resultCountEl) {
      if (filtered.length === 0) {
        resultCountEl.textContent = t.countZero;
      } else if (filtered.length === 1) {
        resultCountEl.textContent = t.countOne;
      } else {
        resultCountEl.textContent = t.countMany(filtered.length);
      }
    }

    // Render cards
    gridEl.textContent = ''; // safe clear
    if (filtered.length === 0) {
      gridEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      gridEl.style.display = 'grid';
      for (var k = 0; k < filtered.length; k++) {
        gridEl.appendChild(renderCard(filtered[k]));
      }
    }
  }

  function buildFilterChips(categories) {
    if (!filtersContainer) return;
    filtersContainer.textContent = '';

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'filter-chip active';
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.textContent = t.all;
    allBtn.addEventListener('click', function () {
      setActiveCategory('all');
    });
    filtersContainer.appendChild(allBtn);

    if (Array.isArray(categories)) {
      for (var i = 0; i < categories.length; i++) {
        (function (cat) {
          if (typeof cat !== 'string' || !cat.trim()) return;
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'filter-chip';
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = getCategoryLabel(cat);
          btn.addEventListener('click', function () {
            setActiveCategory(cat);
          });
          filtersContainer.appendChild(btn);
        })(categories[i]);
      }
    }
  }

  function setActiveCategory(cat) {
    activeCategory = cat;
    var chips = filtersContainer.querySelectorAll('.filter-chip');
    chips.forEach(function (chip, idx) {
      var isTarget = false;
      if (cat === 'all' && idx === 0) isTarget = true;
      else if (idx > 0) {
        var label = getCategoryLabel(cat);
        if (chip.textContent === label) isTarget = true;
      }
      if (isTarget) {
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
      } else {
        chip.classList.remove('active');
        chip.setAttribute('aria-pressed', 'false');
      }
    });
    filterAndRender();
  }

  function init() {
    if (searchInput) {
      searchInput.placeholder = t.searchPlaceholder;
      searchInput.addEventListener('input', function (e) {
        searchQuery = e.target.value;
        filterAndRender();
      });
    }

    if (packBar) {
      selectVisibleBtn.addEventListener('click', function () {
        visibleCommands.forEach(function (cmd) {
          var slug = safeSlug(cmd);
          if (slug) selected[slug] = true;
        });
        filterAndRender();
        updatePackBar();
      });
      clearSelectionBtn.addEventListener('click', function () {
        selected = {};
        filterAndRender();
        updatePackBar();
      });
      downloadSelectedBtn.addEventListener('click', function () {
        downloadPack(selectedList(), 'ai-shortcuts-commands.json');
      });
      downloadAllBtn.addEventListener('click', function () {
        downloadPack(allCommands, 'ai-shortcuts-all-commands.json');
      });
    }

    if (loadingEl) loadingEl.style.display = 'block';
    if (gridEl) gridEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';

    fetch('/data/commands/index.json')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        if (loadingEl) loadingEl.style.display = 'none';

        allCommands = Array.isArray(data.commands) ? data.commands : [];
        var categories = Array.isArray(data.categories) ? data.categories : [];

        if (categories.length === 0 && allCommands.length > 0) {
          var catSet = {};
          for (var i = 0; i < allCommands.length; i++) {
            if (allCommands[i].category) catSet[allCommands[i].category] = true;
          }
          categories = Object.keys(catSet);
        }

        buildFilterChips(categories);
        filterAndRender();
        updatePackBar();
      })
      .catch(function (err) {
        console.error('Failed to load commands data', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (gridEl) gridEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
        if (resultCountEl) resultCountEl.textContent = '';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
