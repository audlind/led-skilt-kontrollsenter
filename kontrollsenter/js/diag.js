/* Diagnose og oppstartsvakt. Lastes FØRST og er uavhengig av resten, slik at den virker selv om andre skript feiler.
   - fanger feil (også filer som ikke lar seg laste) og viser et rødt banner
   - vokter oppstarten: hvis appen ikke har startet 2,5 s etter at siden er lastet, sier den fra hva som mangler
   - DIAGNOSE-knappen åpner miljøinfo, status for alle deler, selvtest og en rapport som kan kopieres */
(function () {
  'use strict';
  const D = window.Diag = { errors: [], failed: [] };
  const GLOBALS = ['Proto', 'PRESETS', 'PixelFont', 'SerialLink', 'SimLink', 'Twin', 'SignDisplay', 'App'];
  const now = () => new Date().toLocaleTimeString('nb-NO');
  let banner = null;

  function add(kind, msg) {
    D.errors.push({ t: now(), kind, msg: String(msg) });
    if (D.errors.length > 60) D.errors.shift();
    showBanner();
    if (D.refresh) D.refresh();
  }
  D.add = add;

  window.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) { const u = t.src || t.href; D.failed.push(u); add('fil', 'Kunne ikke laste ' + u.split('/').slice(-2).join('/')); }
    else if (/^ResizeObserver loop/.test(e.message || '')) { e.stopImmediatePropagation(); }   // kjent, harmløs nettleservarsling
    else add('feil', (e.message || 'ukjent feil') + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  }, true);
  window.addEventListener('unhandledrejection', (e) => add('løfte', (e.reason && e.reason.message) || e.reason));

  function showBanner() {
    if (!document.body) return;
    if (!banner) {
      banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:100;background:#7a1c27;color:#fff;font:12.5px/1.4 Segoe UI,system-ui,sans-serif;padding:7px 14px;display:flex;gap:14px;align-items:center;border-bottom:1px solid #ff4d5e';
      banner.innerHTML = '<b>Noe gikk galt.</b><span id="diagBannerMsg" style="flex:1"></span><button id="diagBannerBtn" style="cursor:pointer;padding:3px 10px;border:1px solid #fff;background:transparent;color:#fff;border-radius:3px">ÅPNE DIAGNOSE</button><button id="diagBannerX" style="cursor:pointer;padding:3px 8px;border:1px solid #fff;background:transparent;color:#fff;border-radius:3px">×</button>';
      document.body.appendChild(banner);
      banner.querySelector('#diagBannerBtn').onclick = open;
      banner.querySelector('#diagBannerX').onclick = () => { banner.style.display = 'none'; };
    }
    banner.style.display = 'flex';
    const last = D.errors[D.errors.length - 1];
    banner.querySelector('#diagBannerMsg').textContent = `${D.errors.length} feil. Siste: ${last.msg}`;
  }

  // ---------- selvtest ----------
  async function selftest() {
    const out = [], t = (name, ok, info = '') => out.push({ name, ok: !!ok, info });
    try {
      const P = window.Proto;
      t('Protokoll lastet', !!P);
      if (P) {
        t('Sjekksum av <D*> er 6C', P.checksum('<D*>') === '6C', P.checksum('<D*>'));
        t('Pakke <ID00><D*>6C<E>', String.fromCharCode(...P.packet('<D*>')) === '<ID00><D*>6C<E>');
        t('Æ Ø Å æ ø å -> <U46><U58><U45><U66><U78><U65>', P.encodeText('ÆØÅæøå') === '<U46><U58><U45><U66><U78><U65>', P.encodeText('ÆØÅæøå'));
        const f = P.newFrame(); f[0] = 1; const b = P.frameBlocks(f);
        t('Grafikkblokk: piksel (0,0) gir første byte 0x80', b.length === 3 && b[0][0] === 0x80 && b[0].length === 64, b[0] && b[0][0].toString(16));
        t('Klokkekommando mandag = 01', P.cmd.clock(new Date(2026, 9, 5, 22, 30, 45)) === '<SC>26011005223045');
      }
      if (window.SimLink && window.Proto) {
        const L = new window.SimLink(); L.speed = 0.01; await L.connect();
        const r = await L.transact('<BA>'); t('Simulator: <BA> gir ACK', r.kind === 'ACK', r.kind);
        const w = await L.transact('<ID00><BA>FF<E>', { raw: true }); t('Simulator: feil sjekksum gir NACK', w.kind === 'NACK', w.kind);
      } else t('Simulator tilgjengelig', false);
      const cv = document.createElement('canvas'); t('Canvas støttes', !!(cv.getContext && cv.getContext('2d')));
      let ls = false; try { localStorage.setItem('led.__t', '1'); ls = localStorage.getItem('led.__t') === '1'; localStorage.removeItem('led.__t'); } catch (e) { /* tom */ }
      t('Nettleserlager (localStorage)', ls);
      t('ResizeObserver', 'ResizeObserver' in window);
      if (window.App && window.App.display) {
        window.App.display.draw();
        const c = window.App.display.canvas, d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
        t('Skiltet tegnes på lerretet', d[3] > 0, 'alpha ' + d[3]);
      } else t('Skiltet er opprettet (App.display)', false);
    } catch (e) { t('Selvtesten krasjet', false, e.message); }
    return out;
  }
  D.selftest = selftest;

  // ---------- rapport ----------
  function env() {
    return [
      ['Nettleser', navigator.userAgent],
      ['Adresse', location.href + (location.protocol === 'file:' ? '  (fra fil: bruk helst start.bat / localhost)' : '')],
      ['Sikker kontekst', String(window.isSecureContext)],
      ['Web Serial', 'serial' in navigator ? 'støttes' : 'støttes IKKE (bruk Chrome eller Edge)'],
      ['Skjerm / vindu', `${screen.width}×${screen.height}, vindu ${innerWidth}×${innerHeight}, dpr ${window.devicePixelRatio}`],
      ['Tid siden siden ble åpnet', Math.round(performance.now() / 1000) + ' s'],
    ];
  }
  function parts() {
    return GLOBALS.map((g) => [g, window[g] ? 'ok' : 'MANGLER']);
  }
  function link() {
    const A = window.App;
    if (!A || !A.link) return [['Tilkobling', 'ingen']];
    const s = A.link.stats;
    return [['Tilkobling', `${A.link.kind} · ${A.link.state}`], ['Pakker', `${s.packets} (ACK ${s.ack}, NACK ${s.nack}, annet ${s.other})`], ['Byte TX/RX', `${s.txBytes}/${s.rxBytes}`],
      ['Siste serielle feil', A.link.lastError || 'ingen'], ['Port åpen (readable)', A.link.port ? String(!!A.link.port.readable) : '–']];
  }
  async function report(withTests) {
    const lines = ['LED-SKILT KONTROLLSENTER · DIAGNOSE · ' + new Date().toISOString(), '', '== Miljø =='];
    env().forEach(([k, v]) => lines.push(`${k}: ${v}`));
    lines.push('', '== Deler ==');
    parts().forEach(([k, v]) => lines.push(`${k}: ${v}`));
    lines.push('', '== Tilkobling ==');
    link().forEach(([k, v]) => lines.push(`${k}: ${v}`));
    lines.push('', '== Feil (' + D.errors.length + ') ==');
    D.errors.forEach((e) => lines.push(`${e.t} [${e.kind}] ${e.msg}`));
    if (D.failed.length) { lines.push('', '== Filer som ikke lot seg laste =='); D.failed.forEach((f) => lines.push(f)); }
    if (withTests) { lines.push('', '== Selvtest =='); (await selftest()).forEach((r) => lines.push(`${r.ok ? 'OK ' : 'FEIL'}  ${r.name}${r.info ? ' · ' + r.info : ''}`)); }
    return lines.join('\n');
  }
  D.report = report;

  // ---------- dialog ----------
  let dlg = null;
  function open() {
    if (dlg) { dlg.style.display = 'flex'; D.refresh(); return; }
    dlg = document.createElement('div');
    dlg.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.6);display:flex;justify-content:center;align-items:flex-start;padding:5vh 0';
    dlg.innerHTML = `<div style="width:min(860px,94vw);max-height:90vh;display:flex;flex-direction:column;background:#14181c;border:1px solid #343c45;border-radius:5px;color:#cdd4db;font:12px/1.45 Segoe UI,system-ui,sans-serif">
      <div style="display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:1px solid #272d34"><b style="letter-spacing:.1em">DIAGNOSE</b><span style="flex:1"></span>
        <button id="dgTest" style="cursor:pointer">KJØR SELVTEST</button><button id="dgCopy" style="cursor:pointer">KOPIER RAPPORT</button><button id="dgReload" style="cursor:pointer">LAST SIDEN PÅ NYTT</button><button id="dgClose" style="cursor:pointer">LUKK</button></div>
      <pre id="dgBody" style="margin:0;padding:12px;overflow:auto;white-space:pre-wrap;font:12px/1.5 Cascadia Mono,Consolas,monospace"></pre></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#dgClose').onclick = () => { dlg.style.display = 'none'; };
    dlg.onmousedown = (e) => { if (e.target === dlg) dlg.style.display = 'none'; };
    dlg.querySelector('#dgReload').onclick = () => location.reload();
    dlg.querySelector('#dgCopy').onclick = async () => { const txt = await report(true); try { await navigator.clipboard.writeText(txt); alert('Rapporten er kopiert. Lim den inn i samtalen.'); } catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); alert('Rapporten er kopiert.'); } };
    dlg.querySelector('#dgTest').onclick = async () => { dlg.querySelector('#dgBody').textContent = await report(true); };
    D.refresh = async () => { if (dlg && dlg.style.display !== 'none') dlg.querySelector('#dgBody').textContent = await report(false); };
    D.refresh();
  }
  D.open = open;

  function wire() {
    const b = document.getElementById('btnDiag'); if (b) b.addEventListener('click', open);
    window.addEventListener('keydown', (e) => { if (e.key === 'F12' && e.shiftKey) { e.preventDefault(); open(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  // ---------- oppstartsvakt ----------
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.App && window.App.booted) { if (banner && !D.errors.length) banner.style.display = 'none'; return; }
      const missing = GLOBALS.filter((g) => !window[g]);
      add('oppstart', 'Appen startet ikke. ' + (missing.length ? 'Mangler: ' + missing.join(', ') + '. ' : '') + 'Dette skjer ofte når en skriptfil ikke ble lastet (nettverksfeil, enkelttrådet lokal server, eller at en sikkerhetspolicy blokkerte noe). Last siden på nytt (Ctrl+Shift+R). Lokalt: start med start.bat. Åpne DIAGNOSE for detaljer.');
    }, 2500);
  });
})();
