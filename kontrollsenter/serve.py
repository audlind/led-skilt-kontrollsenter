"""Starter kontrollsenteret på http://localhost:8765 (uten mellomlagring) og åpner Chrome eller Edge.

Web Serial krever Chrome eller Edge og en sikker kontekst (localhost er det). Kjør:  python serve.py
"""
import http.server
import os
import subprocess
import sys
import threading
import webbrowser

PORT = 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def open_browser(url):
    for path in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                 r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                 r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                 r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"):
        if os.path.exists(path):
            subprocess.Popen([path, url])
            return
    webbrowser.open(url)


class Server(http.server.ThreadingHTTPServer):
    # Flertrådet: Chrome åpner flere parallelle (og noen ganger tomme) forbindelser. En enkelttrådet server henger på dem,
    # og da blir siden liggende halvlastet uten at skriptene kjører.
    daemon_threads = True
    allow_reuse_address = True


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
        if "--no-browser" not in sys.argv:
            threading.Timer(0.6, open_browser, args=(url,)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
