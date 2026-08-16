/* data.js — brand config, menu and rewards.
   Menu transcribed from Code Concept's printed card (Aug 2026). Prices are in
   thousand Toman, as printed. Points are fixed per item and deliberately uneven.

   Espresso and Americano are sold at three bean grades. Each grade is expanded
   into its own entry in CC.ITEMS below, so the bag, till, points, sold-out
   switches and exports all treat it as an ordinary item; only the menu view
   groups them back into one row. */
(function (CC) {
  'use strict';

  CC.BRAND = {
    name: 'Code Concept',
    full: 'Code Concept Community',
    handle: 'codeconceptcommunity',
    tagline: 'Code. Create. Connect.',
    promise: 'Made to match you.',
    city: 'Tabriz, Iran',
    address: 'Tabriz · East Azerbaijan',
    phone: '0914 630 6050',
    phoneTel: '+989146306050',
    instagram: 'https://instagram.com/codeconceptcommunity',
    currency: 't',
    hours: [
      ['Saturday – Wednesday', '08:00 — 23:00'],
      ['Thursday', '08:00 — 24:00'],
      ['Friday', '10:00 — 23:00']
    ]
  };

  CC.MENU = [
    {
      id: 'coffee', label: 'Coffee-Based',
      note: 'Choose your bean',
      items: [
        { id: 'esp-espresso', en: 'Espresso', variants: [
            { id: 'blend',     label: 'Blend',     price: 260, pts: 33 },
            { id: 'arabica',   label: 'Arabica',   price: 290, pts: 38 },
            { id: 'specialty', label: 'Specialty', price: 360, pts: 37 }
          ] },
        { id: 'esp-americano', en: 'Americano', variants: [
            { id: 'blend',     label: 'Blend',     price: 260, pts: 13 },
            { id: 'arabica',   label: 'Arabica',   price: 290, pts: 40 },
            { id: 'specialty', label: 'Specialty', price: 360, pts: 48 }
          ] }
      ]
    },
    {
      id: 'milk', label: '+ Milk',
      note: 'Espresso and steamed milk',
      items: [
        { id: 'milk-latte',              en: 'Latte',                      price: 300, pts: 35 },
        { id: 'milk-cortado',            en: 'Cortado Latte',              price: 300, pts: 16 },
        { id: 'milk-caramel-macchiato',  en: 'Caramel Macchiato',          price: 350, pts: 38 },
        { id: 'milk-mocha',              en: 'Mocha',                      price: 350, pts: 42 },
        { id: 'milk-flavored-latte',     en: 'Flavored Latte + Plant Milk',
          desc: 'Coconut, almond or hazelnut',                             price: 350, pts: 21 },
        { id: 'milk-affogato',           en: 'Affogato',
          desc: 'Vanilla or tiramisu',                                     price: 350, pts: 22 }
      ]
    },
    {
      id: 'brewed', label: 'Brewed Coffee',
      note: 'Slow extraction',
      items: [
        { id: 'brew-pourover', en: 'Pour-Over',      price: 360, pts: 27 },
        { id: 'brew-coldbrew', en: 'Cold Brew',      price: 320, pts: 16 },
        { id: 'brew-turkish',  en: 'Turkish Coffee', price: 260, pts: 16 }
      ]
    },
    {
      id: 'coffee-mocktails', label: 'Coffee Mocktails',
      note: 'Long, cold, low sugar',
      items: [
        { id: 'cmock-tonic-espresso',    en: 'Tonic Espresso',      price: 320, pts: 46 },
        { id: 'cmock-orange-coldbrew',   en: 'Orange Cold Brew',    price: 360, pts: 25 },
        { id: 'cmock-barberry-coldbrew', en: 'Barberry Cold Brew',  price: 360, pts: 41 }
      ]
    },
    {
      id: 'matcha', label: 'Matcha-Based',
      note: 'Ceremonial grade',
      items: [
        { id: 'mat-classic',  en: 'Classic Matcha',  price: 300, pts: 35 },
        { id: 'mat-flavored', en: 'Flavored Matcha',
          desc: 'Vanilla, coconut, strawberry or blueberry', price: 360, pts: 36 }
      ]
    },
    {
      id: 'autumn', label: 'Autumn Vibes',
      note: 'Warm and slow',
      items: [
        { id: 'aut-hot-chocolate', en: 'Hot Chocolate', price: 280, pts: 27 },
        { id: 'aut-masala',        en: 'Masala',        price: 280, pts: 25 }
      ]
    },
    {
      id: 'herbal', label: 'Herbal & Tea',
      note: 'Pot for one',
      items: [
        { id: 'tea-black',      en: 'Black Tea',      price: 210, pts: 21 },
        { id: 'tea-green-mint', en: 'Green Mint Tea', price: 280, pts: 42 },
        { id: 'tea-apple',      en: 'Apple Tea',      price: 280, pts: 42 },
        { id: 'tea-relaxing',   en: 'Relaxing Tea',   price: 280, pts: 38 }
      ]
    },
    {
      id: 'summer', label: 'Summer Vibes',
      note: 'Over ice',
      items: [
        { id: 'sum-iced-tea', en: 'Iced Tea',
          desc: 'Peach, apple-cinnamon or berry', price: 320, pts: 27 }
      ]
    },
    {
      id: 'mocktails', label: 'Mocktails',
      note: 'Shaken to order',
      items: [
        { id: 'mock-lemonade',   en: 'Lemonade',
          desc: 'Omani lime, lemon, Jermuk',            price: 320, pts: 35 },
        { id: 'mock-mojito',     en: 'Mojito',
          desc: 'Lemon, pennyroyal mint, Jermuk',       price: 320, pts: 17 },
        { id: 'mock-churchill',  en: 'Churchill',
          desc: 'Lemon, salt, Jermuk',                  price: 220, pts: 20 },
        { id: 'mock-strawberry', en: 'Strawberry',
          desc: 'Strawberry, pomegranate, barberry',    price: 340, pts: 47 },
        { id: 'mock-apple',      en: 'Apple',
          desc: 'Apple, pineapple, cinnamon',           price: 340, pts: 29 }
      ]
    },
    {
      id: 'smoothies', label: 'Smoothies',
      note: 'Whole fruit, no syrup',
      items: [
        { id: 'smo-green-apple', en: 'Green Apple',
          desc: 'Green apple, spinach, lemon, mint',        price: 380, pts: 19 },
        // the card lists both a Berry smoothie and a Berry milkshake; the section
        // tells them apart on paper, nothing does in a bag or on a receipt
        { id: 'smo-berry',       en: 'Berry Smoothie',
          desc: 'Strawberry, mulberry, cornelian cherry',   price: 380, pts: 22 },
        { id: 'smo-mango',       en: 'Mango',
          desc: 'Mango, coconut, passion fruit',            price: 380, pts: 53 }
      ]
    },
    {
      id: 'milkshakes', label: 'Milkshakes',
      note: 'Thick, on vanilla ice cream',
      items: [
        { id: 'shake-peanut',         en: 'Peanut',
          desc: 'Vanilla ice cream, peanut butter, pennyroyal',        price: 380, pts: 22 },
        { id: 'shake-berry',          en: 'Berry Milkshake',
          desc: 'Vanilla ice cream, berry',                            price: 380, pts: 18 },
        { id: 'shake-choco-hazelnut', en: 'Choco-Hazelnut',
          desc: 'Vanilla ice cream, hazelnut cream, chocolate',        price: 380, pts: 55 },
        { id: 'shake-rollup',         en: 'Roll-Up',
          desc: 'Fruit-leather ice cream, barberry, cornelian cherry', price: 380, pts: 30 }
      ]
    }
  ];

  CC.EXTRAS = [
    { id: 'add-arabica', en: 'Arabica coffee',    price: 30, pts: 4 },
    { id: 'add-syrup',   en: 'Syrup',             price: 50, pts: 4 },
    { id: 'add-lactose', en: 'Lactose-free milk', price: 50, pts: 4 }
  ];

  CC.TIERS = [
    { id: 'guest',   name: 'Guest',   min: 0,    perk: 'Welcome. Order once to start collecting.' },
    { id: 'member',  name: 'Member',  min: 400,  perk: 'Free syrup shot on any drink.' },
    { id: 'insider', name: 'Insider', min: 1200, perk: '10% off every brewed coffee.' },
    { id: 'core',    name: 'Core',    min: 3000, perk: 'One free drink each week + first seat at events.' }
  ];

  CC.REWARDS = [
    { id: 'rw-espresso',  cost: 300,  en: 'Espresso, on us' },
    { id: 'rw-syrup',     cost: 450,  en: 'Any syrup + plant milk' },
    { id: 'rw-filter',    cost: 800,  en: 'Free pour-over' },
    { id: 'rw-matcha',    cost: 1100, en: 'Any matcha, free' },
    { id: 'rw-signature', cost: 1600, en: 'Signature latte + cake' },
    { id: 'rw-beans',     cost: 2600, en: '250g house beans' }
  ];

  /* Flat index. A variant becomes a first-class item with a composed id, so the
     rest of the app never needs to know variants exist. */
  CC.ITEMS = {};
  function register(it, sectionId) {
    it.section = sectionId;
    CC.ITEMS[it.id] = it;
  }
  CC.MENU.forEach(function (sec) {
    sec.items.forEach(function (it) {
      if (!it.variants) { register(it, sec.id); return; }
      it.variants.forEach(function (v) {
        register({
          id: it.id + ':' + v.id,
          en: it.en + ' · ' + v.label,
          shortEn: it.en,
          variantOf: it.id,
          variantLabel: v.label,
          desc: it.desc,
          price: v.price,
          pts: v.pts
        }, sec.id);
      });
    });
  });
  CC.EXTRAS.forEach(function (it) { register(it, 'extras'); });

  /** Every orderable entry in a section, with variants expanded. Anything that
      needs real items (the till, the sold-out switches) must use this rather
      than sec.items, whose variant entries are groupings, not orderable ids. */
  CC.sectionItems = function (sec) {
    var out = [];
    (sec.items || []).forEach(function (it) {
      if (!it.variants) { out.push(CC.ITEMS[it.id]); return; }
      it.variants.forEach(function (v) { out.push(CC.ITEMS[it.id + ':' + v.id]); });
    });
    return out.filter(Boolean);
  };

  CC.SIGNATURES = ['cmock-barberry-coldbrew', 'mat-flavored', 'shake-choco-hazelnut'];

})(window.CC = window.CC || {});
