/* Fane TEKST: meldingsbygger med alle effekter, hastigheter, fonter og farger. */
(function (root) {
  'use strict';
  const { App, Proto: P, PixelFont: Font } = root, $ = App.$;

  const fill = (sel, opts, dflt) => {
    const el = $(sel); el.innerHTML = opts.map(([v, label, dis]) => `<option value="${v}"${dis ? ' disabled' : ''}>${label}</option>`).join('');
    if (dflt != null) el.value = dflt;
  };
  const pageOpts = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => [c, 'Side ' + c]);
  const waitOpts = P.waitLetters.map((c) => [c, `${c} · ${P.waitSeconds(c)} s`]);
  fill('#txtLead', P.LEAD.map(([c, n]) => [c, `${c} · ${n}`]), 'A');
  fill('#txtLag', P.LAG.map(([c, n]) => [c, `${c} · ${n}`]), 'A');
  fill('#txtSpeed', [[1, '1 · raskest'], [2, '2'], [3, '3'], [4, '4 · tregest']], 3);
  fill('#txtKind', [[0, 'Normal'], [1, 'Blinkende'], [2, 'Melodi 1'], [3, 'Melodi 2'], [4, 'Melodi 3']], 0);
  fill('#txtWait', waitOpts, 'C');
  fill('#txtFont', P.FONTS.map(([c, n, ok]) => [c, `${c} · ${n}`, !ok]), 'A');
  fill('#txtColor', P.COLORS.map(([c, vis]) => [c, `${c} · ${vis ? 'synlig' : 'usynlig (grønn)'}`]), 'B');
  fill('#txtPage', pageOpts, 'A');
  ['#sysDelPage', '#sysRunPage'].forEach((s) => fill(s, pageOpts, 'A'));

  // sett-inn-knapper
  const ins = [['Æ'], ['Ø'], ['Å'], ['æ'], ['ø'], ['å'], ['<KT>', 'klokke'], ['<KD>', 'dato'], ['<BA>', 'bip']];
  $('#insertBar').innerHTML = ins.map(([v, t]) => `<button class="tiny" data-ins="${v.replace(/"/g, '&quot;')}" title="${t || 'sett inn ' + v}">${v.replace(/</g, '&lt;')}</button>`).join(' ');
  $('#insertBar').addEventListener('click', (e) => {
    const v = e.target.dataset && e.target.dataset.ins; if (!v) return;
    const t = $('#txtMsg'), a = t.selectionStart, b = t.selectionEnd;
    t.value = t.value.slice(0, a) + v + t.value.slice(b); t.focus(); t.selectionStart = t.selectionEnd = a + v.length; update();
  });

  function options() {
    return {
      line: 1, page: $('#txtPage').value, lead: $('#txtLead').value, lag: $('#txtLag').value, wait: $('#txtWait').value,
      mode: P.modeCode(+$('#txtSpeed').value, +$('#txtKind').value), font: $('#txtFont').value, color: $('#txtColor').value,
      col: Math.max(0, Math.min(255, +$('#txtCol').value || 0)), text: $('#txtMsg').value,
    };
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function displayText(t) { return t.replace(/<KT>/g, '00:00').replace(/<KD>/g, '00/00/00').replace(/<[A-Z]{2}>/g, ''); }

  function update() {
    const o = options(), data = P.cmd.page(o), pkt = P.packet(data), s = String.fromCharCode(...pkt);
    const shown = displayText(o.text), width = shown.length * (o.font === 'B' ? 7 : o.font === 'C' ? 5 : 6);
    $('#txtLen').textContent = o.text.length; $('#txtWidth').textContent = width;
    const warn = [];
    if (o.text.length > 975) warn.push('for lang (maks 975 tegn)');
    if (width > 80 && o.lead !== 'E' && o.lead !== 'F') warn.push('bredere enn skjermen: bruk innrulling (E eller F), ellers kuttes teksten');
    if (!P.COLORS.find(([c]) => c === o.color)[1]) warn.push('fargekoden er usynlig på et rødt skilt');
    $('#txtWarn').textContent = warn.join(' · ');
    $('#txtPacket').innerHTML = `<span class="seg-id">${esc(s.slice(0, 6))}</span><span class="seg-data">${esc(s.slice(6, -5))}</span><span class="seg-cs">${s.slice(-5, -3)}</span><span class="seg-end">${esc(s.slice(-3))}</span>`;
    $('#txtCost').textContent = `${pkt.length} byte · ${(pkt.length * root.BYTE_MS).toFixed(0)} ms på ledningen · visningstid ca. ${(P.waitSeconds(o.wait) + 0.0).toFixed(1)} s pluss effekter`;
  }
  ['#txtMsg', '#txtLead', '#txtLag', '#txtSpeed', '#txtKind', '#txtWait', '#txtFont', '#txtColor', '#txtPage', '#txtCol'].forEach((s) => {
    $(s).addEventListener('input', update); $(s).addEventListener('change', update);
  });

  function preview() {
    const o = options(), rows = Font.render(displayText(o.text)), fb = P.newFrame();
    for (let y = 0; y < 7; y++) for (let x = 0; x < rows[y].length; x++) { const px = o.col + x; if (px < 80 && rows[y][x] === '#') fb[y * 80 + px] = 1; }
    App.flash(fb, 4000);
  }
  $('#txtPreview').addEventListener('click', preview);
  $('#txtSend').addEventListener('click', () => App.send(P.cmd.page(options()), 'Side ' + $('#txtPage').value));
  $('#txtShow').addEventListener('click', () => App.showPageOnSign(options(), 'Teksten'));
  document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const q = b.dataset.q, set = (id, v) => { $(id).value = v; };
    if (q === 'scroll') { set('#txtLead', 'E'); set('#txtLag', 'E'); set('#txtSpeed', 2); set('#txtKind', 0); set('#txtWait', 'B'); set('#txtCol', 0); }
    if (q === 'static') { set('#txtLead', 'A'); set('#txtLag', 'K'); set('#txtKind', 0); set('#txtWait', 'Z'); }
    if (q === 'blink') { set('#txtLead', 'A'); set('#txtLag', 'K'); set('#txtKind', 1); set('#txtSpeed', 3); set('#txtWait', 'Z'); }
    if (q === 'clock') { $('#txtMsg').value = '<KT> <KD>'; set('#txtLead', 'A'); set('#txtLag', 'K'); set('#txtKind', 0); set('#txtWait', 'Z'); }
    update();
  }));
  update();
  App.textOptions = options;
})(window);
