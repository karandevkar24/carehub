// ============================================================
// CareHub -- i18n Translation Engine  (js/i18n.js)
// Encoding : UTF-8
// Requires : translations.js loaded BEFORE this file
// ============================================================
// Public API:
//   window.CareHubI18n.t(key, lang?)   -> translated string
//   window.CareHubI18n.setLang(lang)   -> switch + apply
//   window.CareHubI18n.apply(lang?)    -> re-apply to DOM
//   window.CareHubI18n.getCurrentLang()
// ============================================================
(function () {
  'use strict';

  var STORAGE_KEY = 'careHub_lang';
  var DEFAULT     = 'en';
  var SUPPORTED   = ['en', 'hi', 'mr', 'te'];
  var LABELS      = {
    en: 'EN',
    hi: '\u0939\u093f\u0902\u0926\u0940',
    mr: '\u092e\u0930\u093e\u0920\u0940',
    te: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41'
  };

  // -- Helpers --------------------------------------------------

  function currentLang() {
    try {
      var l = localStorage.getItem(STORAGE_KEY);
      return (SUPPORTED.indexOf(l) !== -1) ? l : DEFAULT;
    } catch (_) { return DEFAULT; }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  }

  function resolve(obj, key) {
    if (!obj || !key) return null;
    var parts = key.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return (typeof cur === 'string') ? cur : null;
  }

  function t(key, lang) {
    var T = window.CAREHUB_TRANSLATIONS;
    if (!T) return key;
    lang = lang || currentLang();
    var val = resolve(T[lang], key);
    if (val == null && lang !== DEFAULT) val = resolve(T[DEFAULT], key);
    return (val != null) ? val : key;
  }

  // -- DOM Application ------------------------------------------

  function applyTranslations(lang) {
    lang = lang || currentLang();
    var T = window.CAREHUB_TRANSLATIONS;
    if (!T) return;

    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key  = els[i].getAttribute('data-i18n');
      var text = t(key, lang);
      if (text && text !== key) els[i].textContent = text;
    }

    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < htmlEls.length; j++) {
      var hkey  = htmlEls[j].getAttribute('data-i18n-html');
      var htext = t(hkey, lang);
      if (htext && htext !== hkey) htmlEls[j].innerHTML = htext;
    }

    var phEls = document.querySelectorAll('[data-i18n-placeholder]');
    for (var k = 0; k < phEls.length; k++) {
      var pkey  = phEls[k].getAttribute('data-i18n-placeholder');
      var ptext = t(pkey, lang);
      if (ptext && ptext !== pkey) phEls[k].placeholder = ptext;
    }

    var langMap = { hi: 'hi', mr: 'mr', te: 'te', en: 'en' };
    document.documentElement.setAttribute('lang', langMap[lang] || 'en');

    var btns = document.querySelectorAll('.ch-lang-btn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', btns[b].getAttribute('data-lang') === lang);
    }
  }

  // -- Stylesheet Injection -------------------------------------

  function injectStyles() {
    if (document.getElementById('ch-i18n-styles')) return;
    var s = document.createElement('style');
    s.id = 'ch-i18n-styles';
    s.textContent =
      '.ch-lang-selector{' +
        'display:inline-flex !important;align-items:center;gap:3px;' +
        'padding:3px;border-radius:99px;flex-shrink:0;' +
        'background:#f1f5f9;border:1.5px solid #e2e8f0;' +
        'box-shadow:0 1px 2px rgba(0,0,0,0.04);' +
        'overflow:visible !important;white-space:nowrap;' +
      '}' +
      '.ch-lang-btn{' +
        'display:inline-block !important;padding:4px 9px;border:none;' +
        'background:transparent;border-radius:99px;' +
        'cursor:pointer !important;' +
        'font-family:Inter,system-ui,-apple-system,sans-serif;' +
        'font-size:0.72rem;font-weight:700;color:#475569;' +
        'white-space:nowrap;transition:all 0.18s ease;line-height:1.1;' +
        'pointer-events:auto !important;' +
      '}' +
      '.ch-lang-btn:hover{background:rgba(8,145,178,0.10);color:#0891b2;}' +
      '.ch-lang-btn.active{' +
        'background:#0891b2;color:#fff;' +
        'box-shadow:0 1px 4px rgba(8,145,178,0.35);' +
      '}' +
      '.ch-lang-selector.is-dark{' +
        'background:rgba(255,255,255,0.08);' +
        'border:1.5px solid rgba(255,255,255,0.18);box-shadow:none;' +
      '}' +
      '.ch-lang-selector.is-dark .ch-lang-btn{color:rgba(255,255,255,0.75);}' +
      '.ch-lang-selector.is-dark .ch-lang-btn:hover{background:rgba(255,255,255,0.15);color:#fff;}' +
      '.ch-lang-selector.is-dark .ch-lang-btn.active{' +
        'background:#0891b2;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
      '}' +
      '@media(max-width:600px){' +
        '.ch-lang-selector{padding:2px;gap:1px;}' +
        '.ch-lang-btn{padding:3px 6px;font-size:0.65rem;}' +
      '}';
    document.head.appendChild(s);
  }

  // -- Language Selector Injection ------------------------------

  function isDarkTheme() {
    try {
      var hdr = document.querySelector('.site-header, .page-header, header');
      var el  = hdr || document.body;
      if (!el) return false;
      var bg = window.getComputedStyle(el).backgroundColor;
      var m  = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        var r = parseInt(m[1], 10), g = parseInt(m[2], 10), bv = parseInt(m[3], 10);
        return (r * 299 + g * 587 + bv * 114) / 1000 < 128;
      }
    } catch (_) {}
    return false;
  }

  // Build the 4-button pill using a plain for-loop with IIFE closures.
  // forEach is avoided because a mid-iteration exception would silently
  // stop the loop, leaving a partial (1-button) selector in the DOM.
  function buildSelector(lang, darkTheme) {
    var wrap = document.createElement('div');
    wrap.id        = 'ch-lang-selector';
    wrap.className = 'ch-lang-selector' + (darkTheme ? ' is-dark' : ' is-light');
    wrap.setAttribute('role',       'group');
    wrap.setAttribute('aria-label', 'Select language');

    for (var i = 0; i < SUPPORTED.length; i++) {
      (function (l) {
        var btn       = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'ch-lang-btn' + (l === lang ? ' active' : '');
        btn.setAttribute('data-lang', l);
        btn.setAttribute('title',     LABELS[l]);
        btn.textContent = LABELS[l];
        // Use onclick (not addEventListener) for maximum compatibility
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          saveLang(l);
          applyTranslations(l);
          return false;
        };
        wrap.appendChild(btn);
      }(SUPPORTED[i]));
    }
    return wrap;
  }

  function injectSelector() {
    // If a selector already exists with all 4 buttons, nothing to do.
    // If it exists but is partial (< 4 buttons), remove it and rebuild.
    var existing     = document.getElementById('ch-lang-selector');
    var existingBtns = existing ? existing.querySelectorAll('.ch-lang-btn').length : 0;
    if (existing && existingBtns === SUPPORTED.length) return;
    if (existing) existing.parentNode && existing.parentNode.removeChild(existing);

    var lang      = currentLang();
    var darkTheme = isDarkTheme();
    var sel       = buildSelector(lang, darkTheme);

    // 1. Dashboard: .header-controls
    var hc = document.querySelector('.header-controls');
    if (hc) { hc.insertBefore(sel, hc.firstChild); return; }

    // 2. Sub-pages: .ph-inner
    var phi = document.querySelector('.ph-inner');
    if (phi) {
      var av = phi.querySelector('.avatar-sm, #header-avatar, #hdr-avatar, .profile-chip');
      if (av) phi.insertBefore(sel, av);
      else    phi.appendChild(sel);
      return;
    }

    // 3. Login page: .right-panel
    var rp = document.querySelector('.right-panel');
    if (rp) {
      var loginWrap = document.createElement('div');
      loginWrap.style.cssText =
        'display:flex;justify-content:flex-end;margin-bottom:16px;width:100%;max-width:460px;';
      loginWrap.appendChild(sel);
      rp.insertBefore(loginWrap, rp.firstChild);
    }
  }

  // -- Public API -----------------------------------------------

  function init() {
    injectStyles();
    injectSelector();
    applyTranslations(currentLang());
  }

  window.CareHubI18n = {
    t:              t,
    apply:          applyTranslations,
    getCurrentLang: currentLang,
    init:           init,
    setLang: function (lang) {
      saveLang(lang);
      applyTranslations(lang);
    }
  };

  // -- Auto-init ------------------------------------------------
  // DOMContentLoaded waits for <script type= module> to resolve,
  // so by the time it fires the body should be visible and stable.
  // We also hook window.load as a safety net for partial selectors.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', function () {
    var sel  = document.getElementById('ch-lang-selector');
    var nBtn = sel ? sel.querySelectorAll('.ch-lang-btn').length : 0;
    if (!sel || nBtn < SUPPORTED.length) {
      if (sel) sel.parentNode && sel.parentNode.removeChild(sel);
      init();
    }
  });

}());
