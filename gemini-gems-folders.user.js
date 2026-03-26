// ==UserScript==
// @name         Gemini Gems Folders
// @namespace    https://gemini.google.com
// @version      3.0
// @description  Dodaje foldery do organizacji Gemów w Google Gemini (inline toolbar)
// @author       Łukasz Hodorowicz
// @match        https://gemini.google.com/gems*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────
  const STORAGE_KEY = 'gemini_gems_folders';
  const POLL_INTERVAL = 1500;
  const MAX_RETRIES = 40;

  // ─── DOM helper (Trusted Types safe - no innerHTML) ────────────
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      }
    }
    if (children) {
      var arr = Array.isArray(children) ? children : [children];
      for (var i = 0; i < arr.length; i++) {
        var child = arr[i];
        if (typeof child === 'string') node.appendChild(document.createTextNode(child));
        else if (child) node.appendChild(child);
      }
    }
    return node;
  }

  // ─── STATE ─────────────────────────────────────────────────────
  var folders = loadFolders();
  var activeFolder = null;
  var initialized = false;

  // ─── PERSISTENCE ───────────────────────────────────────────────
  function loadFolders() {
    try {
      var raw = GM_getValue(STORAGE_KEY, '{}');
      return JSON.parse(raw);
    } catch (e) { return {}; }
  }

  function saveFolders() {
    GM_setValue(STORAGE_KEY, JSON.stringify(folders));
  }

  // ─── HELPERS ───────────────────────────────────────────────────
  function getGemId(row) {
    var link = row.querySelector('a.bot-row');
    if (!link) return null;
    var href = link.getAttribute('href') || '';
    var match = href.match(/\/gem\/([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  function getGemTitle(row) {
    var span = row.querySelector('.gds-title-m.title');
    return span ? span.textContent.trim() : '?';
  }

  function getAllGemRows() {
    return Array.from(document.querySelectorAll('bot-list-row'));
  }

  function gemInFolder(gemId, folderName) {
    return (folders[folderName] || []).indexOf(gemId) >= 0;
  }

  function gemInAnyFolder(gemId) {
    var keys = Object.keys(folders);
    for (var i = 0; i < keys.length; i++) {
      if (folders[keys[i]].indexOf(gemId) >= 0) return true;
    }
    return false;
  }

  // ─── STYLES ────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ggf-styles')) return;
    var style = document.createElement('style');
    style.id = 'ggf-styles';
    style.textContent = [
      // Toolbar container
      '#ggf-toolbar { padding: 12px 0 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }',
      // Folder chips
      '.ggf-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 18px; border: 1px solid #555; background: transparent; color: #c4c7c5; font-size: 13px; cursor: pointer; transition: all .15s; font-family: "Google Sans", Roboto, sans-serif; white-space: nowrap; }',
      '.ggf-chip:hover { background: #333; border-color: #777; }',
      '.ggf-chip.active { background: #004a77; border-color: #8ab4f8; color: #8ab4f8; }',
      '.ggf-chip .ggf-chip-count { font-size: 11px; color: #888; margin-left: 2px; }',
      '.ggf-chip.active .ggf-chip-count { color: #8ab4f8; }',
      '.ggf-chip .ggf-chip-x { margin-left: 4px; font-size: 12px; color: #888; cursor: pointer; padding: 0 2px; }',
      '.ggf-chip .ggf-chip-x:hover { color: #f28b82; }',
      // Add folder chip
      '.ggf-chip-add { border-style: dashed; color: #8ab4f8; border-color: #8ab4f8; opacity: .7; }',
      '.ggf-chip-add:hover { opacity: 1; background: rgba(138,180,248,.08); }',
      // Search
      '#ggf-search-inline { padding: 6px 12px; border-radius: 18px; border: 1px solid #555; background: #1e1e1e; color: #e0e0e0; font-size: 13px; outline: none; width: 160px; font-family: "Google Sans", Roboto, sans-serif; margin-left: auto; }',
      '#ggf-search-inline::placeholder { color: #666; }',
      '#ggf-search-inline:focus { border-color: #8ab4f8; }',
      // Assign dropdown
      '.ggf-assign-menu { position: fixed; background: #2d2d2d; border: 1px solid #444; border-radius: 8px; padding: 8px 0; min-width: 200px; z-index: 10001; box-shadow: 0 4px 12px rgba(0,0,0,.4); font-family: "Google Sans", Roboto, sans-serif; }',
      '.ggf-assign-menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; cursor: pointer; font-size: 13px; color: #e0e0e0; transition: background .1s; }',
      '.ggf-assign-menu-item:hover { background: #3a3a3a; }',
      '.ggf-assign-menu-item .ggf-check { width: 16px; text-align: center; color: #8ab4f8; font-size: 14px; }',
      // Assign button on each gem row
      '.ggf-assign-btn { background: none; border: 1px solid #555; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #8ab4f8; font-size: 14px; margin-right: 4px; transition: background .15s; flex-shrink: 0; }',
      '.ggf-assign-btn:hover { background: #333; }',
      // Badge on gem title
      '.ggf-badge { display: inline-block; font-size: 10px; background: #004a77; color: #8ab4f8; padding: 2px 8px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── BUILD TOOLBAR ─────────────────────────────────────────────
  function buildToolbar() {
    if (document.getElementById('ggf-toolbar')) return false;

    // Find insertion point: between .list-header and .bot-list-container
    var inner = document.querySelector('.inner-container');
    if (!inner) return false;

    var listHeader = inner.querySelector('.list-header');
    var botListContainer = inner.querySelector('.bot-list-container');
    if (!listHeader || !botListContainer) return false;

    var toolbar = el('div', { id: 'ggf-toolbar' });
    inner.insertBefore(toolbar, botListContainer);

    // Search input (on the right)
    var search = el('input', { type: 'text', id: 'ggf-search-inline', placeholder: 'Szukaj gema...' });
    search.addEventListener('input', filterGems);

    renderChips();
    return true;
  }

  // ─── RENDER CHIPS ──────────────────────────────────────────────
  function renderChips() {
    var toolbar = document.getElementById('ggf-toolbar');
    if (!toolbar) return;

    // Preserve search value
    var searchEl = document.getElementById('ggf-search-inline');
    var searchVal = searchEl ? searchEl.value : '';

    // Clear
    while (toolbar.firstChild) toolbar.removeChild(toolbar.firstChild);

    var totalGems = getAllGemRows().length;

    // "Wszystkie" chip
    toolbar.appendChild(createChip(null, 'Wszystkie', totalGems));

    // "Bez folderu" chip
    var unassignedCount = getAllGemRows().filter(function (r) {
      var id = getGemId(r);
      return id && !gemInAnyFolder(id);
    }).length;
    toolbar.appendChild(createChip('__unassigned__', 'Bez folderu', unassignedCount));

    // User folder chips
    var keys = Object.keys(folders);
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      toolbar.appendChild(createChip(name, name, folders[name].length, true));
    }

    // Add folder chip
    var addChip = el('button', { className: 'ggf-chip ggf-chip-add', textContent: '+ Folder' });
    addChip.addEventListener('click', addFolder);
    toolbar.appendChild(addChip);

    // Search (push to right with margin-left: auto)
    var search = el('input', { type: 'text', id: 'ggf-search-inline', placeholder: 'Szukaj gema...' });
    search.value = searchVal;
    search.addEventListener('input', filterGems);
    toolbar.appendChild(search);
  }

  function createChip(key, label, count, deletable) {
    var isActive = activeFolder === key;
    var chip = el('button', { className: 'ggf-chip' + (isActive ? ' active' : '') });

    chip.appendChild(document.createTextNode(label));

    var countSpan = el('span', { className: 'ggf-chip-count', textContent: '(' + count + ')' });
    chip.appendChild(countSpan);

    if (deletable) {
      var x = el('span', { className: 'ggf-chip-x', textContent: '\u2715' });
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Usun\u0105\u0107 folder "' + label + '"?')) {
          delete folders[label];
          saveFolders();
          if (activeFolder === label) activeFolder = null;
          renderChips();
          filterGems();
        }
      });
      chip.appendChild(x);
    }

    chip.addEventListener('click', function () {
      activeFolder = (activeFolder === key) ? null : key;
      renderChips();
      filterGems();
    });

    return chip;
  }

  // ─── ADD FOLDER ────────────────────────────────────────────────
  function addFolder() {
    var name = prompt('Nazwa nowego folderu:');
    if (!name || !name.trim()) return;
    var trimmed = name.trim();
    if (folders[trimmed]) {
      alert('Folder o tej nazwie ju\u017C istnieje.');
      return;
    }
    folders[trimmed] = [];
    saveFolders();
    activeFolder = trimmed;
    renderChips();
    filterGems();
  }

  // ─── FILTER GEMS ──────────────────────────────────────────────
  function filterGems() {
    var searchEl = document.getElementById('ggf-search-inline');
    var term = searchEl ? searchEl.value.toLowerCase() : '';
    var rows = getAllGemRows();

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var id = getGemId(row);
      var title = getGemTitle(row).toLowerCase();
      var visible = true;

      if (activeFolder === '__unassigned__') {
        visible = id ? !gemInAnyFolder(id) : true;
      } else if (activeFolder !== null) {
        visible = id ? gemInFolder(id, activeFolder) : false;
      }

      if (visible && term) {
        visible = title.indexOf(term) >= 0;
      }

      row.style.display = visible ? '' : 'none';
    }
  }

  // ─── INJECT ASSIGN BUTTONS ────────────────────────────────────
  function injectAssignButtons() {
    var rows = getAllGemRows();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.querySelector('.ggf-assign-btn')) continue;
      var actions = row.querySelector('.bot-row-actions');
      if (!actions) continue;

      var btn = el('button', { className: 'ggf-assign-btn', title: 'Przypisz do folderu', textContent: '\uD83D\uDCC1' });
      (function (b, r) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          showAssignMenu(b, r);
        });
      })(btn, row);
      actions.insertBefore(btn, actions.firstChild);

      updateBadge(row);
    }
  }

  // ─── ASSIGN MENU ──────────────────────────────────────────────
  function showAssignMenu(anchor, row) {
    closeAllMenus();
    var gemId = getGemId(row);
    if (!gemId) return;

    var menu = el('div', { className: 'ggf-assign-menu' });

    var folderNames = Object.keys(folders);
    if (folderNames.length === 0) {
      var empty = el('div', {
        className: 'ggf-assign-menu-item',
        textContent: 'Najpierw stw\u00F3rz folder...',
        style: { color: '#888' }
      });
      empty.addEventListener('click', function () { closeAllMenus(); addFolder(); });
      menu.appendChild(empty);
    } else {
      for (var i = 0; i < folderNames.length; i++) {
        (function (name) {
          var inF = gemInFolder(gemId, name);
          var checkSpan = el('span', { className: 'ggf-check', textContent: inF ? '\u2713' : '' });
          var nameSpan = el('span', { textContent: name });
          var item = el('div', { className: 'ggf-assign-menu-item' }, [checkSpan, nameSpan]);
          item.addEventListener('click', function () {
            toggleGemInFolder(gemId, name);
            closeAllMenus();
            updateBadge(row);
            renderChips();
            filterGems();
          });
          menu.appendChild(item);
        })(folderNames[i]);
      }
    }

    var rect = anchor.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = Math.max(8, rect.left - 80) + 'px';
    document.body.appendChild(menu);

    setTimeout(function () {
      document.addEventListener('click', closeAllMenus, { once: true });
    }, 50);
  }

  function closeAllMenus() {
    var menus = document.querySelectorAll('.ggf-assign-menu');
    for (var i = 0; i < menus.length; i++) menus[i].remove();
  }

  function toggleGemInFolder(gemId, folderName) {
    if (!folders[folderName]) folders[folderName] = [];
    var idx = folders[folderName].indexOf(gemId);
    if (idx >= 0) {
      folders[folderName].splice(idx, 1);
    } else {
      folders[folderName].push(gemId);
    }
    saveFolders();
  }

  // ─── BADGE ─────────────────────────────────────────────────────
  function updateBadge(row) {
    var gemId = getGemId(row);
    if (!gemId) return;

    var old = row.querySelectorAll('.ggf-badge');
    for (var i = 0; i < old.length; i++) old[i].remove();

    var titleContainer = row.querySelector('.title-container');
    if (!titleContainer) return;

    var keys = Object.keys(folders);
    for (var j = 0; j < keys.length; j++) {
      if (folders[keys[j]].indexOf(gemId) >= 0) {
        titleContainer.appendChild(el('span', { className: 'ggf-badge', textContent: keys[j] }));
      }
    }
  }

  // ─── EXPORT / IMPORT ──────────────────────────────────────────
  window.ggfExport = function () {
    var data = JSON.stringify(folders, null, 2);
    console.log('Gemini Gems Folders - Export:');
    console.log(data);
    return data;
  };

  window.ggfImport = function (json) {
    try {
      var data = typeof json === 'string' ? JSON.parse(json) : json;
      folders = data;
      saveFolders();
      renderChips();
      injectAssignButtons();
      filterGems();
      console.log('Import OK!');
    } catch (e) {
      console.error('Import error:', e);
    }
  };

  // ─── INIT ──────────────────────────────────────────────────────
  function tryInit(retry) {
    retry = retry || 0;
    var rows = getAllGemRows();

    // Wait for gems AND the inner-container to load
    var inner = document.querySelector('.inner-container');
    var listHeader = inner ? inner.querySelector('.list-header') : null;

    if ((rows.length === 0 || !listHeader) && retry < MAX_RETRIES) {
      setTimeout(function () { tryInit(retry + 1); }, POLL_INTERVAL);
      return;
    }

    if (initialized) return;
    initialized = true;

    injectStyles();
    var toolbarOk = buildToolbar();
    injectAssignButtons();
    if (toolbarOk) filterGems();

    // Observer for dynamically loaded gems
    var container = document.querySelector('.bots-section-container');
    if (container) {
      var debounceTimer = null;
      var observer = new MutationObserver(function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          injectAssignButtons();
          renderChips();
          filterGems();
        }, 300);
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    console.log('[Gemini Gems Folders] v3.0 loaded. Gems: ' + rows.length);
  }

  // Start
  if (document.readyState === 'complete') {
    tryInit();
  } else {
    window.addEventListener('load', function () { tryInit(); });
  }
})();
