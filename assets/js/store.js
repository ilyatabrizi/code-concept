/* store.js — everything that persists. localStorage only; no backend, no keys. */
(function (CC) {
  'use strict';

  /* v2 = the real printed menu. Every item id changed, so a returning visitor's
     v1 bag, favourite drink and seeded history all point at drinks that no longer
     exist. Bumping the namespace retires that data instead of half-showing it. */
  var NS = 'cc.v2.';
  var K = { members: NS + 'members', orders: NS + 'orders', session: NS + 'session',
            bag: NS + 'bag', seeded: NS + 'seeded', staff: NS + 'staff',
            soldout: NS + 'soldout' };

  var listeners = [];
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('storage unavailable', e); }
  }

  // ---- deterministic pseudo-random, so the demo looks identical everywhere --
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var CODE_ALPHABET = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';   // no ambiguous glyphs
  function memberCode(rnd) {
    var s = '';
    for (var i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor((rnd || Math.random)() * CODE_ALPHABET.length)];
    return 'CC-' + s;
  }
  function orderRef(rnd) {
    var s = '';
    for (var i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor((rnd || Math.random)() * CODE_ALPHABET.length)];
    return s;
  }

  var Store = {
    on: function (fn) { listeners.push(fn); },

    members: function () { return read(K.members, []); },
    orders:  function () { return read(K.orders, []); },
    bag:     function () { return read(K.bag, []); },

    setBag: function (bag) { write(K.bag, bag); emit(); },

    // ---- session ----------------------------------------------------------
    me: function () {
      var id = read(K.session, null);
      if (!id) return null;
      return this.members().filter(function (m) { return m.id === id; })[0] || null;
    },
    signIn: function (id) { write(K.session, id); emit(); },
    signOut: function () { write(K.session, null); emit(); },

    isStaff: function () { return read(K.staff, false) === true; },
    setStaff: function (v) { write(K.staff, !!v); emit(); },

    // ---- availability (staff can 86 an item from the bar) -----------------
    soldOut: function () { return read(K.soldout, []); },
    isSoldOut: function (id) { return this.soldOut().indexOf(id) !== -1; },
    toggleSoldOut: function (id) {
      var list = this.soldOut(), i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      write(K.soldout, list);
      emit();
      return i === -1;                                   // true = now sold out
    },

    // ---- members ----------------------------------------------------------
    findByPhone: function (phone) {
      var norm = String(phone).replace(/\D/g, '');
      return this.members().filter(function (m) {
        return m.phone.replace(/\D/g, '') === norm;
      })[0] || null;
    },
    findByCode: function (code) {
      var c = String(code).trim().toUpperCase();
      return this.members().filter(function (m) { return m.code === c; })[0] || null;
    },
    join: function (name, phone) {
      var existing = this.findByPhone(phone);
      if (existing) { this.signIn(existing.id); return existing; }
      var members = this.members();
      var m = {
        id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        code: memberCode(),
        name: String(name).trim(),
        phone: String(phone).trim(),
        joined: Date.now(),
        points: 0,
        lifetime: 0,
        spend: 0,
        visits: 0,
        redeemed: [],
        favourite: null,
        note: ''
      };
      members.push(m);
      write(K.members, members);
      this.signIn(m.id);
      return m;
    },
    updateMember: function (id, patch) {
      var members = this.members();
      for (var i = 0; i < members.length; i++) {
        if (members[i].id === id) { Object.assign(members[i], patch); break; }
      }
      write(K.members, members);
      emit();
    },

    // ---- orders -----------------------------------------------------------
    /** lines: [{id, qty}] — prices and points are re-read from the menu. */
    placeOrder: function (memberId, lines, mode, note) {
      var orders = this.orders(), total = 0, points = 0;
      var detailed = lines.map(function (l) { return { it: CC.ITEMS[l.id], qty: l.qty }; })
        .filter(function (l) { return l.it; })          // an id we no longer sell
        .map(function (l) {
          total += l.it.price * l.qty;
          points += l.it.pts * l.qty;
          return { id: l.it.id, en: l.it.en, qty: l.qty, price: l.it.price, pts: l.it.pts };
        });
      if (!detailed.length) return null;
      var o = {
        id: 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        ref: orderRef(),
        memberId: memberId || null,
        items: detailed,
        total: total,
        points: points,
        mode: mode || 'pickup',
        note: note || '',
        status: 'new',
        placed: Date.now(),
        log: [{ status: 'new', at: Date.now() }]
      };
      orders.unshift(o);
      write(K.orders, orders);

      if (memberId) {
        var m = this.members().filter(function (x) { return x.id === memberId; })[0];
        if (m) {
          var counts = {};
          this.orders().filter(function (x) { return x.memberId === memberId; })
            .forEach(function (x) { x.items.forEach(function (i) { counts[i.id] = (counts[i.id] || 0) + i.qty; }); });
          var fav = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
          this.updateMember(memberId, {
            points: m.points + points,
            lifetime: m.lifetime + points,
            spend: m.spend + total,
            visits: m.visits + 1,
            favourite: fav
          });
        }
      }
      emit();
      return o;
    },
    setStatus: function (orderId, status) {
      var orders = this.orders();
      for (var i = 0; i < orders.length; i++) {
        if (orders[i].id === orderId) {
          orders[i].status = status;
          orders[i].log.push({ status: status, at: Date.now() });
          break;
        }
      }
      write(K.orders, orders);
      emit();
    },
    ordersOf: function (memberId) {
      return this.orders().filter(function (o) { return o.memberId === memberId; });
    },

    // ---- rewards ----------------------------------------------------------
    redeem: function (memberId, rewardId) {
      var m = this.members().filter(function (x) { return x.id === memberId; })[0];
      var rw = CC.REWARDS.filter(function (r) { return r.id === rewardId; })[0];
      if (!m || !rw || m.points < rw.cost) return false;
      var redeemed = m.redeemed.slice();
      redeemed.unshift({ id: rw.id, en: rw.en, cost: rw.cost, at: Date.now(),
                         code: orderRef() });
      this.updateMember(memberId, { points: m.points - rw.cost, redeemed: redeemed });
      return redeemed[0];
    },

    tierOf: function (lifetime) {
      var t = CC.TIERS[0];
      CC.TIERS.forEach(function (x) { if (lifetime >= x.min) t = x; });
      return t;
    },
    nextTier: function (lifetime) {
      return CC.TIERS.filter(function (x) { return x.min > lifetime; })[0] || null;
    },

    reset: function () {
      Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
      Store.seed();
      emit();
    },

    // ---- demo seed --------------------------------------------------------
    seed: function () {
      if (read(K.seeded, false)) return;
      var rnd = mulberry(20260808);
      var names = [
        ['Ali Karimi Azar', '0914 630 6050'], ['Sara Mohammadi', '0912 447 1180'],
        ['Nima Ranjbar', '0935 210 7742'],    ['Elnaz Sadeghi', '0918 330 5521'],
        ['Amir Mousavi', '0914 118 2093'],    ['Parisa Ahmadi', '0933 776 4410'],
        ['Reza Tabrizi', '0921 505 8834'],    ['Mahsa Norouzi', '0917 662 3390'],
        ['Arshak Petrosyan', '0914 903 7712'],['Hoda Rahimi', '0939 284 6650'],
        ['Kian Jafari', '0902 771 3328'],     ['Niloofar Bagheri', '0936 415 9902'],
        ['Sina Ebrahimi', '0919 638 2247'],   ['Yasaman Kazemi', '0911 872 5063'],
        ['Pouya Shirazi', '0937 049 1185'],   ['Termeh Alavi', '0930 556 7724']
      ];
      var ids = Object.keys(CC.ITEMS).filter(function (k) { return CC.ITEMS[k].section !== 'extras'; });
      var members = [], orders = [];
      var DAY = 864e5, now = Date.now();

      names.forEach(function (n, i) {
        members.push({
          id: 'seed-' + i, code: memberCode(rnd), name: n[0], phone: n[1],
          joined: now - Math.floor(rnd() * 150 + 5) * DAY,
          points: 0, lifetime: 0, spend: 0, visits: 0, redeemed: [], favourite: null, note: ''
        });
      });

      // 5–14 weeks of trading history, weighted to recent days
      var STATUSES = ['collected', 'collected', 'collected', 'collected', 'ready', 'preparing', 'new'];
      for (var d = 96; d >= 0; d--) {
        var perDay = 2 + Math.floor(rnd() * (d < 14 ? 6 : 4));
        for (var k = 0; k < perDay; k++) {
          var m = members[Math.floor(rnd() * members.length)];
          if (now - m.joined < d * DAY) continue;
          var nItems = 1 + Math.floor(rnd() * 3);
          var lines = [], total = 0, pts = 0;
          for (var z = 0; z < nItems; z++) {
            var it = CC.ITEMS[ids[Math.floor(rnd() * ids.length)]];
            var qty = 1 + (rnd() > 0.82 ? 1 : 0);
            if (lines.some(function (l) { return l.id === it.id; })) continue;
            lines.push({ id: it.id, en: it.en, qty: qty, price: it.price, pts: it.pts });
            total += it.price * qty; pts += it.pts * qty;
          }
          if (!lines.length) continue;
          var hour = 8 + Math.floor(rnd() * 14);
          var placed = now - d * DAY;
          var ts = new Date(placed);
          ts.setHours(hour, Math.floor(rnd() * 60), 0, 0);
          var when = ts.getTime();
          if (when > now) when = now - Math.floor(rnd() * 36e5);
          var status = d === 0 ? STATUSES[Math.floor(rnd() * STATUSES.length)] : 'collected';
          orders.push({
            id: 'so' + d + '-' + k, ref: orderRef(rnd), memberId: m.id, items: lines,
            total: total, points: pts, mode: rnd() > 0.45 ? 'dine-in' : 'pickup',
            note: '', status: status, placed: when, log: [{ status: 'new', at: when }]
          });
          m.points += pts; m.lifetime += pts; m.spend += total; m.visits += 1;
        }
      }

      // favourites + a couple of redemptions so the economy is not one-sided
      members.forEach(function (m) {
        var counts = {};
        orders.filter(function (o) { return o.memberId === m.id; })
              .forEach(function (o) { o.items.forEach(function (i) { counts[i.id] = (counts[i.id] || 0) + i.qty; }); });
        m.favourite = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
        if (m.lifetime > 900 && rnd() > 0.45) {
          var rw = CC.REWARDS[Math.floor(rnd() * 3)];
          if (m.points >= rw.cost) {
            m.points -= rw.cost;
            m.redeemed.push({ id: rw.id, en: rw.en, cost: rw.cost,
                              at: now - Math.floor(rnd() * 20 + 1) * DAY, code: orderRef(rnd) });
          }
        }
      });

      orders.sort(function (a, b) { return b.placed - a.placed; });
      write(K.members, members);
      write(K.orders, orders);
      write(K.seeded, true);
    }
  };

  CC.Store = Store;
})(window.CC = window.CC || {});
