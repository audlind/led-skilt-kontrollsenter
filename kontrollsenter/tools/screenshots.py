"""Lager skjermbildene i docs/bilder/skjermbilder/ fra selve appen (i simulatormodus).

Krever:  pip install playwright   og Chrome (brukes via Playwright, ingen nedlasting av nettleser)
Bruk:    start serveren først:  python kontrollsenter/serve.py --no-browser
         så:                    python kontrollsenter/tools/screenshots.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "bilder", "skjermbilder")
URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765/index.html"
os.makedirs(OUT, exist_ok=True)

# Nummererte markører til det annoterte oversiktsbildet: (CSS-velger, nummer, plassering)
CALLOUTS = [
    ("header.top", 1, "left"),
    ("#signPanel", 2, "left"),
    ("#tabs", 3, "left"),
    ("#tab-tekst", 4, "left"),
    ("#meters", 5, "left"),
    ("#log", 6, "left"),
    ("footer.bottom", 7, "left"),
]


def boot(page, width=1500, height=940):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(URL)
    page.wait_for_function("window.App && App.booted")
    page.wait_for_timeout(400)


def start_sim(page):
    page.click("#btnSim")
    page.wait_for_function("App.link && App.link.connected")


def wait_idle(page, ms=1800):
    page.wait_for_timeout(ms)


def shot(page, name, selector=None, clip=None):
    page.evaluate("document.querySelectorAll('.toast').forEach(e => e.remove())")   # ingen flyktige meldinger i bildene
    page.wait_for_timeout(100)
    path = os.path.join(OUT, name)
    if selector:
        page.locator(selector).screenshot(path=path)
    else:
        page.screenshot(path=path, clip=clip)
    print("lagret", os.path.relpath(path, ROOT), f"{os.path.getsize(path) // 1024} KB")


def tab(page, name):
    page.click(f'#tabs [data-tab="{name}"]')
    page.wait_for_timeout(250)


def fit(page, cap=1500, minimum=760):
    """Tilpass vindushøyden til fanens innhold, så bildet ikke har tom plass nederst."""
    bottom = page.evaluate("document.querySelector('.tab.on').getBoundingClientRect().bottom")
    h = max(minimum, min(cap, int(bottom) + 54))
    page.set_viewport_size({"width": 1500, "height": h})
    page.wait_for_timeout(300)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        # bypass_csp: Playwright evaluerer kode i siden, og appens strenge CSP (ingen eval) blokkerer det. Gjelder bare testverktøyet.
        ctx = browser.new_context(device_scale_factor=1.5, locale="nb-NO", color_scheme="dark", bypass_csp=True)
        page = ctx.new_page()

        # 1) oversikt: ren og annotert
        boot(page)
        start_sim(page)
        page.fill("#txtMsg", "Hei verden")
        page.click("#txtShow")
        wait_idle(page)
        page.click("#logHex")                      # pen monitor uten hex-kolonne
        page.evaluate("document.getElementById('log').scrollTop = 0")
        shot(page, "oversikt.png")
        page.evaluate("""() => {
          // (velger, nummer, funksjon som gir [x, y] i et tomt område)
          const spots = [
            ['header.top', 1, r => [830, r.top + r.height / 2 - 12]],
            ['#signPanel', 2, r => [r.left + 430, r.top + 6]],
            ['#tabs', 3, r => [r.left + 700, r.top + 8]],
            ['#tab-tekst', 4, r => [r.right - 40, r.bottom + 10]],
            ['#meters', 5, r => [r.right - 36, r.top - 28]],
            ['#log', 6, r => [r.right - 40, r.bottom - 40]],
            ['footer.bottom', 7, r => [640, r.top - 32]],
          ];
          for (const [sel, n, pos] of spots) {
            const el = document.querySelector(sel); if (!el) continue;
            const [x, y] = pos(el.getBoundingClientRect()), b = document.createElement('div');
            b.className = '__badge'; b.textContent = n;
            b.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:24px;height:24px;border-radius:50%;background:#ffb020;color:#111;font:700 14px system-ui;display:flex;align-items:center;justify-content:center;z-index:9999;box-shadow:0 0 0 2px #111`;
            document.body.appendChild(b);
          }
        }""")
        shot(page, "oversikt-merket.png")

        # 2) TEKST: rulletekst med norske tegn
        boot(page)
        start_sim(page)
        page.click('button[data-q="scroll"]')
        page.fill("#txtMsg", "Hei på deg!")
        page.click("#txtShow")
        wait_idle(page)
        page.click("#logHex")
        shot(page, "tekst.png")

        # 3) TEGN: pikselstudio med et hjerte tegnet inn
        boot(page, height=1250)
        start_sim(page)
        tab(page, "tegn")
        page.evaluate("""() => {
          const f = App.frame(); f.set(Proto.frameFromRows(PRESETS.find(p => p.id === 'hjerte').frames[0]));
          App.frameChanged();
        }""")
        fit(page)
        page.hover("#signCanvas", position={"x": 300, "y": 80})
        shot(page, "tegn.png")

        # 4) ANIMASJON: bibliotek og tidslinje med stikkmannen
        boot(page, height=1260)
        start_sim(page)
        tab(page, "anim")
        page.locator("#presetList .preset", has_text="Stikkmannen").locator("[data-ed]").click()
        page.wait_for_timeout(300)
        page.locator("#timeline .tl").nth(16).click()
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('.left').scrollTop = 0")
        fit(page)
        shot(page, "animasjon.png")
        page.set_viewport_size({"width": 1500, "height": 1260})

        # 5) opplasting i simulatoren og pakkemonitoren
        page.click("#aUpload")
        page.wait_for_function("document.getElementById('uBar').style.width === '100%'", timeout=30000)
        page.wait_for_timeout(500)
        page.locator("#log .ll.tx").last.click()
        page.wait_for_timeout(200)
        shot(page, "pakkemonitor.png", selector="aside.right")

        # 6) SYSTEM
        boot(page, height=1150)
        start_sim(page)
        tab(page, "system")
        page.fill("#schPages", "ABCDEF")
        fit(page)
        shot(page, "system.png")

        # 7) REFERANSE (øvre del)
        boot(page, height=1100)
        start_sim(page)
        tab(page, "hjelp")
        fit(page, cap=1100)
        shot(page, "referanse.png")

        # 8) kommandopaletten
        boot(page)
        start_sim(page)
        page.keyboard.press("Control+k")
        page.keyboard.type("lys")
        page.wait_for_timeout(300)
        shot(page, "kommandopalett.png")

        # 9) diagnose
        boot(page, height=1000)
        start_sim(page)
        page.click("#btnDiag")
        page.click("#dgTest")
        page.wait_for_timeout(800)
        shot(page, "diagnose.png")

        # 10) toppfeltet tilkoblet og frakoblet (utsnitt)
        boot(page)
        shot(page, "toppfelt-frakoblet.png", clip={"x": 0, "y": 0, "width": 1500, "height": 58})
        start_sim(page)
        page.wait_for_timeout(400)
        shot(page, "toppfelt-tilkoblet.png", clip={"x": 0, "y": 0, "width": 1500, "height": 58})

        browser.close()


if __name__ == "__main__":
    main()
