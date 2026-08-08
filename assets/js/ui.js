/* ui.js — small helpers: escaping, formatting, icons, toasts, sheets. */
(function (CC) {
  'use strict';

  var UI = {};

  UI.qs  = function (s, r) { return (r || document).querySelector(s); };
  UI.qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /** Escape anything that came from a person. Every template interpolation of
      member-entered text goes through this. */
  UI.esc = function (v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  UI.num = function (n) { return Number(n || 0).toLocaleString('en-US'); };

  /** Prices are printed in thousand Toman, exactly as on the café's card. */
  UI.price = function (n) { return UI.num(n) + '<small>t</small>'; };

  UI.date = function (ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  UI.time = function (ts) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  UI.ago = function (ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    var d = Math.floor(s / 86400);
    if (d < 30) return d + 'd ago';
    return UI.date(ts);
  };

  var ICONS = {
    home:   '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list:   '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    bag:    '<path d="M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2"/>',
    user:   '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    minus:  '<path d="M5 12h14"/>',
    check:  '<path d="m4 12.5 5 5L20 6.5"/>',
    x:      '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow:  '<path d="M5 12h14M13 6l6 6-6 6"/>',
    ne:     '<path d="M7 17 17 7M8 7h9v9"/>',
    phone:  '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    mail:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    pin:    '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
    ig:     '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    dl:     '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16"/>',
    lock:   '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    star:   '<path d="m12 3.6 2.6 5.5 5.9.8-4.3 4.2 1 6-5.2-2.9L6.8 20l1-6-4.3-4.2 5.9-.8z"/>',
    back:   '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    refresh:'<path d="M20 11a8 8 0 1 0-.7 4.3M20 5v6h-6"/>'
  };

  UI.icon = function (name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) +
      '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };

  // ---- toasts --------------------------------------------------------------
  UI.toast = function (msg, meta) {
    var host = UI.qs('#toasts');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = msg + (meta ? '<span class="toast__pts">' + meta + '</span>' : '');
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  };

  // ---- bottom sheet --------------------------------------------------------
  var openSheet = null;
  UI.sheet = function (html, onClose) {
    UI.closeSheet();
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = '<div class="sheet__grip"></div>' + html;
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    document.body.classList.add('tabs-hidden');

    var lastFocus = document.activeElement;
    function close() {
      scrim.remove(); sheet.remove();
      document.body.classList.remove('tabs-hidden');
      document.removeEventListener('keydown', onKey);
      openSheet = null;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      if (onClose) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = UI.qsa('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', sheet);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    openSheet = { close: close, el: sheet };
    var focusable = UI.qs('button, input, a[href]', sheet);
    if (focusable) focusable.focus();
    return openSheet;
  };
  UI.closeSheet = function () { if (openSheet) openSheet.close(); };

  // ---- misc ---------------------------------------------------------------
  UI.validPhone = function (v) {
    var d = String(v).replace(/\D/g, '');
    return d.length >= 10 && d.length <= 13;
  };

  UI.csv = function (rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
  };

  UI.download = function (filename, text, mime) {
    var blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  CC.UI = UI;
})(window.CC = window.CC || {});
