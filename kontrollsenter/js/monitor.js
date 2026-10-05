/* Pakkemonitor, instrumenter og rå kommando. */
(function (root) {
  'use strict';
  const { App, Proto: P } = root, $ = App.$;
  const entries = [];
  let paused = false, selected = null;

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`; };
  const printable = (bytes, max = 160) => {
    let s = '';
    for (let i = 0; i < Math.min(bytes.length, max); i++) { const c = bytes[i]; s += (c >= 32 && c < 127) ? String.fromCharCode(c) : '·'; }
    return s + (bytes.length > max ? `… (+${bytes.length - max})` : '');
  };
  const hexOf = (bytes, max = 24) => [...bytes.slice(0, max)].map((b) => b.toString(16).padStart(2, '0')).join(' ') + (bytes.length > max ? ' …' : '');

  function add(e) {
    entries.push(e); if (entries.length > 600) entries.shift();
    if (paused) return;
    const log = $('#log'), div = document.createElement('div');
    div.className = 'll ' + e.dir + (e.bad ? ' bad' : ''); div.dataset.i = entries.length - 1;
    const hex = $('#logHex').checked && e.bytes ? ` <span class="muted">${hexOf(e.bytes)}</span>` : '';
    div.innerHTML = `<span class="t">${stamp(e.t)}</span><span class="d">${e.dir === 'tx' ? 'TX' : e.dir === 'rx' ? 'RX' : '··'}</span><span>${e.text.replace(/</g, '&lt;')}${hex}${e.label ? ` <span class="lab">· ${e.label}</span>` : ''}</span>`;
    div.addEventListener('click', () => { selected = e; log.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); div.classList.add('sel'); anatomy(e); });
    log.appendChild(div);
    while (log.children.length > 400) log.firstChild.remove();
    if ($('#logFollow').checked) log.scrollTop = log.scrollHeight;
  }
  App.log = (text, dir = 'sys') => add({ t: Date.now(), dir, text });

  function anatomy(e) {
    const box = $('#anatomy');
    if (!e || !e.packet) { box.innerHTML = e && e.dir === 'rx' ? `<div>Svar: <b>${e.parsed ? e.parsed.kind : ''}</b> ${e.ms ? e.ms.toFixed(1) + ' ms' : ''}</div>` : '<div class="muted">Klikk en linje i monitoren for å se pakkens oppbygning.</div>'; return; }
    const pkt = e.packet, s = [...pkt].map((c) => String.fromCharCode(c)).join('');
    const id = s.slice(0, 6), end = s.slice(-3), cs = s.slice(-5, -3), dataBytes = pkt.slice(6, pkt.length - 5);
    const ms = pkt.length * root.BYTE_MS;
    const dataHtml = dataBytes.length > 90 ? `${printable(dataBytes.slice(0, 40)).replace(/</g, '&lt;')} … [${dataBytes.length} byte]` : printable(dataBytes).replace(/</g, '&lt;');
    box.innerHTML = `<div>${pkt.length} byte · <b>${ms.toFixed(1)} ms</b> på ledningen (1,04 ms/byte) · skiltet er mørkt så lenge</div>
      <div class="seg-row"><span class="s seg-id">${id.replace(/</g, '&lt;')}</span><span class="s seg-data">${dataHtml}</span><span class="s seg-cs">${cs}</span><span class="s seg-end">${end.replace(/</g, '&lt;')}</span></div>
      <div class="muted">ID · data · XOR-sjekksum · slutt${P.checksum(dataBytes) === cs ? '' : ' · (sjekksum ≠ beregnet ' + P.checksum(dataBytes) + ')'}</div>`;
  }

  // ---- hendelser fra transport ----
  App.on('tx', (d) => add({ t: d.t, dir: 'tx', text: printable(d.packet), bytes: d.packet, packet: d.packet, label: d.label }));
  App.on('rx', (d) => {
    const k = d.parsed.kind, ok = k === 'ACK';
    const text = k === 'NACK' ? `NACK${d.parsed.expected != null ? ' · forventet sjekksum 0x' + d.parsed.expected.toString(16).toUpperCase().padStart(2, '0') : ''}` : k === 'støy' ? 'støy: ' + printable(d.bytes, 20) : k;
    add({ t: d.t, dir: 'rx', text: `${text}  (${d.ms.toFixed(0)} ms)`, bytes: d.bytes, parsed: d.parsed, ms: d.ms, bad: !ok });
    anatomy(entries.slice().reverse().find((x) => x.dir === 'tx'));
  });
  App.on('twin-note', (n) => { /* stille: tvillingen oppdateres */ });
  App.on('link-state', ({ state, kind }) => App.log(`Forbindelse: ${state}${kind !== 'ingen' ? ' (' + kind + ')' : ''}`));

  // ---- instrumenter ----
  const meters = [
    ['tilstand', 'Forbindelse'], ['pakker', 'Pakker'], ['tx', 'TX byte'], ['rx', 'RX byte'],
    ['acks', 'ACK / NACK / annet'], ['rtt', 'RTT snitt'], ['duty', 'Display duty (10 s)'], ['twin', 'Tvilling'],
  ];
  $('#meters').innerHTML = meters.map(([id, name]) => `<div class="meter"><span>${name}</span><b id="m-${id}">–</b>${id === 'duty' ? '<div class="bar"><i id="m-dutybar"></i></div>' : ''}</div>`).join('');
  function updateMeters() {
    const L = App.link, set = (id, v) => { const el = $('#m-' + id); if (el) el.textContent = v; };
    if (!L) { set('tilstand', 'ingen'); return; }
    const s = L.stats, duty = L.duty();
    set('tilstand', L.state + (L.kind === 'sim' ? ' · sim' : '')); set('pakker', s.packets); set('tx', s.txBytes); set('rx', s.rxBytes);
    set('acks', `${s.ack} / ${s.nack} / ${s.other}`);
    const r = L.avgRtt(); set('rtt', r == null ? '–' : r.toFixed(0) + ' ms');
    set('duty', (duty * 100).toFixed(0) + ' %'); $('#m-dutybar').style.width = (duty * 100) + '%';
    $('#m-dutybar').style.background = duty > 0.9 ? 'var(--ok)' : duty > 0.5 ? 'var(--warn)' : 'var(--err)';
    $('#chipRtt').textContent = r == null ? '–' : r.toFixed(0) + ' ms'; $('#chipDuty').textContent = (duty * 100).toFixed(0) + ' %';
    const t = App.twin; set('twin', t.current ? `side ${t.current} · ${(t.order || []).length} i løkka` : 'ingen side');
  }
  setInterval(updateMeters, 500); App.on('stats', updateMeters);

  // ---- kontroller ----
  $('#logPause').addEventListener('click', (e) => { paused = !paused; e.target.textContent = paused ? 'Fortsett' : 'Pause'; });
  $('#logClear').addEventListener('click', () => { entries.length = 0; $('#log').innerHTML = ''; });
  $('#logSave').addEventListener('click', () => {
    const txt = entries.map((e) => `${stamp(e.t)} ${e.dir.toUpperCase()} ${e.text}${e.bytes ? '  [' + hexOf(e.bytes, 4000) + ']' : ''}`).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'skilt-logg.txt'; a.click();
  });
  const hist = []; let hi = 0;
  async function sendRaw() {
    const inp = $('#rawIn'), v = inp.value; if (!v) return;
    hist.push(v); hi = hist.length;
    if (!App.requireLink()) return;
    if ($('#rawWrap').checked) await App.send(v, 'rå'); else { try { await App.link.transact(v, { raw: true, label: 'rå' }); } catch (e) { App.toast(String(e.message || e), 'err'); } }
  }
  $('#rawSend').addEventListener('click', sendRaw);
  $('#rawIn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendRaw();
    else if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); e.target.value = hist[hi]; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && hist.length) { hi = Math.min(hist.length, hi + 1); e.target.value = hist[hi] || ''; e.preventDefault(); }
  });
  anatomy(null); updateMeters();
})(window);
