#!/usr/bin/env python3
"""Stamp a content hash onto the CSS/JS URLs so a redeploy never serves stale
assets, and keep the service worker's cache name in step.

    python3 build.py

Run it after editing anything in assets/. Safe to run repeatedly — the hash only
moves when the file contents actually change.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent

ASSETS = [
    "assets/css/app.css",
    "assets/js/qr.js",
    "assets/js/api.js",
    "assets/js/data.js",
    "assets/js/store.js",
    "assets/js/ui.js",
    "assets/js/views.js",
    "assets/js/crm.js",
    "assets/js/app.js",
]


def content_hash() -> str:
    h = hashlib.sha1()
    for rel in ASSETS:
        p = ROOT / rel
        if not p.exists():
            sys.exit(f"missing asset: {rel}")
        h.update(rel.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:8]


def stamp(text: str, version: str) -> str:
    """Rewrite `path?v=xxx` (or bare `path`) for every tracked asset."""
    for rel in ASSETS:
        text = re.sub(
            re.escape(rel) + r"(\?v=[0-9a-f]+)?",
            rel + "?v=" + version,
            text,
        )
    return text


def main() -> None:
    version = content_hash()

    index = ROOT / "index.html"
    index.write_text(stamp(index.read_text(), version))

    sw = ROOT / "sw.js"
    text = sw.read_text()
    text = re.sub(r"const VERSION = '[^']*'", f"const VERSION = 'cc-{version}'", text)
    text = stamp(text, version)
    sw.write_text(text)

    print(f"stamped v{version}")
    print(f"  index.html   {len(index.read_text())} bytes")
    print(f"  sw.js        cache name cc-{version}")


if __name__ == "__main__":
    main()
