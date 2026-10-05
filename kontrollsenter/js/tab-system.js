/* Fane SYSTEM: lysstyrke, klokke, sletting, kjøreside, tidsplaner, tester og avansert. */
(function (root) {
  'use strict';
  const { App, Proto: P } = root, $ = App.$, $$ = App.$$;

  // lysstyrke (to steder: linjen under skiltet og her)
  async function setBrightness(l) {
    const r = await App.send(P.cmd.brightness(l), 'Lysstyrke ' + P.BRIGHTNESS.find(([c]) => c === l)[1]);
    if (r && r.ok) $$('#brightSeg button').forEach((b) => b.classList.toggle('on', b.dataset.b === l));
  }
  $$('[data-bright]').forEach((b) => b.addEventListener('click', () => setBrightness(b.dataset.bright)));
  $$('#brightSeg button').forEach((b) => b.addEventListener('click', () => setBrightness(b.dataset.b)));
  App.on('twin-note', () => { $$('#brightSeg button').forEach((b) => b.classList.toggle('on', b.dataset.b === App.twin.brightness)); });

  // klokke
  const tick = () => { const d = new Date(), p2 = (n) => String(n).padStart(2, '0'); const t = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; $('#sysNow').textContent = t; $('#chipClock').textContent = t.slice(11); };
  setInterval(tick, 500); tick();
  $('#sysSync').addEventListener('click', () => { const c = P.cmd.clock(new Date()); App.send(c, 'Klokke ' + c.slice(4)); });

  // sletting
  $('#sysWipe').addEventListener('click', () => { if (confirm('Slette alle sider, tidsplaner og grafikk på skiltet?')) App.send(P.cmd.deleteAll(), 'Slett alt'); });
  $('#sysDelPageBtn').addEventListener('click', () => App.send(P.cmd.deleteLine(1, $('#sysDelPage').value), 'Slett side ' + $('#sysDelPage').value));
  $('#sysDelSchedBtn').addEventListener('click', () => App.send(P.cmd.deleteSchedule($('#sysDelSched').value), 'Slett tidsplan ' + $('#sysDelSched').value));
  $('#sysRunBtn').addEventListener('click', () => App.send(P.cmd.runPage($('#sysRunPage').value), 'Kjøreside ' + $('#sysRunPage').value));
  ['#sysDelSched', '#schN'].forEach((s) => { $(s).innerHTML = 'ABCDE'.split('').map((c) => `<option>${c}</option>`).join(''); });

  // tidsplanbygger
  function localToStamp(v) { if (!v) return null; const d = new Date(v), p2 = (n) => String(n).padStart(2, '0'); return p2(d.getFullYear() % 100) + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()); }
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $('#schStart').value = now.toISOString().slice(0, 16); const later = new Date(now.getTime() + 3600e3); $('#schEnd').value = later.toISOString().slice(0, 16);
  function schedCmd() {
    const pages = $('#schPages').value.toUpperCase().replace(/[^A-Z]/g, '');
    const always = $('#schAlways').checked, s = always ? P.ALWAYS.start : localToStamp($('#schStart').value), e = always ? P.ALWAYS.end : localToStamp($('#schEnd').value);
    return { pages, cmd: P.cmd.schedule($('#schN').value, s, e, pages) };
  }
  function schedUpdate() {
    const { pages, cmd } = schedCmd(); $('#schStart').disabled = $('#schEnd').disabled = $('#schAlways').checked;
    $('#schPreview').textContent = `${cmd} · ${pages.length} plasser${pages.length > 31 ? ' (for mange, maks 31)' : ''}`;
  }
  ['#schN', '#schPages', '#schStart', '#schEnd', '#schAlways'].forEach((s) => { $(s).addEventListener('input', schedUpdate); $(s).addEventListener('change', schedUpdate); }); schedUpdate();
  $('#schSend').addEventListener('click', () => { const { pages, cmd } = schedCmd(); if (!pages.length || pages.length > 31) return App.toast('Oppgi 1–31 sider', 'err'); App.send(cmd, 'Tidsplan ' + $('#schN').value); });

  // tester
  const patterns = {
    allon: () => { const f = P.newFrame(); f.fill(1); return f; },
    checker: () => { const f = P.newFrame(); for (let y = 0; y < 7; y++) for (let x = 0; x < 80; x++) f[y * 80 + x] = (x + y) % 2; return f; },
    edges: () => { const f = P.newFrame(); for (let x = 0; x < 80; x++) { f[x] = 1; f[6 * 80 + x] = 1; } for (let y = 0; y < 7; y++) { f[y * 80] = 1; f[y * 80 + 79] = 1; } return f; },
    cols: () => { const f = P.newFrame(); for (let x = 0; x < 80; x += 5) for (let y = 0; y < 7; y++) f[y * 80 + x] = 1; return f; },
  };
  $$('[data-test]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.test;
    if (patterns[t]) return App.showFrameOnSign(patterns[t](), 'Testbilde');
    if (t === 'beep') return App.showPageOnSign({ text: '<BA>BIP', lead: 'A', lag: 'K', wait: 'Z' }, 'Bip');
    const k = { song1: 2, song2: 3, song3: 4 }[t];
    App.showPageOnSign({ text: 'MELODI ' + (k - 1), lead: 'A', lag: 'K', wait: 'Z', mode: P.modeCode(1, k) }, 'Melodi');
  }));

  // avansert
  $('#advUnlock').addEventListener('change', (e) => { $('#advId').disabled = !e.target.checked; $('#advSetId').disabled = !e.target.checked; });
  $('#advSetId').addEventListener('click', () => {
    const id = parseInt($('#advId').value, 16); if (!(id >= 1 && id <= 255)) return App.toast('Ugyldig ID (01–FF)', 'err');
    if (confirm(`Sette skiltets ID til ${P.hex2(id)}? Skiltet svarer deretter bare på den ID-en, og dette kontrollsenteret bruker ID 00.`)) App.link && App.link.transact(P.cmd.setId(id), { raw: false, label: 'Sett ID' });
  });
})(window);
