#!/usr/bin/env python3
"""Build the codeconceptcafe.com upload package.

    python3 build.py            # first — stamps the ?v= hashes
    python3 deploy/package.py   # writes ~/Downloads/codeconceptcafe.zip

Takes the repo (which is also the GitHub Pages staging copy) and produces the
production build. The two differ only in deployment details, never in code:

  * the `noindex` that keeps staging out of search results is dropped
  * canonical / og:url point at the real domain
  * 404.html bounces to an absolute `/#/` since production sits at the root
  * `.htaccess` is added (deploy/htaccess)

Everything is asserted before the zip is written, so a broken package fails
loudly here rather than quietly on the host.
"""
import os
import pathlib
import re
import shutil
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOMAIN = 'https://codeconceptcafe.com'
OUT = pathlib.Path.home() / 'Downloads' / 'codeconceptcafe.zip'

SHIP_FILES = ['index.html', '404.html', 'manifest.webmanifest', 'sw.js']
SHIP_DIRS = ['assets', 'icons']
# never let these reach a public server
FORBIDDEN = ['ali_karimiazar']


def build(stage: pathlib.Path) -> str:
    for f in SHIP_FILES:
        shutil.copy2(ROOT / f, stage / f)
    for d in SHIP_DIRS:
        shutil.copytree(ROOT / d, stage / d, ignore=shutil.ignore_patterns('.DS_Store'))

    # -- index.html: this is the real domain, not staging
    p = stage / 'index.html'
    s = p.read_text()
    s = re.sub(r'<!-- Unapproved client preview.*?-->\n<meta name="robots"[^>]*>\n', '', s, flags=re.S)
    if 'rel="canonical"' not in s:
        s = s.replace(
            '<meta property="og:type" content="website">',
            f'<link rel="canonical" href="{DOMAIN}/">\n'
            '<meta property="og:type" content="website">\n'
            f'<meta property="og:url" content="{DOMAIN}/">')
    s = s.replace('content="assets/img/space.webp"', f'content="{DOMAIN}/assets/img/space.webp"')
    p.write_text(s)

    # -- 404.html: production is at the domain root
    p = stage / '404.html'
    s = p.read_text()
    s = re.sub(
        r"  // GitHub Pages serves.*?location\.replace\(base \+ '#/'\);",
        "  // Apache serves this for unknown paths (see .htaccess). The site lives at\n"
        "  // the domain root, so always bounce to the router there.\n"
        "  location.replace('/#/');", s, flags=re.S)
    p.write_text(s)

    shutil.copy2(ROOT / 'deploy' / 'htaccess', stage / '.htaccess')

    # ---- checks -------------------------------------------------------------
    idx = (stage / 'index.html').read_text()
    sw = (stage / 'sw.js').read_text()

    assert 'noindex' not in idx, 'staging noindex survived into the production build'
    assert f'{DOMAIN}/' in idx, 'canonical URL missing'
    assert 'scrollRestoration' in idx, 'scroll-restoration guard missing'
    assert "location.replace('/#/')" in (stage / '404.html').read_text(), '404 bounce not rewritten'

    versions = set(re.findall(r'\?v=([a-f0-9]{8})', idx))
    m = re.search(r"VERSION = 'cc-([a-f0-9]{8})'", sw)
    assert m, 'service worker has no version'
    assert versions == {m.group(1)}, f'hash drift: html {versions} vs sw {m.group(1)} — run build.py'

    for ref in re.findall(r"'\./([^']+?)(?:\?v=[a-f0-9]{8})?'", sw):
        assert not ref or (stage / ref).exists(), f'service worker precaches a missing file: {ref}'
    for ref in re.findall(r'(?:href|src)="(assets/[^"?]+|icons/[^"?]+|manifest\.webmanifest)', idx):
        assert (stage / ref).exists(), f'index.html references a missing file: {ref}'

    blob = idx + sw + (stage / 'assets/css/app.css').read_text()
    for js in sorted((stage / 'assets').rglob('*.js')):
        blob += js.read_text(errors='ignore')
    for bad in FORBIDDEN:
        assert bad not in blob, f'{bad!r} must not ship'
    assert re.search(r"PASS_HASH\s*=\s*'[0-9a-f]{16}'", blob), 'staff passcode should ship only as a hash'

    return m.group(1)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        stage = pathlib.Path(tmp) / 'site'
        stage.mkdir()
        version = build(stage)

        OUT.parent.mkdir(parents=True, exist_ok=True)
        if OUT.exists():
            OUT.unlink()
        with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, dirs, files in os.walk(stage):
                dirs[:] = [d for d in dirs if d != '__MACOSX']
                for f in sorted(files):
                    if f == '.DS_Store':
                        continue
                    full = pathlib.Path(root) / f
                    z.write(full, full.relative_to(stage))

        count = len(zipfile.ZipFile(OUT).namelist())
        print(f'build {version}')
        print(f'{OUT} — {count} files, {OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    sys.exit(main())
