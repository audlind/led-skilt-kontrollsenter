"""Enkel kontakttest mot skiltet: sender <BA> (lysstyrke 100 %) tre ganger og skriver ut svarene."""
import time

import serial

from amsign import Sign

ports = [p.device for p in serial.tools.list_ports.comports()] if hasattr(serial, "tools") else []
try:
    from serial.tools import list_ports
    ports = [f"{p.device} ({p.description})" for p in list_ports.comports()]
except Exception:
    pass
print("serielle porter:", ports)
s = Sign()
for i in range(3):
    print(f"forsøk {i + 1}:", s.send("<BA>", show=False))
    time.sleep(0.3)
s.close()
