/* crm.js — the staff side: live orders, members, points economy. */
(function (CC) {
  'use strict';

  var UI = CC.UI, S = CC.Store;
  var PASSCODE = '2468';               // preview build — deliberately printed on screen
  var sortKey = 'lastSeen', sortDir = -1, query = '';

  function midnight() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }

  function lock() {
    var html = '<div class="crm"><div class="wrap pagehead" style="max-width:420px">' +
      '<div class="center">' + UI.icon('lock', 26) + '</div>' +
      '<h1 class="h2 center" style="margin-top:14px">Staff</h1>' +
      '<p class="small center mt-s">Code Concept operations. Enter the team passcode.</p>' +
      '<div class="field mt-l"><label for="pc">Passcode</label>' +
        '<input class="input" id="pc" type="password" inputmode="numeric" autocomplete="off" ' +
        'maxlength="8" placeholder="••••" style="text-align:center;letter-spacing:.5em;font-size:1.3rem"></div>' +
      '<div class="err center" id="pcErr"></div>' +
      '<button class="btn btn--block mt-s" id="pcGo" type="button">Unlock</button>' +
      '<p class="small center mt-m" style="opacity:.5">Preview build · passcode <b>' + PASSCODE + '</b></p>' +
      '<div class="center mt-l"><a class="btn btn--ghost btn--sm" href="#/">' + UI.icon('back', 15) + ' Back to the site</a></div>' +
      '<div style="height:40px"></div>' +
    '</div></div>';

    function mount() {
      function go() {
        if (UI.qs('#pc').value.trim() === PASSCODE) {
          S.setStaff(true);
          UI.toast('Welcome back');
          CC.App.render();
        } else {
          UI.qs('#pcErr').textContent = 'Wrong passcode.';
          UI.qs('#pc').value = '';
          UI.qs('#pc').focus();
        }
      }
      UI.qs('#pcGo').addEventListener('click', go);
      UI.qs('#pc').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      UI.qs('#pc').focus();
    }
    return { html: html, tone: 'dark', mount: mount };
  }

  function dashboard() {
    var members = S.members(), orders = S.orders();
    var t0 = midnight();
    var today = orders.filter(function (o) { return o.placed >= t0; });
    var week = orders.filter(function (o) { return o.placed >= Date.now() - 7 * 864e5; });

    var revToday = today.reduce(function (a, o) { return a + o.total; }, 0);
    var revWeek = week.reduce(function (a, o) { return a + o.total; }, 0);
    var ptsOut = members.reduce(function (a, m) { return a + m.points; }, 0);
    var ptsIssued = members.reduce(function (a, m) { return a + m.lifetime; }, 0);
    var redemptions = members.reduce(function (a, m) { return a + m.redeemed.length; }, 0);
    var aov = orders.length ? Math.round(orders.reduce(function (a, o) { return a + o.total; }, 0) / orders.length) : 0;
    var active30 = members.filter(function (m) {
      return orders.some(function (o) { return o.memberId === m.id && o.placed >= Date.now() - 30 * 864e5; });
    }).length;

    // last seen per member
    var lastSeen = {};
    orders.forEach(function (o) {
      if (!o.memberId) return;
      if (!lastSeen[o.memberId] || o.placed > lastSeen[o.memberId]) lastSeen[o.memberId] = o.placed;
    });

    // top items over the trailing 30 days
    var counts = {};
    orders.filter(function (o) { return o.placed >= Date.now() - 30 * 864e5; })
      .forEach(function (o) { o.items.forEach(function (i) { counts[i.id] = (counts[i.id] || 0) + i.qty; }); });
    var top = Object.keys(counts).map(function (k) { return { id: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 7);
    var topMax = top.length ? top[0].n : 1;

    var COLS = [['new', 'Incoming'], ['preparing', 'On the bar'], ['ready', 'Ready'], ['collected', 'Collected']];
    var liveOrders = orders.filter(function (o) { return o.placed >= t0 || o.status !== 'collected'; });

    var rows = members.map(function (m) {
      var tier = S.tierOf(m.lifetime);
      return {
        id: m.id, code: m.code, name: m.name, phone: m.phone, tier: tier,
        visits: m.visits, spend: m.spend, points: m.points, lifetime: m.lifetime,
        joined: m.joined, lastSeen: lastSeen[m.id] || m.joined,
        fav: m.favourite && CC.ITEMS[m.favourite] ? CC.ITEMS[m.favourite].en : '—'
      };
    });
    var q = query.toLowerCase();
    if (q) {
      rows = rows.filter(function (r) {
        return (r.name + ' ' + r.phone + ' ' + r.code + ' ' + r.fav).toLowerCase().indexOf(q) !== -1;
      });
    }
    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (typeof x === 'object') { x = a.tier.min; y = b.tier.min; }
      if (typeof x === 'string') return x.localeCompare(y) * sortDir;
      return (x - y) * sortDir;
    });

    function th(key, label) {
      return '<th data-sort="' + key + '"' +
        (sortKey === key ? ' aria-sort="' + (sortDir === 1 ? 'ascending' : 'descending') + '"' : '') +
        '>' + label + '</th>';
    }

    var html = '<div class="crm"><div class="wrap pagehead">' +

      '<div class="between" style="flex-wrap:wrap;gap:12px">' +
        '<div><div class="eyebrow">Operations</div>' +
        '<h1 class="h2" style="margin-top:6px">Dashboard</h1></div>' +
        '<div class="row" style="gap:8px">' +
          '<button class="btn btn--ghost btn--sm" id="csvBtn" type="button">' + UI.icon('dl', 15) + ' CSV</button>' +
          '<button class="btn btn--ghost btn--sm" id="crmOut" type="button">Lock</button>' +
        '</div>' +
      '</div>' +

      // -- KPIs
      '<div class="grid grid-4 keep mt-l">' +
        [['Orders today', UI.num(today.length)],
         ['Revenue today', UI.num(revToday) + '<span style="font-size:.5em"> t</span>'],
         ['Revenue · 7d', UI.num(revWeek) + '<span style="font-size:.5em"> t</span>'],
         ['Avg order', UI.num(aov) + '<span style="font-size:.5em"> t</span>'],
         ['Members', UI.num(members.length)],
         ['Active · 30d', UI.num(active30)],
         ['Points outstanding', UI.num(ptsOut)],
         ['Redemptions', UI.num(redemptions)]].map(function (k) {
          return '<div class="card"><div class="stat"><div class="stat__n">' + k[1] + '</div>' +
            '<div class="stat__l">' + k[0] + '</div></div></div>';
        }).join('') +
      '</div>' +

      // -- lookup
      '<div class="card mt-l">' +
        '<div class="eyebrow">Member lookup</div>' +
        '<p class="small mt-s">Scan the code on a member card, or type it in.</p>' +
        '<div class="row mt-s" style="gap:8px;flex-wrap:wrap">' +
          '<input class="input" id="lookup" placeholder="CC-XXXXXX" style="max-width:220px;text-transform:uppercase" ' +
            'autocomplete="off" aria-label="Member code">' +
          '<button class="btn btn--sm" id="lookupGo" type="button">Find</button>' +
        '</div>' +
        '<div id="lookupOut" class="mt-s"></div>' +
      '</div>' +

      // -- live board
      '<h2 class="eyebrow mt-l">Live orders</h2>' +
      '<div class="kanban mt-s">' + COLS.map(function (c) {
        var list = liveOrders.filter(function (o) { return o.status === c[0]; });
        return '<div class="kcol"><div class="kcol__h"><span>' + c[1] + '</span><span>' + list.length + '</span></div>' +
          (list.length ? list.slice(0, 12).map(function (o) {
            var m = members.filter(function (x) { return x.id === o.memberId; })[0];
            var nextIdx = COLS.map(function (x) { return x[0]; }).indexOf(o.status) + 1;
            var next = COLS[nextIdx];
            return '<article class="kticket">' +
              '<div class="between"><strong class="kticket__ref">#' + o.ref + '</strong>' +
              '<span class="small">' + UI.time(o.placed) + '</span></div>' +
              '<ul>' + o.items.map(function (i) {
                return '<li>' + (i.qty > 1 ? i.qty + '× ' : '') + UI.esc(i.en) + '</li>';
              }).join('') + '</ul>' +
              (o.note ? '<div class="small" style="opacity:.7">“' + UI.esc(o.note) + '”</div>' : '') +
              '<div class="between"><span class="small">' + (m ? UI.esc(m.name.split(' ')[0]) : 'Guest') +
                ' · ' + o.mode + '</span><span class="pts">' + o.points + '</span></div>' +
              (next ? '<button class="btn btn--ghost btn--sm" data-adv="' + o.id + '" data-to="' + next[0] + '" type="button">' +
                'Mark ' + next[1].toLowerCase() + '</button>' : '') +
            '</article>';
          }).join('') : '<p class="small" style="opacity:.4;padding:10px 0">Empty</p>') +
        '</div>';
      }).join('') + '</div>' +

      // -- top items
      '<div class="grid split-even mt-l">' +
        '<div class="card"><div class="eyebrow">Top sellers · 30 days</div>' +
          '<div class="barchart mt-s">' + top.map(function (t) {
            var it = CC.ITEMS[t.id];
            return '<div class="barchart__row"><div class="barchart__bar">' +
              '<span>' + UI.esc(it ? it.en : t.id) + '</span>' +
              '<i style="width:' + Math.round((t.n / topMax) * 100) + '%"></i></div>' +
              '<span class="num" style="text-align:right;font-variant-numeric:tabular-nums">' + t.n + '</span></div>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="card"><div class="eyebrow">Points economy</div>' +
          '<ul class="mt-s">' +
            '<li class="lrow"><span class="small">Issued all-time</span><strong class="mono-num">' + UI.num(ptsIssued) + '</strong></li>' +
            '<li class="lrow"><span class="small">Outstanding</span><strong class="mono-num">' + UI.num(ptsOut) + '</strong></li>' +
            '<li class="lrow"><span class="small">Burned on rewards</span><strong class="mono-num">' + UI.num(ptsIssued - ptsOut) + '</strong></li>' +
            '<li class="lrow"><span class="small">Burn rate</span><strong class="mono-num">' +
              (ptsIssued ? Math.round(((ptsIssued - ptsOut) / ptsIssued) * 100) : 0) + '%</strong></li>' +
            '<li class="lrow"><span class="small">Avg points / order</span><strong class="mono-num">' +
              (orders.length ? Math.round(ptsIssued / orders.length) : 0) + '</strong></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +

      // -- members
      '<div class="between mt-l" style="flex-wrap:wrap;gap:10px">' +
        '<h2 class="eyebrow">Members · ' + rows.length + '</h2>' +
        '<input class="input" id="crmSearch" placeholder="Search members…" value="' + UI.esc(query) + '" ' +
          'style="max-width:260px;padding:9px 14px;font-size:.86rem" aria-label="Search members">' +
      '</div>' +
      '<div class="crm-table-wrap mt-s"><table class="crm-table"><thead><tr>' +
        th('name', 'Member') + th('tier', 'Tier') + th('visits', 'Orders') +
        th('spend', 'Spend') + th('points', 'Points') + th('lifetime', 'Lifetime') +
        '<th style="cursor:default">Usual</th>' + th('lastSeen', 'Last seen') +
      '</tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          return '<tr>' +
            '<td><div>' + UI.esc(r.name) + '</div>' +
              '<div class="small" dir="ltr" style="opacity:.5">' + UI.esc(r.phone) + ' · ' + r.code + '</div></td>' +
            '<td><span class="tierdot" data-t="' + r.tier.id + '">' + r.tier.name + '</span></td>' +
            '<td class="num">' + r.visits + '</td>' +
            '<td class="num">' + UI.num(r.spend) + '</td>' +
            '<td class="num">' + UI.num(r.points) + '</td>' +
            '<td class="num">' + UI.num(r.lifetime) + '</td>' +
            '<td class="small">' + UI.esc(r.fav) + '</td>' +
            '<td class="small">' + UI.ago(r.lastSeen) + '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="8" class="empty">No members match that.</td></tr>') +
      '</tbody></table></div>' +
      '<div style="height:50px"></div>' +
    '</div></div>';

    function mount() {
      UI.qs('#crmOut').addEventListener('click', function () {
        S.setStaff(false); UI.toast('Locked'); CC.App.go('#/');
      });

      UI.qsa('[data-adv]').forEach(function (b) {
        b.addEventListener('click', function () {
          S.setStatus(b.dataset.adv, b.dataset.to);
          UI.toast('Order moved to <b>' + b.dataset.to + '</b>');
          CC.App.render();
        });
      });

      UI.qsa('th[data-sort]').forEach(function (h) {
        h.addEventListener('click', function () {
          var k = h.dataset.sort;
          if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; }
          CC.App.render();
        });
      });

      var search = UI.qs('#crmSearch');
      search.addEventListener('input', function () {
        query = search.value;
        clearTimeout(search._t);
        search._t = setTimeout(function () {
          CC.App.render();
          var s = UI.qs('#crmSearch');
          if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
        }, 260);
      });

      function doLookup() {
        var code = UI.qs('#lookup').value.trim().toUpperCase();
        var m = S.findByCode(code);
        var out = UI.qs('#lookupOut');
        if (!m) { out.innerHTML = '<p class="small">No member with that code.</p>'; return; }
        var t = S.tierOf(m.lifetime);
        out.innerHTML = '<div class="tile"><div class="between" style="flex-wrap:wrap;gap:10px">' +
          '<div><strong>' + UI.esc(m.name) + '</strong>' +
          '<div class="small" dir="ltr">' + UI.esc(m.phone) + '</div>' +
          '<div class="small">' + t.name + ' · ' + m.visits + ' orders · ' + UI.num(m.spend) + ' t lifetime spend</div></div>' +
          '<div style="text-align:right"><div class="stat__n">' + UI.num(m.points) + '</div>' +
          '<div class="stat__l">points</div></div></div>' +
          '<div class="small mt-s" style="opacity:.65">' + UI.esc(t.perk) + '</div></div>';
      }
      UI.qs('#lookupGo').addEventListener('click', doLookup);
      UI.qs('#lookup').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLookup(); });

      UI.qs('#csvBtn').addEventListener('click', function () {
        var head = ['Code', 'Name', 'Phone', 'Tier', 'Orders', 'Spend (thousand toman)',
                    'Points available', 'Lifetime points', 'Usual', 'Joined', 'Last seen'];
        var body = rows.map(function (r) {
          return [r.code, r.name, r.phone, r.tier.name, r.visits, r.spend, r.points,
                  r.lifetime, r.fav, UI.date(r.joined), UI.date(r.lastSeen)];
        });
        UI.download('code-concept-members.csv', UI.csv([head].concat(body)));
        UI.toast('Exported <b>' + rows.length + '</b> members');
      });
    }

    return { html: html, tone: 'dark', mount: mount };
  }

  CC.Views.crm = function () { return S.isStaff() ? dashboard() : lock(); };
})(window.CC = window.CC || {});
