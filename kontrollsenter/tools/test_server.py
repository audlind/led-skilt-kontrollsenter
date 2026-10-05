"""Beviser feilen: en enkelttrådet server henger når en tom forbindelse (Chromes forhåndstilkobling) kommer først.
Kjører samme test mot den gamle (TCPServer) og den nye (ThreadingHTTPServer) serveren."""
import http.server
import os
import socket
import socketserver
import threading
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def run(server_cls, port):
    srv = server_cls(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    idle = socket.create_connection(("127.0.0.1", port))          # tom forbindelse, sender ingenting
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/js/protocol.js", timeout=3).read()
        result = "OK (svarte)"
    except Exception as e:
        result = f"HENGER ({type(e).__name__})"
    idle.close()
    srv.shutdown()
    srv.server_close()
    return result


class Old(socketserver.TCPServer):
    allow_reuse_address = True


class New(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


print("Gammel server (TCPServer, én tråd):      ", run(Old, 8797))
print("Ny server (ThreadingHTTPServer):         ", run(New, 8798))
