/* app.js — router, tab bar, scroll chrome, PWA wiring. */
(function (CC) {
  'use strict';

  var UI = CC.UI, S = CC.Store, V = CC.Views;

  var ROUTES = [
    { hash: '#/',        id: 'home',    icon: 'home', label: 'Home',    view: function () { return V.home(); } },
    { hash: '#/menu',    id: 'menu',    icon: 'list', label: 'Menu',    view: function () { return V.menu(); } },
    { hash: '#/order',   id: 'order',   icon: 'bag',  label: 'Bag',     view: function () { return V.order(); } },
    { hash: '#/profile', id: 'profile', icon: 'user', label: 'Card',    view: function () { return V.profile(); } }
  ];

  var app, tabbar, topbar, pill;
  var scrollMemory = {};
  var current = null;

  function routeFor(hash) {
    if (hash === '#/crm') return { hash: '#/crm', id: 'crm', view: function () { return V.crm(); }, hidden: true };
    return ROUTES.filter(function (r) { return r.hash === hash; })[0] || ROUTES[0];
  }

  // ---- tab bar -------------------------------------------------------------
  function buildTabs() {
    tabbar.innerHTML = '<div class="tabbar__pill" aria-hidden="true"></div>' +
      ROUTES.map(function (r) {
        return '<a class="tab" href="' + r.hash + '" data-tab="' + r.id + '">' +
          UI.icon(r.icon, 21) +
          '<span>' + r.label + '</span>' +
          (r.id === 'order' ? '<i class="tab__badge" id="bagBadge">0</i>' : '') +
        '</a>';
      }).join('');
    pill = UI.qs('.tabbar__pill');
  }

  function movePill(id) {
    var tab = UI.qs('.tab[data-tab="' + id + '"]');
    if (!tab || !pill) { if (pill) pill.style.opacity = 0; return; }
    pill.style.opacity = 1;
    pill.style.width = tab.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + (tab.offsetLeft - 6) + 'px)';
  }

  function syncTabs(id) {
    UI.qsa('.tab').forEach(function (t) {
      var on = t.dataset.tab === id;
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    movePill(id);
  }

  function syncBadge() {
    var badge = UI.qs('#bagBadge');
    if (!badge) return;
    var n = S.bag().reduce(function (a, l) { return a + l.qty; }, 0);
    badge.textContent = n > 9 ? '9+' : n;
    badge.classList.toggle('on', n > 0);
  }

  // ---- scroll chrome -------------------------------------------------------
  var tones = [], ticking = false;
  function collectTones() { tones = UI.qsa('[data-tone]'); }

  /** Publish the top bar's real height so sticky elements can sit flush under it. */
  function syncTopbarHeight() {
    if (!topbar) return;
    document.documentElement.style.setProperty('--topbarh', topbar.offsetHeight + 'px');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || 0;
      var forceSolid = current && current.hash !== '#/';
      topbar.classList.toggle('solid', forceSolid || y > 40);

      // which tone sits behind the top bar right now
      var probe = topbar.offsetHeight * 0.7;
      var light = false;
      for (var i = 0; i < tones.length; i++) {
        var r = tones[i].getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) { light = tones[i].dataset.tone === 'light'; }
      }
      topbar.classList.toggle('on-light', light);
    });
  }

  // ---- reveal + image fade -------------------------------------------------
  var revealObs = null;
  function observeReveals() {
    if (revealObs) revealObs.disconnect();
    if (!('IntersectionObserver' in window)) {
      UI.qsa('.rv').forEach(function (e) { e.classList.add('in'); });
      return;
    }
    revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    UI.qsa('.rv').forEach(function (e) { revealObs.observe(e); });
  }

  function wireImages() {
    UI.qsa('img.imgload').forEach(function (im) {
      if (im.complete && im.naturalWidth) { im.classList.add('ready'); return; }
      im.addEventListener('load', function () { im.classList.add('ready'); }, { once: true });
      im.addEventListener('error', function () { im.classList.add('ready'); }, { once: true });
    });
  }

  // ---- bag -----------------------------------------------------------------
  function addToBag(id) {
    var it = CC.ITEMS[id];
    if (!it) return;
    if (S.isSoldOut(id)) { UI.toast('<b>' + UI.esc(it.en) + '</b> is sold out today'); return; }
    var bag = S.bag(), found = false;
    bag.forEach(function (l) { if (l.id === id) { l.qty++; found = true; } });
    if (!found) bag.push({ id: id, qty: 1 });
    S.setBag(bag);
    syncBadge();
    UI.toast('<b>' + UI.esc(it.en) + '</b> added', '+' + it.pts + ' PTS');
  }

  function bump(id, delta) {
    if (delta > 0 && S.isSoldOut(id)) return;      // public API — guard it here too
    var bag = S.bag().map(function (l) {
      return l.id === id ? { id: l.id, qty: l.qty + delta } : l;
    }).filter(function (l) { return l.qty > 0; });
    S.setBag(bag);
    syncBadge();
    render();
  }

  // ---- render --------------------------------------------------------------
  function render() {
    var hash = location.hash || '#/';
    if (hash.indexOf('#/') !== 0) hash = '#/';
    var route = routeFor(hash);
    var changed = !current || current.hash !== route.hash;
    if (!changed) scrollMemory[route.hash] = window.scrollY;
    current = route;

    var out;
    try {
      out = route.view();
    } catch (err) {
      console.error(err);
      out = { html: '<div class="wrap pagehead"><h1 class="h2">Something broke</h1>' +
        '<p class="lede mt-m">Reload the page — nothing was lost.</p>' +
        '<a class="btn mt-m" href="#/">Back home</a></div>', mount: null };
    }

    // A re-render replaces #app wholesale, which throws keyboard focus to <body>.
    // Remember the focused control so it can be restored below.
    var active = document.activeElement;
    var focusKey = active && app.contains(active)
      ? (active.id ? '#' + active.id
         : active.dataset && active.dataset.sec ? '[data-sec="' + active.dataset.sec + '"]'
         : active.dataset && active.dataset.avail ? '[data-avail="' + active.dataset.avail + '"]'
         : active.dataset && active.dataset.tilladd ? '[data-tilladd="' + active.dataset.tilladd + '"]'
         : null)
      : null;

    app.innerHTML = out.html;
    collectTones();
    wireImages();
    observeReveals();
    syncTabs(route.id);
    syncBadge();
    if (out.mount) out.mount();

    if (changed) {
      window.scrollTo(0, 0);
      var titles = { home: '', menu: 'Menu', order: 'Your bag', profile: 'Member card', crm: 'Staff' };
      document.title = (titles[route.id] ? titles[route.id] + ' · ' : '') + 'Code Concept Community';
      var h1 = UI.qs('h1', app);
      if (h1) { h1.setAttribute('tabindex', '-1'); }
    } else if (scrollMemory[route.hash]) {
      window.scrollTo(0, scrollMemory[route.hash]);
    }
    if (focusKey) {
      var back = UI.qs(focusKey, app);
      if (back && back.focus) back.focus({ preventScroll: true });
    }
    onScroll();
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /**
   * A server session can be ended elsewhere — a password reset signs every other
   * device out. Check quietly on boot and drop the local sign-in if the server
   * says no. A network failure is NOT a rejection: the app works offline and
   * must not log someone out just because they are on a bad connection.
   */
  function revalidateSession() {
    if (!CC.Api || !CC.Api.signedIn() || !S.me()) return;
    CC.Api.me().then(function (d) {
      if (d && d.member) S.adoptServerMember(d.member);
    }).catch(function (e) {
      if (e && (e.error === 'not_signed_in' || e.status === 401)) {
        S.signOut();
        UI.toast('Signed out — please sign in again');
        render();
      }
    });
  }

  // ---- install prompt ------------------------------------------------------
  var deferredPrompt = null;
  function showInstall() {
    if (UI.qs('.a2hs') || localStorage.getItem('cc.v1.a2hs') === 'off') return;
    var el = document.createElement('div');
    el.className = 'a2hs';
    el.innerHTML = '<img src="icons/icon-192.png" alt="">' +
      '<div class="a2hs__t"><b>Add Code Concept to your phone</b>' +
      '<span>Your card and points, one tap away.</span></div>' +
      '<button class="btn btn--sm" type="button" data-a2hs="go">Install</button>' +
      '<button class="chip" type="button" data-a2hs="no" aria-label="Dismiss">' + UI.icon('x', 13) + '</button>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a2hs]');
      if (!b) return;
      if (b.dataset.a2hs === 'go' && deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
      }
      localStorage.setItem('cc.v1.a2hs', 'off');
      el.remove();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(showInstall, 6000);
  });

  // ---- boot ----------------------------------------------------------------
  function boot() {
    app = UI.qs('#app');
    tabbar = UI.qs('#tabbar');
    topbar = UI.qs('#topbar');

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    S.seed();
    buildTabs();

    document.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]');
      if (add) { e.preventDefault(); addToBag(add.dataset.add); return; }
    });

    /* localStorage is shared across tabs but nothing tells this one when another
       changes it. Without this, signing out in one tab leaves the next still
       showing a member card. */
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('cc.v2.') !== 0) return;
      render();
    });

    window.addEventListener('hashchange', render);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      if (current) movePill(current.id);
      syncTopbarHeight();
    });
    S.on(syncBadge);

    syncTopbarHeight();
    render();
    revalidateSession();
    // fonts can shift tab and top-bar metrics — settle both once they land
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (current) movePill(current.id);
        syncTopbarHeight();
      });
    }

    // ?nosw disables offline caching — useful while editing the site locally.
    var noSW = /(^|[?&])nosw(=|&|$)/.test(location.search);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      if (noSW) {
        navigator.serviceWorker.getRegistrations().then(function (rs) {
          rs.forEach(function (r) { r.unregister(); });
        });
        if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
      } else {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('sw', e); });
        });
      }
    }
  }

  CC.App = { render: render, go: go, bump: bump };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.CC = window.CC || {});
