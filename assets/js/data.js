/* data.js — brand config, menu and rewards.
   Menu transcribed from Code Concept's printed card; points are fixed per item. */
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
    email: 'ali_karimiazar@yahoo.com',
    instagram: 'https://instagram.com/codeconceptcommunity',
    currency: 't',                       // thousand Toman, as printed on the card
    hours: [
      ['Saturday – Wednesday', '08:00 — 23:00'],
      ['Thursday', '08:00 — 24:00'],
      ['Friday', '10:00 — 23:00']
    ]
  };

  // Points are deliberately uneven — each drink carries its own number.
  CC.MENU = [
    {
      id: 'espresso', label: 'Espresso Bar', fa: 'اسپرسو بار',
      note: 'House blend, 18g in · 36g out',
      items: [
        { id: 'esp-espresso',          en: 'Espresso',              fa: 'اسپرسو',                          price: 220, pts: 29 },
        { id: 'esp-double',            en: 'Double Espresso',       fa: 'دابل اسپرسو',  price: 260, pts: 16 },
        { id: 'esp-americano',         en: 'Americano',             fa: 'آمریکانو',              price: 260, pts: 19 },
        { id: 'esp-cortado',           en: 'Cortado',               fa: 'کورتادو',                    price: 300, pts: 34 },
        { id: 'esp-cappuccino',        en: 'Cappuccino',            fa: 'کاپوچینو',              price: 300, pts: 42 },
        { id: 'esp-latte',             en: 'Latte',                 fa: 'لاته',                                      price: 300, pts: 39 },
        { id: 'esp-caramel-macchiato', en: 'Caramel Macchiato',     fa: 'کارامل ماکیاتو', price: 300, pts: 20 },
        { id: 'esp-mocha',             en: 'Mocha',                 fa: 'موکا',                                      price: 350, pts: 18 },
        { id: 'esp-flavored-latte',    en: 'Flavored Latte + Plant Milk', fa: 'لاته + شیر گیاهی نارگیل/بادام/فندق', price: 350, pts: 44 },
        { id: 'esp-affogato',          en: 'Affogato · Vanilla or Tiramisu', fa: 'آفوگاتو وانیل/تیرامیسو', price: 350, pts: 49 },
        { id: 'esp-arabica',           en: 'Arabica Coffee',        fa: 'قهوه عربیکا',  price: 350, pts: 20 }
      ]
    },
    {
      id: 'brewed', label: 'Brewed Coffee', fa: 'دم‌آوری',
      note: 'Single origin, rotating',
      items: [
        { id: 'brew-v60',      en: 'Pour Over · V60', fa: 'قهوه دمی وی ۶۰', price: 320, pts: 25 },
        { id: 'brew-chemex',   en: 'Chemex',               fa: 'کمکس',                                             price: 340, pts: 32 },
        { id: 'brew-coldbrew', en: 'Cold Brew',            fa: 'کلدبرو',                                 price: 300, pts: 30 },
        { id: 'brew-turkish',  en: 'Turkish Coffee',       fa: 'قهوه ترک',                          price: 260, pts: 14 }
      ]
    },
    {
      id: 'mocktails', label: 'Coffee Mocktails', fa: 'ماکتیل قهوه',
      note: 'Long, cold, low sugar',
      items: [
        { id: 'mock-espresso-tonic',  en: 'Espresso Tonic',   fa: 'اسپرسو تونیک',              price: 340, pts: 30 },
        { id: 'mock-orange-coldbrew', en: 'Orange Cold Brew', fa: 'کلدبرو پرتقال',        price: 360, pts: 39 },
        { id: 'mock-berry-coldbrew',  en: 'Berry Cold Brew',  fa: 'کلدبرو بری',                          price: 360, pts: 52 }
      ]
    },
    {
      id: 'matcha', label: 'Matcha Bar', fa: 'ماچا بار',
      note: 'Ceremonial grade',
      items: [
        { id: 'mat-hot-matcha',   en: 'Hot Matcha Latte',      fa: 'ماچا لاته گرم',            price: 340, pts: 35 },
        { id: 'mat-iced-matcha',  en: 'Iced Matcha',           fa: 'آیس ماچا',                                    price: 360, pts: 47 },
        { id: 'mat-matcha-plant', en: 'Matcha + Plant Milk',   fa: 'ماچا با شیر گیاهی', price: 390, pts: 53 }
      ]
    },
    {
      id: 'autumn', label: 'Autumn Vibes', fa: 'حال و هوای پاییز',
      note: 'Warm and slow',
      items: [
        { id: 'aut-hot-chocolate', en: 'Hot Chocolate', fa: 'هات چاکلت',              price: 300, pts: 20 },
        { id: 'aut-masala',        en: 'Masala Chai',   fa: 'چای ماسالا',        price: 280, pts: 27 }
      ]
    },
    {
      id: 'tea', label: 'Herbal & Tea', fa: 'دمنوش و چای',
      note: 'Pot for one',
      items: [
        { id: 'tea-black',  en: 'Black Tea',      fa: 'چای سیاه',        price: 150, pts: 18 },
        { id: 'tea-mint',   en: 'Fresh Mint Tea', fa: 'چای نعنا',        price: 170, pts: 14 },
        { id: 'tea-apple',  en: 'Apple Tea',      fa: 'چای سیب',              price: 170, pts: 23 },
        { id: 'tea-ginger', en: 'Ginger Tea',     fa: 'چای زنجبیل', price: 190, pts: 12 }
      ]
    },
    {
      id: 'fresh', label: 'Fresh Press', fa: 'آبمیوه تازه',
      note: 'Fresh press · soft smile',
      items: [
        { id: 'fresh-green',    en: 'Green Juice',    fa: 'آب سبزیجات', price: 320, pts: 16 },
        { id: 'fresh-lemonade', en: 'Classic Lemonade', fa: 'لیموناد',            price: 280, pts: 36 },
        { id: 'fresh-mojito',   en: 'Virgin Mojito',  fa: 'موخیتو',                    price: 300, pts: 41 }
      ]
    }
  ];

  CC.EXTRAS = [
    { id: 'add-syrup',   en: 'Syrup shot',        fa: 'سیروپ',                                      price: 50, pts: 5 },
    { id: 'add-lactose', en: 'Lactose-free milk', fa: 'شیر بدون لاکتوز', price: 50, pts: 5 }
  ];

  CC.TIERS = [
    { id: 'guest',   name: 'Guest',   min: 0,    perk: 'Welcome. Order once to start collecting.' },
    { id: 'member',  name: 'Member',  min: 400,  perk: 'Free syrup shot on any drink.' },
    { id: 'insider', name: 'Insider', min: 1200, perk: '10% off every brewed coffee.' },
    { id: 'core',    name: 'Core',    min: 3000, perk: 'One free drink each week + first seat at events.' }
  ];

  CC.REWARDS = [
    { id: 'rw-espresso', cost: 300,  en: 'Espresso, on us',        fa: 'یک اسپرسو مهمان ما' },
    { id: 'rw-syrup',    cost: 450,  en: 'Any syrup + plant milk', fa: 'سیروپ و شیر گیاهی رایگان' },
    { id: 'rw-filter',   cost: 800,  en: 'Free pour over V60',     fa: 'قهوه دمی رایگان' },
    { id: 'rw-matcha',   cost: 1100, en: 'Any matcha, free',       fa: 'هر ماچایی رایگان' },
    { id: 'rw-signature',cost: 1600, en: 'Signature latte + cake', fa: 'لاته ویژه به همراه کیک' },
    { id: 'rw-beans',    cost: 2600, en: '250g house beans',       fa: '۲۵۰ گرم دانه قهوه' }
  ];

  // flat index for lookups
  CC.ITEMS = {};
  CC.MENU.forEach(function (sec) {
    sec.items.forEach(function (it) { it.section = sec.id; CC.ITEMS[it.id] = it; });
  });
  CC.EXTRAS.forEach(function (it) { it.section = 'extras'; CC.ITEMS[it.id] = it; });

  CC.SIGNATURES = ['esp-flavored-latte', 'mat-iced-matcha', 'mock-espresso-tonic'];

})(window.CC = window.CC || {});
