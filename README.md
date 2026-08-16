# Code Concept Community — website preview

A monochrome, installable site for **Code Concept Community**, a specialty coffee
shop in Tabriz. Built by Alpha Agency as a preview: no domain, no host account,
nothing live. Drop the folder on GitHub Pages and it runs.

```
Code. Create. Connect.
```

## What it is

A single-page app in plain HTML, CSS and JavaScript. No build step, no
framework, no dependencies. Everything is static, so any host that serves files
will do — GitHub Pages, Netlify, a folder on LimooHost.

| Route | What's there |
|---|---|
| `#/` | Home — hero, ethos, signature drinks, the room, points |
| `#/menu` | Full bilingual menu, searchable, filterable by section |
| `#/order` | Bag, quantities, pickup/dine-in, live order status |
| `#/profile` | Member card with a scannable QR, points, tier, rewards, history |
| `#/crm` | Staff console — passcode held by Code Concept, not stored in this repo |

## Points

Every item on the menu carries its own point value — 12 to 53, deliberately
uneven so it reads as a real scheme rather than a formula. Points are fixed per
item in `assets/js/data.js`; edit the `pts` field to retune any of them.

Ordering through the site credits the points automatically. Four tiers
(Guest → Member → Insider → Core) unlock at 0 / 400 / 1200 / 3000 lifetime
points, and six rewards can be redeemed from 300 points up.

## The member card

Each member gets a code like `CC-7F3K92` and a **real QR code** rendered on
their card — byte mode, error-correction level M, generated in the browser by
`assets/js/qr.js` (no library, no network call). Staff scan it or type the code
into the CRM's lookup box to pull up the member.

## Data

There is no backend. Members, orders and points live in the browser's
`localStorage` under the `cc.v1.*` keys. On first visit the app seeds itself
with sixteen members and roughly three months of trading history so the CRM has
something to show in a demo. **Profile → Reset preview data** rebuilds it.

That means the demo is per-device: what you order on your phone will not appear
in the CRM on a laptop. For a live shop this layer would move to a small API —
the storage calls are all funnelled through `assets/js/store.js`, so that swap
touches one file.

## Running it locally

```bash
python3 serve.py
```

Then open <http://localhost:8061>. Add `?nosw` to the URL to switch off the
service worker while editing — otherwise the offline cache will keep serving
you the previous version.

## Publishing to GitHub Pages

```bash
git remote add origin git@github.com:<user>/code-concept.git && git push -u origin main
```

Then in the repository: **Settings → Pages → Source: deploy from branch `main`,
folder `/ (root)`**. The site appears at
`https://<user>.github.io/code-concept/` within a minute or two.

Every path in the project is relative and routing is hash-based, so it works
from a subfolder without configuration. `.nojekyll` stops GitHub from
processing the folder; `404.html` bounces stray paths back into the app.

## After changing anything in `assets/`

```bash
python3 build.py
```

This stamps a content hash onto the CSS and JS URLs and bumps the service
worker's cache name, so returning visitors get the new files instead of a stale
cache. Skipping it is the one way to ship an update nobody sees.

## Add to home screen

The site is a PWA. On iPhone: Share → Add to Home Screen. It installs with the
Code Concept mark as its icon, opens full-screen with a black splash, and works
offline — the menu, the member card and the points balance are all readable
with no signal.

Icons and splash screens are in `icons/`, generated from the supplied logo.

## Layout

```
index.html              app shell — the only HTML page
manifest.webmanifest    PWA manifest
sw.js                   service worker (offline cache)
build.py                asset versioning — run after every edit
serve.py                local preview server
404.html                GitHub Pages fallback
assets/
  css/app.css           the whole design system
  js/data.js            brand details, menu, points, tiers, rewards
  js/store.js           localStorage: members, orders, points, demo seed
  js/qr.js              QR encoder
  js/ui.js              escaping, formatting, icons, toasts, sheets
  js/views.js           home, menu, bag, profile
  js/crm.js             staff dashboard
  js/app.js             router, tab bar, scroll chrome, PWA wiring
  img/                  photography, converted to true greyscale
  fonts/                Michroma, Saira
icons/                  app icons + iOS splash screens
```

## Design notes

Black, white and the greys between — no other colour anywhere, including the
photography, which is converted to true greyscale at build time rather than
filtered in CSS.

**Michroma** carries the small tracked labels; its square counters and flat
terminals are the closest free match to the logo's lettering. **Saira** handles
everything else — a subtly squared grotesque that sits with the mark instead of
fighting it. The site is English throughout, matching Code Concept's own signage,
cup labels and printed card, so no Persian face is shipped. A Persian/RTL edition
would need IRANYekanX FaNum added back.

The navigation is an iOS-style glass pill: real `backdrop-filter` blur and
saturation, a hairline border, an inner highlight, and a sliding indicator that
springs between tabs. It sits above the home indicator via
`env(safe-area-inset-bottom)`.

## Known limits of the preview

- No payment step. "Place order" records the order and credits points; it takes
  no money.
- Data is per-browser, as described above.
- The staff passcode is held by Code Concept and is not written down in this
  repo — only a hash of it is. Four digits is a soft gate against the curious,
  not security: everything runs in the browser, so anyone determined can get
  past it. Real protection needs a server, which is the natural next step when
  the till and the phones need to share data anyway.
- Menu items and prices were transcribed from the photograph of the printed
  card. The legible rows are accurate; a few items and prices in the cut-off
  sections were filled in plausibly and should be checked before this goes
  anywhere real. Prices are in thousand Toman, matching the card's `t/`.

---

Alpha Agency · Dubai
