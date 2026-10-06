"""Starter kontrollsenteret på http://localhost:8765 og åpner Chrome eller Edge.

Web Serial krever Chrome eller Edge og en sikker kontekst (localhost er det). Kjør:  python serve.py

Serveren bruker nøyaktig de samme HTTP-headerne som Firebase Hosting (leses fra ../firebase.json), slik at du
oppdager problemer med sikkerhetspolicyen (CSP) lokalt før du ruller ut. Uten firebase.json slås mellomlagring av.
"""
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import webbrowser

PORT = 8765
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)


def glob_to_regex(g):
    """Firebase-glob til regex: ** (alt, også /), * (alt unntatt /), @(a|b) (alternativer)."""
    out, i = "", 0
    while i < len(g):
        if g.startswith("**/", i):
            out += "(?:.*/)?"; i += 3
        elif g.startswith("**", i):
            out += ".*"; i += 2
        elif g[i] == "*":
            out += "[^/]*"; i += 1
        elif g.startswith("@(", i):
            j = g.index(")", i); out += "(?:" + g[i + 2:j] + ")"; i = j + 1
        else:
            out += re.escape(g[i]); i += 1
    return re.compile("^" + out + "$")


def load_header_rules():
    path = os.path.join(os.path.dirname(HERE), "firebase.json")
    try:
        cfg = json.load(open(path, encoding="utf-8"))
        return [(glob_to_regex(r["source"]), r["headers"]) for r in cfg["hosting"].get("headers", [])]
    except (OSError, KeyError, ValueError):
        return None


RULES = load_header_rules()


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if RULES is None:
            self.send_header("Cache-Control", "no-store")
        else:
            path = self.path.split("?")[0]
            # Firebase matcher mot URL-stien. Forsiden "/" serveres som index.html, men regelen "/" gjelder URL-en.
            candidates = {path, path.lstrip("/")}
            if path.endswith("/"):
                candidates.add(path.lstrip("/") + "index.html")
            sent = {}                                    # senere regler overstyrer tidligere for samme header
            for rx, headers in RULES:
                if any(rx.match(c) for c in candidates):
                    for h in headers:
                        sent[h["key"]] = h["value"]
            for key, value in sent.items():
                self.send_header(key, value)
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(http.server.ThreadingHTTPServer):
    # Flertrådet: Chrome åpner flere parallelle (og noen ganger tomme) forbindelser. En enkelttrådet server henger på dem,
    # og da blir siden liggende halvlastet uten at skriptene kjører.
    daemon_threads = True
    allow_reuse_address = True


def open_browser(url):
    for path in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                 r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                 r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                 r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"):
        if os.path.exists(path):
            subprocess.Popen([path, url])
            return
    webbrowser.open(url)


def bind():
    """Prøver port 8765 og de ti neste (hvis en gammel serverprosess fortsatt holder porten)."""
    for port in range(PORT, PORT + 11):
        try:
            return Server(("127.0.0.1", port), Handler), port
        except OSError:
            continue
    raise SystemExit("Fant ingen ledig port mellom 8765 og 8775. Lukk gamle serverfonster og prøv igjen.")


if __name__ == "__main__":
    httpd, port = bind()
    with httpd:
        url = f"http://localhost:{port}/index.html"
        print(f"Kontrollsenter: {url}   (Ctrl+C for å stoppe)")
        print("Headere:", "fra ../firebase.json (som Firebase Hosting)" if RULES is not None else "ingen mellomlagring")
        if "--no-browser" not in sys.argv:
            threading.Timer(0.6, open_browser, args=(url,)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
