/* views.js — one function per route. Each returns { html, mount, tone }. */
(function (CC) {
  'use strict';

  var UI = CC.UI, S = CC.Store, B = CC.BRAND;
  var V = {};

  // ---------------------------------------------------------------- fragments
  /* eager=true for anything above the fold — the hero is the LCP element and
     must not wait on the lazy-load pass. */
  function img(src, alt, cls, eager) {
    return '<img class="imgload" src="assets/img/' + src + '" alt="' + UI.esc(alt) + '"' +
      (cls ? ' ' + cls : '') +
      (eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"') +
      ' decoding="async">';
  }

  function sechead(idx, title, extra) {
    return '<div class="sechead sechead--soft rv">' +
      '<h2 class="eyebrow" style="color:inherit">' + title + '</h2>' +
      '<span class="idx">' + (extra || idx) + '</span></div>';
  }

  function itemRow(it, opts) {
    opts = opts || {};
    return '<li class="mitem" data-item="' + it.id + '" data-search="' +
        UI.esc((it.en + ' ' + it.fa).toLowerCase()) + '">' +
      '<div class="mitem__t">' +
        '<div class="mitem__en">' + UI.esc(it.en) +
          '<span class="pts">' + it.pts + ' PTS</span>' +
        '</div>' +
        '<div class="mitem__fa">' + UI.esc(it.fa) + '</div>' +
      '</div>' +
      '<div class="mitem__p mono-num">' + UI.price(it.price) + '</div>' +
      '<button class="add" data-add="' + it.id + '" type="button" ' +
        'aria-label="Add ' + UI.esc(it.en) + ' to bag">' + UI.icon('plus', 15) + '</button>' +
    '</li>';
  }

  function tierBlock(m) {
    var tier = S.tierOf(m.lifetime), next = S.nextTier(m.lifetime);
    var pct = next
      ? Math.max(3, Math.round(((m.lifetime - tier.min) / (next.min - tier.min)) * 100))
      : 100;
    return '<div class="tile">' +
      '<div class="between" style="align-items:flex-start">' +
        '<div><div class="eyebrow">Tier</div>' +
        '<div class="h3" style="margin-top:6px">' + tier.name + '</div></div>' +
        '<div class="small" style="text-align:right;max-width:16ch">' + UI.esc(tier.perk) + '</div>' +
      '</div>' +
      '<div class="bar mt-s"><i style="width:' + pct + '%"></i></div>' +
      '<div class="small mt-s">' + (next
        ? UI.num(next.min - m.lifetime) + ' more lifetime points to ' + next.name
        : 'Top tier. Thank you for being here.') + '</div>' +
    '</div>';
  }

  var STEPS = [['new', 'Placed'], ['preparing', 'Making'], ['ready', 'Ready'], ['collected', 'Done']];
  function tracker(status) {
    var i = STEPS.map(function (s) { return s[0]; }).indexOf(status);
    return '<div class="track">' + STEPS.map(function (s, k) {
      return '<div class="track__step' + (k <= i ? ' on' : '') + '">' +
        '<i class="track__dot"></i><span>' + s[1] + '</span></div>';
    }).join('') + '</div>';
  }

  // ===========================================================================
  // HOME
  // ===========================================================================
  V.home = function () {
    var picks = CC.SIGNATURES.map(function (id) { return CC.ITEMS[id]; });
    var pickShots = ['iced.webp', 'desk.webp', 'cup.webp'];

    var html =
    '<section class="hero" data-tone="dark">' +
      '<div class="hero__media">' + img('hero.webp', 'A cold drink on the stainless steel counter at Code Concept', '', true) + '</div>' +
      '<div class="hero__inner wrap">' +
        '<img class="hero__mark" src="assets/img/logo-white.png" alt="Code Concept Community" width="1015" height="333">' +
        '<h1 class="hero__tag"><b>Code.</b> Create. <i>Connect.</i></h1>' +
        '<div class="hero__meta">' +
          '<span class="eyebrow">' + B.city + '</span>' +
          '<span class="eyebrow">Specialty coffee</span>' +
          '<span class="eyebrow">Open today · 08:00</span>' +
        '</div>' +
        '<div class="hero__cta">' +
          '<a class="btn" href="#/menu">Order &amp; earn points ' + UI.icon('arrow', 16) + '</a>' +
          '<a class="btn btn--ghost" href="#/profile">Join the community</a>' +
        '</div>' +
      '</div>' +
      '<div class="scrollcue">Scroll</div>' +
    '</section>' +

    '<div data-tone="dark"><div class="marquee"><div class="marquee__track">' +
      [1, 2].map(function () {
        return ['Fresh press', 'Soft smile', 'Made to match you', 'Ceremonial matcha',
                'Single origin', 'Tabriz', 'Code concept community'].map(function (t) {
          return '<div class="marquee__item">' + t + '</div>';
        }).join('');
      }).join('') +
    '</div></div></div>' +

    // -- ethos
    '<section class="section" data-tone="light">' +
      '<div class="wrap">' +
        sechead(1, 'Who we are', '01 / 04') +
        '<div class="grid split">' +
          '<div>' +
            '<p class="h2 rv">Made to match you.</p>' +
            '<p class="lede rv rv-d1 mt-m">A concrete room, a steel bar and a very short list of ' +
            'drinks we actually believe in. Come to work, come to talk, or come to sit ' +
            'quietly with a cortado. We built the place around whichever one you need today.</p>' +
            '<div class="grid grid-2 keep pairs mt-l">' +
              [['Roast', 'Rotating single origin, dialled every morning.'],
               ['Room', 'Microcement, steel, natural light. No noise.'],
               ['People', 'Regulars, freelancers, students, founders.'],
               ['Points', 'Every drink carries its own point value.']].map(function (x, i) {
                return '<div class="rv rv-d' + (i % 4 + 1) + '">' +
                  '<div class="eyebrow">' + x[0] + '</div>' +
                  '<p class="small mt-s" style="max-width:26ch">' + x[1] + '</p></div>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="rv rv-d2"><div class="frame frame--45">' + img('sign.webp', 'The Code Concept sign on a microcement wall') + '</div></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    // -- signature picks
    '<section class="section" data-tone="dark">' +
      '<div class="wrap">' +
        sechead(2, 'Signature', '02 / 04') +
        '<div class="grid grid-3">' +
          picks.map(function (it, i) {
            return '<article class="rv rv-d' + (i + 1) + '">' +
              '<div class="frame frame--45">' + img(pickShots[i], it.en) +
                '<div class="frame__cap">' + it.pts + ' points</div></div>' +
              '<div class="between mt-s" style="align-items:flex-start">' +
                '<div><div class="h3">' + UI.esc(it.en) + '</div>' +
                '<div class="mitem__fa">' + UI.esc(it.fa) + '</div></div>' +
                '<div class="mono-num nowrap">' + UI.price(it.price) + '</div>' +
              '</div>' +
              '<button class="btn btn--ghost btn--sm mt-s" data-add="' + it.id + '" type="button">' +
                'Add to bag</button>' +
            '</article>';
          }).join('') +
        '</div>' +
        '<div class="center mt-l"><a class="btn btn--ghost" href="#/menu">See the full menu ' + UI.icon('arrow', 16) + '</a></div>' +
      '</div>' +
    '</section>' +

    // -- the room
    '<section class="section" data-tone="ink">' +
      '<div class="wrap">' +
        sechead(3, 'The room', '03 / 04') +
        '<div class="grid grid-2">' +
          '<div class="rv"><div class="frame frame--45">' + img('space.webp', 'Microcement wall and the black Code Concept poster') + '</div></div>' +
          '<div class="rv rv-d1"><div class="frame frame--45">' + img('flatlay.webp', 'Iced coffee, sunglasses and the printed menu') + '</div></div>' +
        '</div>' +
        '<div class="rv rv-d2 mt-m"><div class="frame frame--wide">' +
          img('room-wide.webp', 'A guest working at the steel bar with an iced matcha') + '</div></div>' +
      '</div>' +
    '</section>' +

    // -- points pitch
    '<section class="section" data-tone="light">' +
      '<div class="wrap">' +
        sechead(4, 'Community points', '04 / 04') +
        '<div class="grid split-even">' +
          '<div>' +
            '<p class="h2 rv">Every drink is<br>worth something.</p>' +
            '<p class="lede rv rv-d1 mt-m">Order through this site and the points land on your card ' +
            'automatically. No stamps, no plastic, nothing to carry. Each item on the menu ' +
            'carries its own value — some small, some worth queueing for.</p>' +
            '<div class="row mt-m rv rv-d2" style="flex-wrap:wrap;gap:8px">' +
              CC.MENU[0].items.slice(3, 8).map(function (it) {
                return '<span class="pts">' + it.pts + ' · ' + UI.esc(it.en.split(' ')[0]) + '</span>';
              }).join('') +
            '</div>' +
            '<a class="btn btn--dark mt-l rv rv-d3" href="#/profile">Start collecting ' + UI.icon('arrow', 16) + '</a>' +
          '</div>' +
          '<div class="rv rv-d2">' +
            '<div class="card">' +
              '<div class="eyebrow">Rewards</div>' +
              '<ul class="mt-s">' + CC.REWARDS.map(function (r) {
                return '<li class="lrow"><div><div>' + UI.esc(r.en) + '</div>' +
                  '<div class="mitem__fa" style="color:var(--grey-2)">' + UI.esc(r.fa) + '</div></div>' +
                  '<span class="pts">' + UI.num(r.cost) + ' PTS</span></li>';
              }).join('') + '</ul>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    V.footer();

    return { html: html, tone: 'dark', mount: null };
  };

  // ---------------------------------------------------------------- footer
  V.footer = function () {
    return '<footer class="foot section--tight" data-tone="dark" id="contact">' +
      '<div class="wrap">' +
        '<img class="foot__mark" src="assets/img/logo-white.png" alt="Code Concept Community" width="1015" height="333">' +
        '<div class="grid grid-3" style="gap:clamp(24px,4vw,44px)">' +
          '<div>' +
            '<div class="eyebrow">Find us</div>' +
            '<p class="small mt-s">' + B.address + '</p>' +
            '<p class="small mt-s fa">تبریز، ایران</p>' +
          '</div>' +
          '<div>' +
            '<div class="eyebrow">Hours</div>' +
            '<ul class="small mt-s">' + B.hours.map(function (h) {
              return '<li style="display:flex;justify-content:space-between;gap:14px;padding:2px 0">' +
                '<span>' + h[0] + '</span><span class="mono-num">' + h[1] + '</span></li>';
            }).join('') + '</ul>' +
          '</div>' +
          '<div>' +
            '<div class="eyebrow">Talk to us</div>' +
            '<p class="small mt-s">' +
              '<a class="u" href="tel:' + B.phoneTel + '" dir="ltr">' + B.phone + '</a><br>' +
              '<a class="u" href="mailto:' + B.email + '">' + B.email + '</a><br>' +
              '<a class="u" href="' + B.instagram + '" target="_blank" rel="noopener">@' + B.handle + '</a>' +
            '</p>' +
          '</div>' +
        '</div>' +
        '<div class="rule mt-l" style="opacity:.14"></div>' +
        '<div class="between mt-m" style="flex-wrap:wrap;gap:12px">' +
          '<span class="foot__legal">© ' + new Date().getFullYear() + ' ' + B.full + ' · ' + B.tagline + '</span>' +
          '<span class="foot__legal"><a href="#/crm" class="u">Staff</a> · Preview build by Alpha Agency</span>' +
        '</div>' +
      '</div>' +
    '</footer>';
  };

  // ===========================================================================
  // MENU
  // ===========================================================================
  V.menu = function () {
    var html =
    '<div data-tone="dark">' +
      '<div class="wrap">' +
        '<div class="catbar" role="group" aria-label="Filter the menu by section">' +
          '<button class="chip is-on" data-cat="all" type="button" aria-pressed="true"><span>All</span></button>' +
          CC.MENU.map(function (s) {
            return '<button class="chip" data-cat="' + s.id + '" type="button" aria-pressed="false"><span>' +
              UI.esc(s.label) + '</span></button>';
          }).join('') +
        '</div>' +

        '<header class="menucol" style="padding-top:clamp(30px,6vw,54px)">' +
          '<h1 class="h2 rv in">Menu</h1>' +
          '<p class="small mt-s">Prices in thousand Toman · <span class="fa">قیمت‌ها به هزار تومان</span></p>' +
          '<div class="field mt-m" style="max-width:420px">' +
            '<div style="position:relative">' +
              '<span style="position:absolute;left:15px;top:50%;transform:translateY(-50%);opacity:.5">' +
                UI.icon('search', 17) + '</span>' +
              '<input class="input" id="mSearch" type="search" placeholder="Search the menu…" ' +
                'style="padding-left:44px" aria-label="Search the menu">' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<div id="mList" class="menucol">' +
          CC.MENU.map(function (sec, i) {
            return '<section class="menusec" data-sec="' + sec.id + '" id="sec-' + sec.id + '">' +
              '<div class="menusec__head">' +
                '<h2 class="h3">' + UI.esc(sec.label) + '</h2>' +
                '<span class="mitem__fa">' + UI.esc(sec.fa) + '</span>' +
                '<span class="menusec__note" style="margin-left:auto">' + UI.esc(sec.note) + '</span>' +
              '</div>' +
              '<ul>' + sec.items.map(function (it) { return itemRow(it); }).join('') + '</ul>' +
            '</section>';
          }).join('') +

          '<section class="menusec" data-sec="extras">' +
            '<div class="menusec__head"><h2 class="h3">Add to any drink</h2>' +
            '<span class="mitem__fa">افزودنی‌ها</span></div>' +
            '<ul>' + CC.EXTRAS.map(function (it) { return itemRow(it); }).join('') + '</ul>' +
          '</section>' +
        '</div>' +

        '<p class="empty hide" id="mEmpty">Nothing matches that. Try another word.</p>' +
        '<div style="height:60px"></div>' +
      '</div>' +
    '</div>' + V.footer();

    function mount() {
      var search = UI.qs('#mSearch');
      var chips = UI.qsa('.catbar .chip');
      var cat = 'all';

      function apply() {
        var q = (search.value || '').trim().toLowerCase();
        var anyVisible = false;
        UI.qsa('#mList .menusec').forEach(function (sec) {
          var secOn = cat === 'all' || sec.dataset.sec === cat ||
                      (cat !== 'all' && sec.dataset.sec === 'extras' && !q);
          var shown = 0;
          UI.qsa('.mitem', sec).forEach(function (li) {
            var hit = !q || li.dataset.search.indexOf(q) !== -1;
            var on = secOn && hit;
            li.classList.toggle('is-hidden', !on);
            if (on) shown++;
          });
          sec.classList.toggle('hide', shown === 0);
          if (shown) anyVisible = true;
        });
        UI.qs('#mEmpty').classList.toggle('hide', anyVisible);
      }

      search.addEventListener('input', apply);
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          chips.forEach(function (x) {
            x.classList.toggle('is-on', x === c);
            x.setAttribute('aria-pressed', x === c ? 'true' : 'false');
          });
          cat = c.dataset.cat;
          apply();
          if (cat !== 'all') {
            var t = UI.qs('#sec-' + cat);
            if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });
    }

    return { html: html, tone: 'dark', mount: mount };
  };

  // ===========================================================================
  // ORDER / BAG
  // ===========================================================================
  V.order = function () {
    var bag = S.bag(), me = S.me();
    var lines = bag.map(function (l) { return { it: CC.ITEMS[l.id], qty: l.qty }; })
                   .filter(function (l) { return l.it; });
    var total = lines.reduce(function (a, l) { return a + l.it.price * l.qty; }, 0);
    var points = lines.reduce(function (a, l) { return a + l.it.pts * l.qty; }, 0);
    var live = me ? S.ordersOf(me.id).filter(function (o) { return o.status !== 'collected'; }) : [];

    var html = '<div data-tone="dark"><div class="wrap pagehead">' +
      '<h1 class="h2">Your bag</h1>';

    if (live.length) {
      html += '<div class="card mt-m">' +
        '<div class="eyebrow">In progress</div>' +
        live.map(function (o) {
          return '<div class="mt-s"><div class="between">' +
            '<strong class="kticket__ref">#' + o.ref + '</strong>' +
            '<span class="status" data-s="' + o.status + '">' + o.status + '</span></div>' +
            tracker(o.status) + '</div>';
        }).join('') +
      '</div>';
    }

    if (!lines.length) {
      html += '<div class="empty">Your bag is empty.<br><br>' +
        '<a class="btn btn--ghost" href="#/menu">Browse the menu</a></div>';
    } else {
      html += '<ul class="mt-m">' + lines.map(function (l) {
        return '<li class="mitem" style="grid-template-columns:1fr auto auto">' +
          '<div class="mitem__t"><div class="mitem__en">' + UI.esc(l.it.en) +
            '<span class="pts">' + (l.it.pts * l.qty) + ' PTS</span></div>' +
            '<div class="mitem__fa">' + UI.esc(l.it.fa) + '</div></div>' +
          '<div class="qty" data-q="' + l.it.id + '">' +
            '<button type="button" data-dec="' + l.it.id + '" aria-label="One fewer ' + UI.esc(l.it.en) + '">' + UI.icon('minus', 12) + '</button>' +
            '<output>' + l.qty + '</output>' +
            '<button type="button" data-inc="' + l.it.id + '" aria-label="One more ' + UI.esc(l.it.en) + '">' + UI.icon('plus', 12) + '</button>' +
          '</div>' +
          '<div class="mitem__p mono-num">' + UI.price(l.it.price * l.qty) + '</div>' +
        '</li>';
      }).join('') + '</ul>' +

      '<div class="card mt-m">' +
        '<div class="between"><span class="small">Subtotal</span>' +
          '<strong class="mono-num">' + UI.price(total) + '</strong></div>' +
        '<div class="between mt-s"><span class="small">Points you will earn</span>' +
          '<span class="pts">' + UI.num(points) + ' PTS</span></div>' +
      '</div>' +

      '<div class="mt-l"><div class="eyebrow">How</div>' +
        '<div class="segment mt-s" id="mode">' +
          '<button type="button" data-mode="pickup" aria-pressed="true"><span>Pick up</span></button>' +
          '<button type="button" data-mode="dine-in" aria-pressed="false"><span>Dine in</span></button>' +
        '</div>' +
      '</div>' +

      '<div class="field mt-m"><label for="oNote">Note for the bar</label>' +
        '<textarea class="input" id="oNote" placeholder="Oat milk, no sugar, extra hot…"></textarea></div>';

      if (me) {
        html += '<div class="tile mt-m between">' +
          '<div><div class="eyebrow">Ordering as</div>' +
          '<div style="margin-top:5px">' + UI.esc(me.name) + '</div>' +
          '<div class="small mono-num" dir="ltr">' + UI.esc(me.phone) + '</div></div>' +
          '<span class="pts">' + UI.num(me.points) + ' PTS</span></div>';
      } else {
        html += '<div class="card mt-m"><div class="eyebrow">Collect your points</div>' +
          '<p class="small mt-s">Add your name and number and the points land on a card we make for you.</p>' +
          '<div class="grid grid-2 keep mt-s">' +
            '<div class="field"><label for="oName">Name</label>' +
              '<input class="input" id="oName" autocomplete="name" placeholder="Your name"></div>' +
            '<div class="field"><label for="oPhone">Mobile</label>' +
              '<input class="input" id="oPhone" type="tel" inputmode="tel" autocomplete="tel" ' +
              'dir="ltr" placeholder="0914 000 0000"></div>' +
          '</div><div class="err" id="oErr"></div></div>';
      }

      html += '<button class="btn btn--block btn--lg mt-l" id="placeBtn" type="button">' +
        '<span>Place order · ' + UI.price(total) + '</span></button>' +
        '<p class="small center mt-s">Preview build — no payment is taken.</p>';
    }

    html += '<div style="height:40px"></div></div></div>';

    function mount() {
      var mode = 'pickup';
      UI.qsa('#mode button').forEach(function (b) {
        b.addEventListener('click', function () {
          mode = b.dataset.mode;
          UI.qsa('#mode button').forEach(function (x) {
            x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
          });
        });
      });

      UI.qsa('[data-inc]').forEach(function (b) {
        b.addEventListener('click', function () { CC.App.bump(b.dataset.inc, +1); });
      });
      UI.qsa('[data-dec]').forEach(function (b) {
        b.addEventListener('click', function () { CC.App.bump(b.dataset.dec, -1); });
      });

      var place = UI.qs('#placeBtn');
      if (!place) return;
      place.addEventListener('click', function () {
        var who = S.me();
        if (!who) {
          var name = (UI.qs('#oName').value || '').trim();
          var phone = (UI.qs('#oPhone').value || '').trim();
          var err = UI.qs('#oErr');
          if (name.length < 2) { err.textContent = 'Please add your name.'; UI.qs('#oName').focus(); return; }
          if (!UI.validPhone(phone)) { err.textContent = 'That mobile number does not look right.'; UI.qs('#oPhone').focus(); return; }
          who = S.join(name, phone);
        }
        var order = S.placeOrder(who.id, S.bag().slice(), mode, (UI.qs('#oNote').value || '').trim());
        V.orderDone(order);
      });
    }

    return { html: html, tone: 'dark', mount: mount };
  };

  V.orderDone = function (order) {
    var me = S.me();
    UI.sheet(
      '<div class="center">' +
        '<div class="eyebrow">Order placed</div>' +
        '<div style="font-size:clamp(2.6rem,12vw,3.4rem);font-weight:200;letter-spacing:-.05em;margin:10px 0 2px">#' + order.ref + '</div>' +
        '<p class="small">' + (order.mode === 'pickup' ? 'Ready at the bar in about 8 minutes.' : 'We will bring it to your table.') + '</p>' +
        tracker('new') +
        '<div class="tile mt-m" style="text-align:left">' +
          '<div class="between"><span class="small">Points earned</span><span class="pts">+' + order.points + ' PTS</span></div>' +
          '<div class="between mt-s"><span class="small">New balance</span><strong class="mono-num">' + UI.num(me ? me.points : order.points) + '</strong></div>' +
        '</div>' +
        '<a class="btn btn--block mt-m" href="#/profile" data-close-sheet>See my card</a>' +
        '<button class="btn btn--ghost btn--block mt-s" type="button" data-close-sheet>Done</button>' +
      '</div>'
    );
    UI.qsa('[data-close-sheet]').forEach(function (b) {
      b.addEventListener('click', function () { UI.closeSheet(); });
    });
    UI.toast('<b>Order ' + order.ref + '</b> sent to the bar', '+' + order.points + ' PTS');
  };

  // ===========================================================================
  // PROFILE
  // ===========================================================================
  V.profile = function () {
    var me = S.me();
    if (!me) return V.join();

    var orders = S.ordersOf(me.id);
    var tier = S.tierOf(me.lifetime);
    var fav = me.favourite && CC.ITEMS[me.favourite];
    var qr = CC.QR.svg(me.code, { quiet: 2, fg: '#000', bg: '#fff', label: 'Member code ' + me.code });

    var html = '<div data-tone="dark"><div class="wrap pagehead">' +

      '<div class="between" style="align-items:flex-end">' +
        '<div><div class="eyebrow">Member</div>' +
        '<h1 class="h2" style="margin-top:6px">' + UI.esc(me.name.split(' ')[0]) + '</h1></div>' +
        '<button class="btn btn--ghost btn--sm" id="signOut" type="button">Sign out</button>' +
      '</div>' +

      // -- card
      '<div class="mcard mt-m">' +
        '<div class="mcard__top">' +
          '<div>' +
            '<img class="mcard__mark" src="assets/img/logo-white.png" alt="Code Concept" width="1015" height="333">' +
            '<div class="mcard__code">' + me.code + '</div>' +
            '<div class="small" style="color:var(--grey-2);margin-top:2px">' + tier.name + ' · since ' + UI.date(me.joined) + '</div>' +
          '</div>' +
          '<div class="mcard__qr">' + qr + '</div>' +
        '</div>' +
        '<div class="mcard__bal"><b class="mono-num">' + UI.num(me.points) + '</b><span>Points available</span></div>' +
      '</div>' +

      '<div class="grid grid-4 keep mt-m">' +
        ['<div class="stat"><div class="stat__n">' + UI.num(me.visits) + '</div><div class="stat__l">Orders</div></div>',
         '<div class="stat"><div class="stat__n">' + UI.num(me.lifetime) + '</div><div class="stat__l">Lifetime pts</div></div>',
         '<div class="stat"><div class="stat__n">' + UI.num(me.spend) + '</div><div class="stat__l">Spent (t)</div></div>',
         '<div class="stat"><div class="stat__n">' + UI.num(me.redeemed.length) + '</div><div class="stat__l">Redeemed</div></div>'].join('') +
      '</div>' +

      '<div class="mt-l">' + tierBlock(me) + '</div>' +

      (fav ? '<div class="tile mt-m between"><div><div class="eyebrow">Your usual</div>' +
        '<div class="h3" style="margin-top:5px">' + UI.esc(fav.en) + '</div></div>' +
        '<button class="btn btn--sm" data-add="' + fav.id + '" type="button">Order again</button></div>' : '') +

      // -- rewards
      '<h2 class="eyebrow mt-l">Redeem</h2>' +
      '<ul class="mt-s">' + CC.REWARDS.map(function (r) {
        var can = me.points >= r.cost;
        return '<li class="lrow"><div><div>' + UI.esc(r.en) + '</div>' +
          '<div class="mitem__fa" style="color:var(--grey-2)">' + UI.esc(r.fa) + '</div></div>' +
          '<button class="btn btn--sm ' + (can ? '' : 'btn--ghost') + '" data-redeem="' + r.id + '" type="button"' +
          (can ? '' : ' disabled') + '>' + UI.num(r.cost) + ' pts</button></li>';
      }).join('') + '</ul>' +

      (me.redeemed.length ? '<h2 class="eyebrow mt-l">Your vouchers</h2><ul class="mt-s">' +
        me.redeemed.map(function (r) {
          return '<li class="lrow"><div><div>' + UI.esc(r.en) + '</div>' +
            '<div class="small">' + UI.date(r.at) + '</div></div>' +
            '<strong class="kticket__ref">' + r.code + '</strong></li>';
        }).join('') + '</ul>' : '') +

      // -- history
      '<h2 class="eyebrow mt-l">Activity</h2>' +
      (orders.length ? '<ul class="mt-s">' + orders.slice(0, 25).map(function (o) {
        return '<li class="lrow" style="align-items:flex-start">' +
          '<div style="min-width:0">' +
            '<div class="row" style="gap:9px"><strong class="kticket__ref">#' + o.ref + '</strong>' +
            '<span class="status" data-s="' + o.status + '">' + o.status + '</span></div>' +
            '<div class="small mt-s">' + o.items.map(function (i) {
              return UI.esc(i.en) + (i.qty > 1 ? ' ×' + i.qty : '');
            }).join(', ') + '</div>' +
            '<div class="small" style="opacity:.6">' + UI.ago(o.placed) + ' · ' + o.mode + '</div>' +
          '</div>' +
          '<div style="text-align:right"><div class="mono-num">' + UI.price(o.total) + '</div>' +
          '<div class="pts mt-s">+' + o.points + '</div></div>' +
        '</li>';
      }).join('') + '</ul>' : '<p class="empty">No orders yet.</p>') +

      '<div class="rule mt-l" style="opacity:.14"></div>' +
      '<div class="between mt-m" style="flex-wrap:wrap;gap:10px">' +
        '<a class="btn btn--ghost btn--sm" href="#/crm">' + UI.icon('lock', 15) + ' Staff dashboard</a>' +
        '<button class="btn btn--ghost btn--sm" id="resetDemo" type="button">' + UI.icon('refresh', 15) + ' Reset preview data</button>' +
      '</div>' +
      '<div style="height:40px"></div>' +
    '</div></div>';

    function mount() {
      UI.qs('#signOut').addEventListener('click', function () {
        S.signOut();
        UI.toast('Signed out');
        CC.App.go('#/profile');
      });
      UI.qs('#resetDemo').addEventListener('click', function () {
        UI.sheet('<div class="center"><div class="eyebrow">Reset preview</div>' +
          '<p class="lede mt-s" style="max-width:none;font-size:1rem">This clears every member, order and point ' +
          'stored in this browser and rebuilds the demo data.</p>' +
          '<button class="btn btn--block mt-m" id="doReset" type="button">Reset everything</button>' +
          '<button class="btn btn--ghost btn--block mt-s" type="button" id="noReset">Keep it</button></div>');
        UI.qs('#doReset').addEventListener('click', function () {
          UI.closeSheet();
          S.reset(); S.signOut();
          UI.toast('Preview data rebuilt');
          CC.App.go('#/');
        });
        UI.qs('#noReset').addEventListener('click', UI.closeSheet);
      });
      UI.qsa('[data-redeem]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = S.redeem(me.id, b.dataset.redeem);
          if (!v) { UI.toast('Not enough points yet'); return; }
          UI.toast('<b>' + UI.esc(v.en) + '</b> — show code ' + v.code, '−' + v.cost + ' PTS');
          CC.App.render();
        });
      });
    }

    return { html: html, tone: 'dark', mount: mount };
  };

  V.join = function () {
    var html = '<div data-tone="dark"><div class="wrap pagehead">' +
      '<div class="eyebrow">Community card</div>' +
      '<h1 class="h2" style="margin-top:8px">Join, and every<br>drink counts.</h1>' +
      '<p class="lede mt-m">Name and mobile number — that is the whole sign-up. We make you a card ' +
      'with a scannable code, and points start landing the moment you order.</p>' +

      '<div class="card mt-l" style="max-width:460px">' +
        '<div class="field"><label for="jName">Name</label>' +
          '<input class="input" id="jName" autocomplete="name" placeholder="Your name"></div>' +
        '<div class="field mt-s"><label for="jPhone">Mobile</label>' +
          '<input class="input" id="jPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" ' +
          'placeholder="0914 000 0000"></div>' +
        '<div class="err" id="jErr"></div>' +
        '<button class="btn btn--block mt-s" id="joinBtn" type="button">Create my card</button>' +
        '<p class="small center mt-s">Already a member? Enter the same number to sign back in.</p>' +
      '</div>' +

      '<div class="grid grid-3 mt-l">' +
        CC.TIERS.slice(1).map(function (t) {
          return '<div class="tile"><div class="eyebrow">' + t.name + '</div>' +
            '<div class="mono-num" style="font-size:1.5rem;font-weight:200;margin:6px 0">' + UI.num(t.min) + '</div>' +
            '<p class="small">' + UI.esc(t.perk) + '</p></div>';
        }).join('') +
      '</div>' +
      '<div style="height:40px"></div>' +
    '</div></div>' + V.footer();

    function mount() {
      function submit() {
        var name = (UI.qs('#jName').value || '').trim();
        var phone = (UI.qs('#jPhone').value || '').trim();
        var err = UI.qs('#jErr');
        if (name.length < 2) { err.textContent = 'Please add your name.'; UI.qs('#jName').focus(); return; }
        if (!UI.validPhone(phone)) { err.textContent = 'That mobile number does not look right.'; UI.qs('#jPhone').focus(); return; }
        var existed = !!S.findByPhone(phone);
        var m = S.join(name, phone);
        UI.toast(existed ? 'Welcome back, <b>' + UI.esc(m.name.split(' ')[0]) + '</b>'
                         : 'Card created · <b>' + m.code + '</b>');
        CC.App.render();
      }
      UI.qs('#joinBtn').addEventListener('click', submit);
      UI.qs('#jPhone').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    }

    return { html: html, tone: 'dark', mount: mount };
  };

  CC.Views = V;
})(window.CC = window.CC || {});
