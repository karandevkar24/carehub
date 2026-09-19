/**
 * CareHub — Global Page Transition System
 * Injects a full-screen glassmorphism overlay with a pastel spinner
 * on every internal navigation, then fades it out after the new page loads.
 */
(function () {
  'use strict';

  var OVERLAY_ID = 'ch-page-transition';
  var MIN_SHOW_MS = 350; // minimum time overlay is visible (prevents flash)
  var AUTO_HIDE_MS = 2500; // fallback auto-hide if pageReady never fires

  // ── Create overlay HTML ───────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#' + OVERLAY_ID + '{',
      'position:fixed;inset:0;z-index:99999;',
      'display:flex;align-items:center;justify-content:center;',
      'background:rgba(10,14,30,0.65);',
      'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      'opacity:0;pointer-events:none;',
      'transition:opacity 0.28s cubic-bezier(0.4,0,0.2,1);',
    '}',
    '#' + OVERLAY_ID + '.ch-visible{',
      'opacity:1;pointer-events:all;',
    '}',
    '#' + OVERLAY_ID + '.ch-exiting{',
      'opacity:0;',
      'transition:opacity 0.32s cubic-bezier(0.4,0,0.2,1);',
    '}',

    /* Glassmorphism card */
    '.ch-trans-card{',
      'background:rgba(255,255,255,0.06);',
      'border:1px solid rgba(255,255,255,0.12);',
      'border-radius:24px;',
      'padding:40px 52px;',
      'display:flex;flex-direction:column;align-items:center;gap:22px;',
      'box-shadow:0 20px 80px rgba(0,0,0,0.35);',
      'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
      'animation:ch-card-in 0.3s ease;',
    '}',
    '@keyframes ch-card-in{from{transform:scale(0.92);opacity:0;}to{transform:scale(1);opacity:1;}}',

    /* Spinner ring */
    '.ch-spinner{',
      'width:54px;height:54px;',
      'border-radius:50%;',
      'background:conic-gradient(',
        'from 0deg,',
        '#ec4899 0%,',
        '#8b5cf6 25%,',
        '#38bdf8 50%,',
        '#4ade80 75%,',
        'transparent 100%',
      ');',
      'animation:ch-spin 0.9s linear infinite;',
      'position:relative;',
    '}',
    '.ch-spinner::after{',
      'content:"";',
      'position:absolute;inset:6px;',
      'background:rgba(12,18,36,0.85);',
      'border-radius:50%;',
    '}',
    '@keyframes ch-spin{to{transform:rotate(360deg);}}',

    /* Dots row */
    '.ch-dots{display:flex;gap:6px;align-items:center;}',
    '.ch-dot{',
      'width:6px;height:6px;border-radius:50%;',
      'background:rgba(255,255,255,0.45);',
      'animation:ch-pulse 1.2s ease-in-out infinite;',
    '}',
    '.ch-dot:nth-child(1){animation-delay:0s;}',
    '.ch-dot:nth-child(2){animation-delay:0.18s;}',
    '.ch-dot:nth-child(3){animation-delay:0.36s;}',
    '@keyframes ch-pulse{0%,80%,100%{transform:scale(0.7);opacity:0.4;}40%{transform:scale(1);opacity:1;}}',

    /* Label */
    '.ch-label{',
      'font-family:"Inter",system-ui,sans-serif;',
      'font-size:0.8rem;font-weight:600;',
      'color:rgba(255,255,255,0.55);',
      'letter-spacing:0.06em;',
    '}',
  ].join('');
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = [
    '<div class="ch-trans-card">',
      '<div class="ch-spinner"></div>',
      '<div class="ch-dots">',
        '<div class="ch-dot"></div>',
        '<div class="ch-dot"></div>',
        '<div class="ch-dot"></div>',
      '</div>',
      '<div class="ch-label">Loading…</div>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);

  // ── Show / Hide helpers ───────────────────────────────────────────────────
  var showStartTime = 0;
  var autoHideTimer = null;

  function showOverlay() {
    clearTimeout(autoHideTimer);
    showStartTime = Date.now();
    overlay.classList.remove('ch-exiting');
    // Force reflow so the transition always plays even if re-triggered quickly
    void overlay.offsetHeight;
    overlay.classList.add('ch-visible');
    autoHideTimer = setTimeout(hideOverlay, AUTO_HIDE_MS);
  }

  function hideOverlay() {
    clearTimeout(autoHideTimer);
    var elapsed = Date.now() - showStartTime;
    var delay = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(function () {
      overlay.classList.add('ch-exiting');
      setTimeout(function () {
        overlay.classList.remove('ch-visible', 'ch-exiting');
      }, 350);
    }, delay);
  }

  // ── Intercept link clicks ─────────────────────────────────────────────────
  var SAME_ORIGIN = window.location.origin;

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;

    var href = a.getAttribute('href');
    if (!href) return;

    // Skip: external links, anchors, mailto/tel, javascript:, target=_blank
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      a.target === '_blank' ||
      a.hasAttribute('data-no-transition')
    ) return;

    // Only intercept same-origin navigation
    try {
      var abs = new URL(href, window.location.href);
      if (abs.origin !== SAME_ORIGIN) return;
      // Don't double-fire if current page is the destination
      if (abs.pathname === window.location.pathname && !abs.search) return;
    } catch (_) { return; }

    showOverlay();
    // Navigation happens naturally from the link click
  }, true);

  // ── Intercept programmatic navigation (window.location) ──────────────────
  var _replace = window.location.replace.bind(window.location);
  var _assign  = window.location.assign.bind(window.location);

  // We patch only explicit replace/assign calls from app code
  // (auth redirects etc) — careful not to create infinite loops
  var _navigating = false;

  function patchedNavigate(fn, url) {
    if (_navigating) return fn(url);
    // Only show overlay for same-origin transitions
    try {
      var abs = new URL(url, window.location.href);
      if (abs.origin === SAME_ORIGIN && abs.pathname !== window.location.pathname) {
        showOverlay();
      }
    } catch (_) {}
    _navigating = true;
    fn(url);
  }

  try {
    Object.defineProperty(window.location, 'replace', {
      configurable: true,
      writable: true,
      value: function (url) { patchedNavigate(_replace, url); }
    });
    Object.defineProperty(window.location, 'assign', {
      configurable: true,
      writable: true,
      value: function (url) { patchedNavigate(_assign, url); }
    });
  } catch (_) {
    // Some browsers block location property overrides — silently skip
  }

  // ── Hide overlay after new page loads ────────────────────────────────────
  window.addEventListener('pageReady', hideOverlay);

  // Hide on DOMContentLoaded of the *current* page (first paint after nav)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideOverlay);
  } else {
    // Already loaded — hide immediately (script injected after load)
    hideOverlay();
  }

  // Also hide on pageshow (handles browser back/forward cache)
  window.addEventListener('pageshow', function (e) {
    hideOverlay();
  });

  // Expose helper so pages can signal data-ready
  window.signalPageReady = function () {
    window.dispatchEvent(new Event('pageReady'));
  };
})();
