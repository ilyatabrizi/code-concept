#!/usr/bin/env python3
"""Local preview server for the Code Concept site.

    python3 serve.py            # http://localhost:8061

Sends no-store on everything so the browser always shows what is on disk —
GitHub Pages will do its own sensible caching in production.
"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8061
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".js": "text/javascript",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "304" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


with Server(("", PORT), functools.partial(Handler, directory=ROOT)) as httpd:
    print(f"Code Concept preview  →  http://localhost:{PORT}")
    httpd.serve_forever()
