/* Oppstart: skilt, faner, koblinger, hurtigtaster og kommandopalett. */
(function (root) {
  'use strict';
  const { App, Proto: P } = root, $ = App.$, $$ = App.$$;

  App.display = new root.SignDisplay($('#signCanvas'));

  // digital tvilling -> skjerm
  App.twin.addEventListener('frame', (e) => { App.twinFb = e.detail.fb; if (App.view === 'twin' && !App.transient && !App.playing) App.refreshDisplay(); });
  App.twin.addEventListener('brightness', () => App.refreshDisplay());
  App.twin.addEventListener('order', () => { $('#twinInfo').textContent = App.twinSummary(); });

  // visning
  $$('#viewSeg button').forEach((b) => b.addEventListener('click', () => { App.Player && App.Player.stop(); App.setView(b.dataset.view); }));

  // faner
  function tab(name) {
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
    App.Player && App.Player.stop();
    App.setView(name === 'tegn' || name === 'anim' ? 'edit' : 'twin');
    App.activeTab = name;
  }
  App.tab = tab;
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));

  // tilkobling
  $('#btnConnect').addEventListener('click', async (ev) => {
    if (App.link && App.link.connected && App.link.kind === 'serial') { await App.link.disconnect(); return; }
    if (!root.SerialLink.supported()) return App.toast('Web Serial støttes ikke her. Åpne siden i Chrome eller Edge (via http://localhost eller direkte fra filen).', 'err');
    try {
      const link = new root.SerialLink(); App.setLink(link);
      App.status(ev.shiftKey ? 'Velg Arduino Uno i listen.' : 'Kobler til Arduino Uno (bruker porten du har godkjent før; hold Skift for å velge en annen). Den resettes ved tilkobling, ca. 2,5 s.');
      await link.connect({ choose: ev.shiftKey });
      const r = await App.send(P.cmd.brightness('A'), 'Kontakttest');          // enkel kommando: skal gi ACK
      if (r && r.ok) { App.status('Tilkoblet, og skiltet svarer (ACK).'); App.toast('Tilkoblet. Skiltet svarer.', 'ok'); }
      else if (r && r.kind === 'støy') App.toast('Svar med støy (ff-byte): GND-ledningen mellom Uno og skilt har trolig løsnet.', 'err');
      else App.toast('Ingen svar fra skiltet. Sjekk at skiltet er på (12 V), at pin 2 og 3 sitter på TX og RX, og at GND er koblet. RESET-jumperen skal ikke sitte på.', 'err');
    } catch (e) { App.toast('Kunne ikke koble til: ' + (e.message || e), 'err'); if (App.link) App.link.setState('frakoblet'); }
  });
  $('#btnSim').addEventListener('click', async () => {
    if (App.link && App.link.connected && App.link.kind === 'sim') { await App.link.disconnect(); return; }
    const link = new root.SimLink(); App.setLink(link); await link.connect();
    App.status('Simulator: kommandoene går ikke til noe fysisk skilt, men tvillingen viser hva som ville skjedd.');
  });

  // kommandopalett
  const commands = [
    ['Gå til fane TEKST', '1', () => tab('tekst')], ['Gå til fane TEGN', '2', () => tab('tegn')], ['Gå til fane ANIMASJON', '3', () => tab('anim')],
    ['Gå til fane SYSTEM', '4', () => tab('system')], ['Gå til fane REFERANSE', '5', () => tab('hjelp')],
    ['Koble til skilt', '', () => $('#btnConnect').click()], ['Start simulator', '', () => $('#btnSim').click()],
    ['Synkroniser klokken', '', () => $('#sysSync').click()], ['Lysstyrke 100 %', '', () => App.send(P.cmd.brightness('A'), 'Lysstyrke 100 %')],
    ['Lysstyrke 25 %', '', () => App.send(P.cmd.brightness('D'), 'Lysstyrke 25 %')], ['Slett alt på skiltet', '', () => $('#sysWipe').click()],
    ['Last opp animasjonen', '', () => $('#aUpload').click()], ['Spill/stopp animasjonen', 'Mellomrom', () => App.animToggle()],
    ['Tøm bildet', '', () => App.drawOp('clear')], ['Inverter bildet', '', () => App.drawOp('invert')], ['Tøm pakkemonitoren', '', () => $('#logClear').click()],
    ['Vis bildet på skiltet', '', () => $('#drawSend').click()],
    ['Nullstill seriellport (lukk en port som sitter fast åpen)', '', async () => { if (!root.SerialLink.supported()) return; await root.SerialLink.closeStale(); App.toast('Åpne porter er lukket. Prøv «Koble til skilt» igjen.', 'ok'); App.log('Seriellport nullstilt'); }],
    ['Koble til skilt og velg port selv', 'Skift+klikk', () => { const e = new MouseEvent('click', { shiftKey: true, bubbles: true }); $('#btnConnect').dispatchEvent(e); }],
    ['Åpne diagnose', 'Skift+F12', () => root.Diag && root.Diag.open()],
  ];
  const pal = $('#palette'), palIn = $('#palIn'), palList = $('#palList'); let palSel = 0, palItems = [];
  function palRender() {
    const q = palIn.value.toLowerCase(); palItems = commands.filter((c) => c[0].toLowerCase().includes(q)); palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    palList.innerHTML = palItems.map((c, i) => `<div class="${i === palSel ? 'sel' : ''}" data-i="${i}"><span>${c[0]}</span><small>${c[1]}</small></div>`).join('');
  }
  function palOpen() { pal.hidden = false; palIn.value = ''; palSel = 0; palRender(); palIn.focus(); }
  function palRun(i) { const c = palItems[i]; pal.hidden = true; if (c) c[2](); }
  $('#btnPalette').addEventListener('click', palOpen);
  palIn.addEventListener('input', () => { palSel = 0; palRender(); });
  palIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { palSel = Math.min(palItems.length - 1, palSel + 1); palRender(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); palRender(); e.preventDefault(); }
    else if (e.key === 'Enter') palRun(palSel); else if (e.key === 'Escape') pal.hidden = true;
  });
  palList.addEventListener('click', (e) => { const d = e.target.closest('[data-i]'); if (d) palRun(+d.dataset.i); });
  pal.addEventListener('mousedown', (e) => { if (e.target === pal) pal.hidden = true; });

  // hurtigtaster
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palOpen(); return; }
    if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); App.drawOp('undo'); return; }
    if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); App.drawOp('redo'); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    const tabs = { 1: 'tekst', 2: 'tegn', 3: 'anim', 4: 'system', 5: 'hjelp' };
    if (tabs[e.key]) return tab(tabs[e.key]);
    if (e.key === ' ' && (App.activeTab === 'anim' || App.activeTab === 'tegn')) { e.preventDefault(); return App.animToggle(); }
    if (App.activeTab === 'anim') { if (e.key === 'ArrowLeft') return App.animGoto(-1); if (e.key === 'ArrowRight') return App.animGoto(1); }
    if (App.activeTab === 'tegn' && App.toolKey(e.key.toLowerCase())) return;
  });

  // gjenoppkobling: når en tidligere godkjent Uno kommer tilbake etter at forbindelsen falt ut
  if (root.SerialLink.supported()) {
    navigator.serial.addEventListener('connect', () => {
      if (App.lostSerial && !(App.link && App.link.connected)) { App.lostSerial = false; App.toast('Enheten er tilbake. Kobler til igjen…'); setTimeout(() => $('#btnConnect').click(), 800); }
    });
    navigator.serial.addEventListener('disconnect', () => App.log('USB-enheten ble koblet fra (system-hendelse)'));
  }

  // opprydding
  window.addEventListener('beforeunload', () => { try { if (App.link && App.link.kind === 'serial') App.link.disconnect(); } catch (e) { /* ignorer */ } });
  tab('tekst');
  App.booted = true;                                  // oppstartsvakten (diag.js) ser etter dette
  App.log('Kontrollsenter klar. Protokoll 9600 8N1, ID 00.');
  if (!root.SerialLink.supported()) App.toast('Denne nettleseren støtter ikke Web Serial. Bruk Chrome eller Edge for å koble til skiltet. Simulatoren virker overalt.', 'err');
})(window);
