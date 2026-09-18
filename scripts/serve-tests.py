#!/usr/bin/env python3
"""Local-only fixture server. Never included in the extension manifest."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path != "/tests/popup.html":
            return super().do_GET()
        # Use production markup/scripts, with synthetic Chrome storage inserted
        # before them. The extension's actual popup never includes these fixtures.
        html = (ROOT / "popup/popup.html").read_text()
        html = html.replace("<head>", '<head><base href="/popup/">'
                            '<script src="/tests/popup.storage.js"></script>', 1)
        html = html.replace("</head>", '<script src="/tests/popup.browser.js" defer></script></head>', 1)
        data = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print("Gmail Pro synthetic tests: http://127.0.0.1:8765 (Ctrl+C to stop)", flush=True)
    with ThreadingHTTPServer(("127.0.0.1", 8765), Handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
