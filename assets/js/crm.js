/* crm.js — the staff console.
   Five sections behind one passcode: Today, Till, Members, Menu, Insights.
   The passcode is stored as a salted SHA-256 digest rather than plain text, so
   the code is not sitting in the page source. Four digits is a soft gate, not
   security — real auth needs a server. */
(function (CC) {
  'use strict';

  var UI = CC.UI, S = CC.Store;

  var PASS_SALT = 'cc-staff-v1:';
  var PASS_HASH = 'c945f4c8e2d1566a';

  var section = 'today';            // survives re-renders
  var sortKey = 'lastSeen', sortDir = -1;
  var mQuery = '';                  // members search, must survive a re-render
  var tillQuery = '';               // till item filter, likewise
  var till = {};                    // itemId -> qty, the counter's open ticket
  var tillMember = null;            // member id the till sale is credited to

  var STATUS = [['new', 'Incoming'], ['preparing', 'On the bar'],
                ['ready', 'Ready'], ['collected', 'Collected']];

  function midnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /* Two FNV-1a passes with different offset bases -> 64 bits. Deliberately not
     WebCrypto: crypto.subtle only exists in a secure context, so it is undefined
     over plain http (a LAN IP on a phone) and the gate would refuse the correct
     code. This keeps the passcode out of the source without that dependency.
     Four digits is a soft gate against the curious, not security — anyone can
     brute force 10,000 options. Real auth needs a server. */
  function fnv(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function codeHash(str) {
    return ('0000000' + fnv(str, 0x811c9dc5).toString(16)).slice(-8) +
           ('0000000' + fnv(str, 0x7fffffff).toString(16)).slice(-8);
  }

  // ===========================================================================
  // LOCK
  // ===========================================================================
  function lock() {
    var html = '<div class="crm"><div class="wrap pagehead" style="max-width:400px">' +
      '<div class="center">' + UI.icon('lock', 26) + '</div>' +
      '<h1 class="h2 center" style="margin-top:14px">Staff</h1>' +
      '<p class="small center mt-s">Code Concept operations.<br>Enter the team passcode.</p>' +
      '<div class="field mt-l"><label for="pc">Passcode</label>' +
        '<input class="input" id="pc" type="password" inputmode="numeric" autocomplete="off" ' +
        'maxlength="12" placeholder="••••" aria-describedby="pcErr" ' +
        'style="text-align:center;letter-spacing:.5em;font-size:1.3rem"></div>' +
      '<div class="err center" id="pcErr" role="alert" aria-live="assertive"></div>' +
      '<button class="btn btn--block mt-s" id="pcGo" type="button">Unlock</button>' +
      '<div class="center mt-l"><a class="btn btn--ghost btn--sm" href="#/">' +
        UI.icon('back', 15) + ' Back to the site</a></div>' +
      '<div style="height:40px"></div>' +
    '</div></div>';

    function mount() {
      var input = UI.qs('#pc'), btn = UI.qs('#pcGo'), err = UI.qs('#pcErr');

      function fail(msg) {
        err.textContent = msg;
        input.value = ''; input.setAttribute('aria-invalid', 'true'); input.focus();
      }
      function go() {
        var v = input.value.trim();
        if (!v) { fail('Enter the passcode.'); return; }
        if (codeHash(PASS_SALT + v) === PASS_HASH) {
          input.removeAttribute('aria-invalid');
          S.setStaff(true);
          section = 'today';
          UI.toast('Welcome back');
          CC.App.render();
        } else {
          fail('Wrong passcode.');
        }
      }
      btn.addEventListener('click', go);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      input.focus();
    }
    return { html: html, tone: 'dark', mount: mount };
  }

  // ===========================================================================
  // SHARED DATA
  // ===========================================================================
  function snapshot() {
    var members = S.members(), orders = S.orders(), t0 = midnight();
    var today = orders.filter(function (o) { return o.placed >= t0; });
    var lastSeen = {};
    orders.forEach(function (o) {
      if (!o.memberId) return;
      if (!lastSeen[o.memberId] || o.placed > lastSeen[o.memberId]) lastSeen[o.memberId] = o.placed;
    });
    return {
      members: members, orders: orders, today: today, lastSeen: lastSeen,
      open: orders.filter(function (o) { return o.status !== 'collected'; }),
      revToday: today.reduce(function (a, o) { return a + o.total; }, 0),
      ptsToday: today.reduce(function (a, o) { return a + o.points; }, 0),
      ptsOut: members.reduce(function (a, m) { return a + m.points; }, 0),
      ptsIssued: members.reduce(function (a, m) { return a + m.lifetime; }, 0),
      // measured from the vouchers actually taken, not lifetime-minus-balance,
      // which a manual point adjustment would silently distort
      ptsBurned: members.reduce(function (a, m) {
        return a + m.redeemed.reduce(function (b, r) { return b + r.cost; }, 0);
      }, 0),
      redemptions: members.reduce(function (a, m) { return a + m.redeemed.length; }, 0)
    };
  }

  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi__n">' + value + '</div>' +
      '<div class="kpi__l">' + label + '</div>' +
      (sub ? '<div class="kpi__s">' + sub + '</div>' : '') + '</div>';
  }

  function memberRow(m) {
    var t = S.tierOf(m.lifetime);
    return '<button class="tile crm-mini" data-member="' + m.id + '" type="button">' +
      '<div style="min-width:0;text-align:left">' +
        '<div>' + UI.esc(m.name) + '</div>' +
        '<div class="small" dir="ltr" style="opacity:.55">' + UI.esc(m.phone) + ' · ' + m.code + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0">' +
        '<div class="mono-num">' + UI.num(m.points) + '</div>' +
        '<div class="tierdot" data-t="' + t.id + '">' + t.name + '</div>' +
      '</div></button>';
  }

  // ===========================================================================
  // SECTION · TODAY
  // ===========================================================================
  function sectionToday(d) {
    var live = d.orders.filter(function (o) { return o.placed >= midnight() || o.status !== 'collected'; });

    return '<div class="grid grid-4 keep">' +
        kpi('Orders today', UI.num(d.today.length)) +
        kpi('Revenue today', UI.num(d.revToday) + '<span class="u-t">t</span>') +
        kpi('Points today', UI.num(d.ptsToday)) +
        kpi('Open now', UI.num(d.open.length)) +
      '</div>' +

      '<h2 class="eyebrow mt-l">Live orders</h2>' +
      '<div class="kanban mt-s">' + STATUS.map(function (c) {
        var list = live.filter(function (o) { return o.status === c[0]; });
        return '<div class="kcol"><div class="kcol__h"><span>' + c[1] + '</span>' +
          '<span>' + list.length + '</span></div>' +
          (list.length ? list.slice(0, 20).map(function (o) {
            var m = d.members.filter(function (x) { return x.id === o.memberId; })[0];
            var nx = STATUS[STATUS.map(function (x) { return x[0]; }).indexOf(o.status) + 1];
            return '<article class="kticket">' +
              '<div class="between"><strong class="kticket__ref">#' + o.ref + '</strong>' +
                '<span class="small">' + UI.time(o.placed) + '</span></div>' +
              '<ul>' + o.items.map(function (i) {
                return '<li>' + (i.qty > 1 ? i.qty + '× ' : '') + UI.esc(i.en) + '</li>';
              }).join('') + '</ul>' +
              (o.note ? '<div class="small" style="opacity:.7">“' + UI.esc(o.note) + '”</div>' : '') +
              '<div class="between"><span class="small">' +
                (m ? UI.esc(m.name.split(' ')[0]) : 'Guest') + ' · ' + UI.esc(o.mode) + '</span>' +
                '<span class="pts">' + o.points + '</span></div>' +
              (nx ? '<button class="btn btn--ghost btn--sm" data-adv="' + o.id +
                    '" data-to="' + nx[0] + '" type="button">Mark ' + nx[1].toLowerCase() + '</button>' : '') +
            '</article>';
          }).join('') : '<p class="small" style="opacity:.35;padding:10px 0">Empty</p>') +
        '</div>';
      }).join('') + '</div>';
  }

  // ===========================================================================
  // SECTION · TILL
  // ===========================================================================
  function sectionTill(d) {
    var lines = Object.keys(till).filter(function (k) { return till[k] > 0; });
    var total = 0, points = 0;
    lines.forEach(function (id) {
      var it = CC.ITEMS[id];
      total += it.price * till[id];
      points += it.pts * till[id];
    });
    var m = tillMember ? d.members.filter(function (x) { return x.id === tillMember; })[0] : null;

    var html = '<div class="card">' +
      '<div class="eyebrow">Who is it for?</div>' +
      (m
        ? '<div class="tile mt-s between" style="flex-wrap:wrap;gap:10px">' +
            '<div><strong>' + UI.esc(m.name) + '</strong>' +
            '<div class="small" dir="ltr">' + UI.esc(m.phone) + ' · ' + m.code + '</div>' +
            '<div class="small">' + S.tierOf(m.lifetime).name + ' · ' + UI.num(m.points) + ' points</div></div>' +
            '<button class="btn btn--ghost btn--sm" id="tillClear" type="button">Change</button>' +
          '</div>'
        : '<p class="small mt-s">Scan or type the member code, or search a name or number. ' +
          'Leave empty to ring up a guest — no points are awarded.</p>' +
          '<div class="row mt-s" style="gap:8px;flex-wrap:wrap">' +
            '<input class="input" id="tillFind" placeholder="CC-XXXXXX, name or mobile" ' +
              'style="flex:1;min-width:200px" autocomplete="off" aria-label="Find member">' +
            '<button class="btn btn--sm" id="tillFindGo" type="button">Find</button>' +
          '</div>' +
          '<div id="tillFound" class="mt-s"></div>' +
          '<button class="btn btn--ghost btn--sm mt-s" id="tillNew" type="button">' +
            UI.icon('plus', 14) + ' New member</button>') +
    '</div>';

    // -- the open ticket
    html += '<div class="card mt-m">' +
      '<div class="between"><div class="eyebrow">Ticket</div>' +
      (lines.length ? '<button class="btn btn--ghost btn--sm" id="tillReset" type="button">Clear</button>' : '') +
      '</div>' +
      (lines.length
        ? '<ul class="mt-s">' + lines.map(function (id) {
            var it = CC.ITEMS[id];
            return '<li class="lrow">' +
              '<div style="min-width:0"><div>' + UI.esc(it.en) + '</div>' +
              '<div class="small">' + UI.price(it.price) + ' · ' + it.pts + ' pts each</div></div>' +
              '<div class="row" style="gap:10px">' +
                '<div class="qty">' +
                  '<button type="button" data-till="-1" data-id="' + id + '" aria-label="One fewer">' +
                    UI.icon('minus', 12) + '</button>' +
                  '<output>' + till[id] + '</output>' +
                  '<button type="button" data-till="1" data-id="' + id + '" aria-label="One more">' +
                    UI.icon('plus', 12) + '</button>' +
                '</div>' +
                '<strong class="mono-num nowrap">' + UI.price(it.price * till[id]) + '</strong>' +
              '</div></li>';
          }).join('') + '</ul>' +
          '<div class="between mt-m" style="padding-top:12px;border-top:1px solid rgba(255,255,255,.12)">' +
            '<span class="small">Total</span>' +
            '<strong class="mono-num" style="font-size:1.3rem">' + UI.price(total) + '</strong></div>' +
          '<div class="between mt-s"><span class="small">Points awarded</span>' +
            '<span class="pts">' + (m ? '+' + UI.num(points) : 'guest — none') + '</span></div>' +
          '<button class="btn btn--block btn--lg mt-m" id="tillCharge" type="button">' +
            'Complete sale · ' + UI.price(total) + '</button>'
        : '<p class="small mt-s">Tap items below to build the ticket.</p>') +
    '</div>';

    // -- item picker
    html += '<div class="mt-l"><div class="between">' +
      '<h2 class="eyebrow">Add items</h2>' +
      '<input class="input" id="tillSearch" placeholder="Filter…" value="' + UI.esc(tillQuery) + '" ' +
        'style="max-width:170px;padding:8px 13px;font-size:.82rem" aria-label="Filter items">' +
      '</div>' +
      '<div class="tillgrid mt-s">' +
        CC.MENU.concat([{ id: 'extras', label: 'Add-ons', items: CC.EXTRAS }]).map(function (sec) {
          return CC.sectionItems(sec).map(function (it) {
            var off = S.isSoldOut(it.id);
            return '<button class="tillbtn' + (off ? ' is-off' : '') + '" type="button" ' +
              (off ? 'disabled ' : '') + 'data-tilladd="' + it.id + '" ' +
              'data-f="' + UI.esc((it.en + ' ' + (it.desc || '') + ' ' + sec.label).toLowerCase()) + '">' +
              '<span class="tillbtn__n">' + UI.esc(it.en) + '</span>' +
              '<span class="tillbtn__m">' + UI.price(it.price) +
                (off ? ' · sold out' : ' · ' + it.pts + ' pts') + '</span>' +
              (till[it.id] ? '<span class="tillbtn__q">' + till[it.id] + '</span>' : '') +
            '</button>';
          }).join('');
        }).join('') +
      '</div></div>';

    return html;
  }

  // ===========================================================================
  // SECTION · MEMBERS
  // ===========================================================================
  function sectionMembers(d) {
    var rows = d.members.map(function (m) {
      var tier = S.tierOf(m.lifetime);
      return {
        id: m.id, code: m.code, name: m.name, phone: m.phone, tier: tier,
        visits: m.visits, spend: m.spend, points: m.points, lifetime: m.lifetime,
        joined: m.joined, lastSeen: d.lastSeen[m.id] || m.joined,
        fav: m.favourite && CC.ITEMS[m.favourite] ? CC.ITEMS[m.favourite].en : '—'
      };
    });
    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (sortKey === 'tier') { x = a.tier.min; y = b.tier.min; }
      if (typeof x === 'string') return x.localeCompare(y) * sortDir;
      return (x - y) * sortDir;
    });

    // the sort trigger is a real button so it is reachable by keyboard;
    // aria-sort stays on the th where assistive tech expects it
    function th(key, label) {
      return '<th' +
        (sortKey === key ? ' aria-sort="' + (sortDir === 1 ? 'ascending' : 'descending') + '"' : '') +
        '><button type="button" class="thsort" data-sort="' + key + '">' + label + '</button></th>';
    }

    return '<div class="between" style="flex-wrap:wrap;gap:10px">' +
        '<h2 class="eyebrow">Members · <span id="mCount">' + rows.length + '</span></h2>' +
        '<div class="row" style="gap:8px">' +
          '<input class="input" id="crmSearch" placeholder="Search…" value="' + UI.esc(mQuery) + '" ' +
            'style="max-width:200px;padding:9px 14px;font-size:.86rem" aria-label="Search members">' +
          '<button class="btn btn--ghost btn--sm" id="csvBtn" type="button">' +
            UI.icon('dl', 15) + ' CSV</button>' +
        '</div>' +
      '</div>' +

      // phone: tappable cards. desktop: the full table.
      '<div class="crm-cards mt-s">' +
        rows.map(function (r) {
          return memberRow(d.members.filter(function (x) { return x.id === r.id; })[0]);
        }).join('') +
      '</div>' +

      '<div class="crm-table-wrap mt-s"><table class="crm-table"><thead><tr>' +
        th('name', 'Member') + th('tier', 'Tier') + th('visits', 'Orders') +
        th('spend', 'Spend') + th('points', 'Points') + th('lifetime', 'Lifetime') +
        '<th style="cursor:default">Usual</th>' + th('lastSeen', 'Last seen') +
      '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr data-f="' +
              UI.esc((r.name + ' ' + r.phone + ' ' + r.code + ' ' + r.fav).toLowerCase()) + '">' +
            '<td><button type="button" class="linkish" data-member="' + r.id + '">' +
                UI.esc(r.name) + '</button>' +
              '<div class="small" dir="ltr" style="opacity:.5">' + UI.esc(r.phone) + ' · ' + r.code + '</div></td>' +
            '<td><span class="tierdot" data-t="' + r.tier.id + '">' + r.tier.name + '</span></td>' +
            '<td class="num">' + r.visits + '</td>' +
            '<td class="num">' + UI.num(r.spend) + '</td>' +
            '<td class="num">' + UI.num(r.points) + '</td>' +
            '<td class="num">' + UI.num(r.lifetime) + '</td>' +
            '<td class="small">' + UI.esc(r.fav) + '</td>' +
            '<td class="small">' + UI.ago(r.lastSeen) + '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table></div>' +
      '<p class="empty hide" id="mNone">No members match that.</p>';
  }

  // ===========================================================================
  // SECTION · MENU AVAILABILITY
  // ===========================================================================
  function sectionMenu() {
    var off = S.soldOut().length;
    return '<div class="between" style="flex-wrap:wrap;gap:10px">' +
        '<h2 class="eyebrow">Availability</h2>' +
        (off ? '<button class="btn btn--ghost btn--sm" id="allBack" type="button">' +
               UI.icon('refresh', 15) + ' Put all back</button>' : '') +
      '</div>' +
      '<p class="small mt-s">Switch an item off and it shows as sold out on the customer menu ' +
      'straight away — they cannot add it to a bag.' +
      (off ? ' <strong>' + off + ' off right now.</strong>' : '') + '</p>' +

      CC.MENU.concat([{ id: 'extras', label: 'Add to any drink', items: CC.EXTRAS }]).map(function (sec) {
        return '<div class="mt-l"><div class="eyebrow">' + UI.esc(sec.label) + '</div>' +
          '<ul class="mt-s">' + CC.sectionItems(sec).map(function (it) {
            var isOff = S.isSoldOut(it.id);
            return '<li class="lrow">' +
              '<div style="min-width:0"><div' + (isOff ? ' style="opacity:.45"' : '') + '>' +
                UI.esc(it.en) + '</div>' +
                '<div class="small" style="opacity:.5">' + UI.price(it.price) + ' · ' + it.pts + ' pts</div></div>' +
              '<button class="toggle' + (isOff ? '' : ' on') + '" role="switch" ' +
                'aria-checked="' + (isOff ? 'false' : 'true') + '" ' +
                'aria-label="' + UI.esc(it.en) + ' available" ' +
                'data-avail="' + it.id + '" type="button"><i></i></button>' +
            '</li>';
          }).join('') + '</ul></div>';
      }).join('');
  }

  // ===========================================================================
  // SECTION · INSIGHTS
  // ===========================================================================
  function sectionInsights(d) {
    var since = Date.now() - 30 * 864e5;
    var counts = {};
    d.orders.filter(function (o) { return o.placed >= since; })
      .forEach(function (o) { o.items.forEach(function (i) { counts[i.id] = (counts[i.id] || 0) + i.qty; }); });
    var top = Object.keys(counts).map(function (k) { return { id: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var topMax = top.length ? top[0].n : 1;

    // revenue for the last 14 days
    var days = [], today0 = midnight();
    for (var i = 13; i >= 0; i--) {
      var start = today0 - i * 864e5;
      var sum = d.orders.filter(function (o) { return dayStart(o.placed) === start; })
        .reduce(function (a, o) { return a + o.total; }, 0);
      days.push({ start: start, sum: sum });
    }
    var dayMax = Math.max.apply(null, days.map(function (x) { return x.sum; }).concat([1]));
    var aov = d.orders.length
      ? Math.round(d.orders.reduce(function (a, o) { return a + o.total; }, 0) / d.orders.length) : 0;
    var active30 = d.members.filter(function (m) {
      return d.orders.some(function (o) { return o.memberId === m.id && o.placed >= since; });
    }).length;

    return '<div class="grid grid-4 keep">' +
        kpi('Members', UI.num(d.members.length)) +
        kpi('Active · 30d', UI.num(active30)) +
        kpi('Avg order', UI.num(aov) + '<span class="u-t">t</span>') +
        kpi('Redemptions', UI.num(d.redemptions)) +
      '</div>' +

      '<div class="card mt-l"><div class="eyebrow">Revenue · last 14 days</div>' +
        '<div class="daychart mt-s">' + days.map(function (x) {
          return '<div class="daychart__col" title="' + UI.date(x.start) + ' · ' + UI.num(x.sum) + 't">' +
            '<i style="height:' + Math.max(2, Math.round((x.sum / dayMax) * 100)) + '%"></i>' +
            '<span>' + new Date(x.start).toLocaleDateString('en-GB', { weekday: 'narrow' }) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="small mt-s" style="opacity:.6">Peak day ' + UI.num(dayMax) + ' t</div>' +
      '</div>' +

      '<div class="grid split-even mt-l">' +
        '<div class="card"><div class="eyebrow">Top sellers · 30 days</div>' +
          '<div class="barchart mt-s">' + (top.length ? top.map(function (t) {
            var it = CC.ITEMS[t.id];
            return '<div class="barchart__row"><div class="barchart__bar">' +
              '<span>' + UI.esc(it ? it.en : t.id) + '</span>' +
              '<i style="width:' + Math.round((t.n / topMax) * 100) + '%"></i></div>' +
              '<span class="num" style="text-align:right;font-variant-numeric:tabular-nums">' +
              t.n + '</span></div>';
          }).join('') : '<p class="small" style="opacity:.5">No sales yet.</p>') + '</div>' +
        '</div>' +
        '<div class="card"><div class="eyebrow">Points economy</div>' +
          '<ul class="mt-s">' +
            '<li class="lrow"><span class="small">Issued all-time</span><strong class="mono-num">' + UI.num(d.ptsIssued) + '</strong></li>' +
            '<li class="lrow"><span class="small">Outstanding</span><strong class="mono-num">' + UI.num(d.ptsOut) + '</strong></li>' +
            '<li class="lrow"><span class="small">Burned on rewards</span><strong class="mono-num">' + UI.num(d.ptsBurned) + '</strong></li>' +
            '<li class="lrow"><span class="small">Burn rate</span><strong class="mono-num">' +
              (d.ptsIssued ? Math.round((d.ptsBurned / d.ptsIssued) * 100) : 0) + '%</strong></li>' +
            '<li class="lrow"><span class="small">Avg points / order</span><strong class="mono-num">' +
              (d.orders.length ? Math.round(d.ptsIssued / d.orders.length) : 0) + '</strong></li>' +
          '</ul>' +
          '<button class="btn btn--ghost btn--sm mt-m" id="csvOrders" type="button">' +
            UI.icon('dl', 15) + ' Export orders</button>' +
        '</div>' +
      '</div>';
  }

  // ===========================================================================
  // MEMBER SHEET
  // ===========================================================================
  function openMember(id) {
    var m = S.members().filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var t = S.tierOf(m.lifetime);
    var orders = S.ordersOf(m.id).slice(0, 8);

    UI.sheet(
      '<div class="between" style="align-items:flex-start">' +
        '<div><h2 class="h3">' + UI.esc(m.name) + '</h2>' +
        '<div class="small" dir="ltr">' + UI.esc(m.phone) + '</div>' +
        '<div class="kticket__ref mt-s">' + m.code + '</div></div>' +
        '<div style="text-align:right"><div class="stat__n">' + UI.num(m.points) + '</div>' +
        '<div class="stat__l">points</div></div>' +
      '</div>' +
      '<div class="grid grid-4 keep mt-m">' +
        '<div class="stat"><div class="stat__n">' + m.visits + '</div><div class="stat__l">Orders</div></div>' +
        '<div class="stat"><div class="stat__n">' + UI.num(m.spend) + '</div><div class="stat__l">Spend</div></div>' +
        '<div class="stat"><div class="stat__n">' + UI.num(m.lifetime) + '</div><div class="stat__l">Lifetime</div></div>' +
        '<div class="stat"><div class="stat__n">' + m.redeemed.length + '</div><div class="stat__l">Rewards</div></div>' +
      '</div>' +
      '<div class="tile mt-m"><div class="between">' +
        '<div><div class="eyebrow">Tier</div><strong>' + t.name + '</strong></div>' +
        '<div class="small" style="max-width:18ch;text-align:right">' + UI.esc(t.perk) + '</div>' +
      '</div></div>' +

      '<div class="eyebrow mt-l">Adjust points</div>' +
      '<div class="row mt-s" style="gap:8px;flex-wrap:wrap">' +
        '<input class="input" id="adjV" type="number" inputmode="numeric" placeholder="e.g. 50 or -50" ' +
          'style="flex:1;min-width:140px" aria-label="Point adjustment">' +
        '<button class="btn btn--sm" id="adjGo" type="button">Apply</button>' +
      '</div>' +
      '<p class="small mt-s" style="opacity:.55">Use for corrections and goodwill. Adjustments ' +
      'change the available balance, not lifetime totals or tier.</p>' +

      '<div class="eyebrow mt-l">Recent orders</div>' +
      (orders.length ? '<ul class="mt-s">' + orders.map(function (o) {
        return '<li class="lrow"><div style="min-width:0">' +
          '<div class="row" style="gap:8px"><strong class="kticket__ref">#' + o.ref + '</strong>' +
          '<span class="status" data-s="' + o.status + '">' + o.status + '</span></div>' +
          '<div class="small">' + o.items.map(function (i) {
            return UI.esc(i.en) + (i.qty > 1 ? ' ×' + i.qty : '');
          }).join(', ') + '</div>' +
          '<div class="small" style="opacity:.55">' + UI.ago(o.placed) + '</div></div>' +
          '<div style="text-align:right"><div class="mono-num">' + UI.price(o.total) + '</div>' +
          '<div class="pts mt-s">+' + o.points + '</div></div></li>';
      }).join('') + '</ul>' : '<p class="small mt-s">No orders yet.</p>') +

      '<button class="btn btn--ghost btn--block mt-l" id="tillFor" type="button">' +
        'Start a till sale for ' + UI.esc(m.name.split(' ')[0]) + '</button>' +
      '<button class="btn btn--ghost btn--block mt-s" data-close-sheet type="button">Close</button>'
    );

    UI.qs('#adjGo').addEventListener('click', function () {
      var v = parseInt(UI.qs('#adjV').value, 10);
      if (!v || isNaN(v)) { UI.toast('Enter a number, plus or minus'); return; }
      var next = Math.max(0, m.points + v);
      S.updateMember(m.id, { points: next });
      UI.closeSheet();
      UI.toast('<b>' + UI.esc(m.name.split(' ')[0]) + '</b> now has ' + UI.num(next) + ' points',
               (v > 0 ? '+' : '') + v);
      CC.App.render();
    });
    UI.qs('#tillFor').addEventListener('click', function () {
      tillMember = m.id; section = 'till';
      UI.closeSheet(); CC.App.render();
    });
    UI.qsa('[data-close-sheet]').forEach(function (b) {
      b.addEventListener('click', UI.closeSheet);
    });
  }

  // ===========================================================================
  // DASHBOARD SHELL
  // ===========================================================================
  var SECTIONS = [['today', 'Today'], ['till', 'Till'], ['members', 'Members'],
                  ['menu', 'Menu'], ['insights', 'Insights']];

  function dashboard() {
    var d = snapshot();
    var body = section === 'till' ? sectionTill(d)
             : section === 'members' ? sectionMembers(d)
             : section === 'menu' ? sectionMenu()
             : section === 'insights' ? sectionInsights(d)
             : sectionToday(d);

    var html = '<div class="crm"><div class="wrap pagehead">' +
      '<div class="between" style="align-items:flex-start;gap:12px">' +
        '<div style="min-width:0"><div class="eyebrow">Code Concept · Operations</div>' +
        '<h1 class="h2" style="margin-top:6px">' + (SECTIONS.filter(function (s) {
          return s[0] === section; })[0] || SECTIONS[0])[1] + '</h1></div>' +
        '<button class="btn btn--ghost btn--sm" id="crmOut" type="button" ' +
          'style="flex-shrink:0">' + UI.icon('lock', 15) + ' Lock</button>' +
      '</div>' +

      '<div class="crmnav mt-m">' + SECTIONS.map(function (s) {
        var on = s[0] === section;
        return '<button class="chip' + (on ? ' is-on' : '') + '" data-sec="' + s[0] + '" ' +
          'type="button" aria-pressed="' + on + '"><span>' + s[1] +
          (s[0] === 'today' && d.open.length ? ' · ' + d.open.length : '') + '</span></button>';
      }).join('') + '</div>' +

      '<div class="mt-l">' + body + '</div>' +
      '<div style="height:60px"></div>' +
    '</div></div>';

    function mount() {
      UI.qs('#crmOut').addEventListener('click', function () {
        S.setStaff(false); till = {}; tillMember = null;
        UI.toast('Locked'); CC.App.go('#/');
      });
      UI.qsa('.crmnav [data-sec]').forEach(function (b) {
        b.addEventListener('click', function () { section = b.dataset.sec; CC.App.render(); });
      });

      // -- today
      UI.qsa('[data-adv]').forEach(function (b) {
        b.addEventListener('click', function () {
          S.setStatus(b.dataset.adv, b.dataset.to);
          UI.toast('Order moved to <b>' + b.dataset.to + '</b>');
          CC.App.render();
        });
      });

      // -- member cards / rows open the detail sheet
      UI.qsa('[data-member]').forEach(function (el) {
        el.addEventListener('click', function () { openMember(el.dataset.member); });
      });

      // -- members: filter in place, no re-render, so focus is never lost
      var search = UI.qs('#crmSearch');
      if (search) {
        var rowsEls = UI.qsa('.crm-table tbody tr');
        var cardEls = UI.qsa('.crm-cards .crm-mini');
        var applyMembers = function () {
          var q = mQuery.trim().toLowerCase(), shown = 0;
          rowsEls.forEach(function (tr, i) {
            var hit = !q || tr.dataset.f.indexOf(q) !== -1;
            tr.classList.toggle('hide', !hit);
            if (cardEls[i]) cardEls[i].classList.toggle('hide', !hit);
            if (hit) shown++;
          });
          var count = UI.qs('#mCount'); if (count) count.textContent = shown;
          UI.qs('#mNone').classList.toggle('hide', shown > 0);
        };
        search.addEventListener('input', function () { mQuery = search.value; applyMembers(); });
        if (mQuery) applyMembers();          // a re-render must not drop the filter
      }
      UI.qsa('[data-sort]').forEach(function (h) {
        h.addEventListener('click', function () {
          var k = h.dataset.sort;
          if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; }
          CC.App.render();
        });
      });
      var csv = UI.qs('#csvBtn');
      if (csv) csv.addEventListener('click', function () {
        var head = ['Code', 'Name', 'Phone', 'Tier', 'Orders', 'Spend (thousand toman)',
                    'Points available', 'Lifetime points', 'Joined', 'Last seen'];
        var body2 = S.members().map(function (m) {
          return [m.code, m.name, m.phone, S.tierOf(m.lifetime).name, m.visits, m.spend,
                  m.points, m.lifetime, UI.date(m.joined), UI.date(d.lastSeen[m.id] || m.joined)];
        });
        UI.download('code-concept-members.csv', UI.csv([head].concat(body2)));
        UI.toast('Exported <b>' + body2.length + '</b> members');
      });
      var csvO = UI.qs('#csvOrders');
      if (csvO) csvO.addEventListener('click', function () {
        var head = ['Ref', 'Date', 'Time', 'Member', 'Code', 'Mode', 'Status',
                    'Items', 'Total (thousand toman)', 'Points'];
        var byId = {};
        S.members().forEach(function (m) { byId[m.id] = m; });
        var body2 = S.orders().map(function (o) {
          var m = byId[o.memberId];
          return [o.ref, UI.date(o.placed), UI.time(o.placed), m ? m.name : 'Guest',
                  m ? m.code : '', o.mode, o.status,
                  o.items.map(function (i) { return i.qty + '× ' + i.en; }).join('; '),
                  o.total, o.points];
        });
        UI.download('code-concept-orders.csv', UI.csv([head].concat(body2)));
        UI.toast('Exported <b>' + body2.length + '</b> orders');
      });

      // -- availability
      UI.qsa('[data-avail]').forEach(function (b) {
        b.addEventListener('click', function () {
          var nowOff = S.toggleSoldOut(b.dataset.avail);
          var it = CC.ITEMS[b.dataset.avail];
          UI.toast('<b>' + UI.esc(it.en) + '</b> ' + (nowOff ? 'marked sold out' : 'back on'));
          CC.App.render();
        });
      });
      var allBack = UI.qs('#allBack');
      if (allBack) allBack.addEventListener('click', function () {
        S.soldOut().slice().forEach(function (id) { S.toggleSoldOut(id); });
        UI.toast('Everything back on the menu');
        CC.App.render();
      });

      // -- till
      var find = UI.qs('#tillFind');
      function doFind() {
        var q = find.value.trim().toLowerCase();
        var out = UI.qs('#tillFound');
        if (!q) { out.innerHTML = ''; return; }
        var hits = S.members().filter(function (m) {
          return m.code.toLowerCase() === q ||
                 m.phone.replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) !== -1 && /\d/.test(q) ||
                 m.name.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 6);
        out.innerHTML = hits.length
          ? hits.map(memberRow).join('')
          : '<p class="small">No member matches that.</p>';
        UI.qsa('[data-member]', out).forEach(function (el) {
          el.addEventListener('click', function () {
            tillMember = el.dataset.member; CC.App.render();
          });
        });
      }
      if (find) {
        UI.qs('#tillFindGo').addEventListener('click', doFind);
        find.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFind(); });
        find.addEventListener('input', doFind);
      }
      var tillNew = UI.qs('#tillNew');
      if (tillNew) tillNew.addEventListener('click', function () {
        UI.sheet('<h2 class="h3">New member</h2>' +
          '<p class="small mt-s">Card is created straight away and points start counting.</p>' +
          '<div class="field mt-m"><label for="nmName">Name</label>' +
            '<input class="input" id="nmName" autocomplete="off" placeholder="Full name"></div>' +
          '<div class="field mt-s"><label for="nmPhone">Mobile</label>' +
            '<input class="input" id="nmPhone" type="tel" inputmode="tel" dir="ltr" ' +
            'placeholder="0914 000 0000"></div>' +
          '<div class="err" id="nmErr"></div>' +
          '<button class="btn btn--block mt-s" id="nmGo" type="button">Create card</button>' +
          '<button class="btn btn--ghost btn--block mt-s" data-close-sheet type="button">Cancel</button>');
        UI.qsa('[data-close-sheet]').forEach(function (b) { b.addEventListener('click', UI.closeSheet); });
        UI.qs('#nmGo').addEventListener('click', function () {
          var name = UI.qs('#nmName').value.trim(), phone = UI.qs('#nmPhone').value.trim();
          var err = UI.qs('#nmErr');
          if (name.length < 2) { err.textContent = 'Add a name.'; return; }
          if (!UI.validPhone(phone)) { err.textContent = 'That mobile number does not look right.'; return; }
          // join() returns the EXISTING card when the number is already on file,
          // and signs that person in either way — the till device must keep
          // whatever session it already had.
          var existed = !!S.findByPhone(phone);
          var prev = S.me();
          var m = S.join(name, phone);
          if (prev) S.signIn(prev.id); else S.signOut();
          tillMember = m.id;
          UI.closeSheet();
          UI.toast(existed
            ? 'Already a member — <b>' + UI.esc(m.name) + '</b> · ' + m.code
            : 'Card created · <b>' + m.code + '</b>');
          CC.App.render();
        });
      });
      var tillClear = UI.qs('#tillClear');
      if (tillClear) tillClear.addEventListener('click', function () {
        tillMember = null; CC.App.render();
      });
      UI.qsa('[data-tilladd]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.dataset.tilladd;
          till[id] = (till[id] || 0) + 1;
          CC.App.render();
        });
      });
      UI.qsa('[data-till]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.dataset.id, delta = parseInt(b.dataset.till, 10);
          till[id] = Math.max(0, (till[id] || 0) + delta);
          if (!till[id]) delete till[id];
          CC.App.render();
        });
      });
      var tillReset = UI.qs('#tillReset');
      if (tillReset) tillReset.addEventListener('click', function () {
        till = {}; CC.App.render();
      });
      var tillSearch = UI.qs('#tillSearch');
      if (tillSearch) {
        var applyTill = function () {
          var q = tillQuery.trim().toLowerCase();
          UI.qsa('.tillbtn').forEach(function (b) {
            b.classList.toggle('hide', !!q && b.dataset.f.indexOf(q) === -1);
          });
        };
        tillSearch.addEventListener('input', function () { tillQuery = tillSearch.value; applyTill(); });
        if (tillQuery) applyTill();          // every till tap re-renders; keep the filter
      }
      var charge = UI.qs('#tillCharge');
      if (charge) charge.addEventListener('click', function () {
        var lines = Object.keys(till).filter(function (k) { return till[k] > 0 && CC.ITEMS[k]; })
          .map(function (id) { return { id: id, qty: till[id] }; });
        if (!lines.length) return;
        var o = S.placeOrder(tillMember, lines, 'counter', '');
        if (!o) { UI.toast('Nothing on that ticket could be rung up'); return; }
        S.setStatus(o.id, 'collected');
        var who = tillMember
          ? S.members().filter(function (x) { return x.id === tillMember; })[0] : null;
        till = {}; tillMember = null;
        UI.toast('Sale <b>' + o.ref + '</b> rung up' +
                 (who ? ' for ' + UI.esc(who.name.split(' ')[0]) : ''),
                 who ? '+' + o.points + ' PTS' : UI.num(o.total) + ' t');
        CC.App.render();
      });
    }

    return { html: html, tone: 'dark', mount: mount };
  }

  CC.Views.crm = function () { return S.isStaff() ? dashboard() : lock(); };
})(window.CC = window.CC || {});
