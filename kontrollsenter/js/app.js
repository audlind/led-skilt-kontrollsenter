/* Felles tilstand og hjelpefunksjoner for kontrollsenteret. Alle faner henger seg på App. */
(function (root) {
  'use strict';
  const P = root.Proto;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const App = {
    $, $$, P,
    link: null,
    twin: new root.Twin(),
    display: null,
    view: 'twin',                              // 'twin' (det skiltet forventes å vise) | 'edit' (rammen du redigerer)
    twinFb: new Uint8Array(P.W * P.H),
    project: { name: 'Uten navn', frames: [P.newFrame()], holds: {}, sel: 0 },
    undo: [], redo: [],
    ev: new EventTarget(),
    transient: null,
  };

  // ---------- lagring ----------
  App.store = {
    get(key, dflt) { try { const v = localStorage.getItem('led.' + key); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set(key, val) { try { localStorage.setItem('led.' + key, JSON.stringify(val)); return true; } catch (e) { return false; } },
  };

  // ---------- meldinger ----------
  App.toast = function (msg, kind = '') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), kind === 'err' ? 6500 : 3500);
  };
  App.status = function (msg) { $('#status').textContent = msg; };
  App.emit = (type, detail) => App.ev.dispatchEvent(new CustomEvent(type, { detail }));
  App.on = (type, fn) => App.ev.addEventListener(type, (e) => fn(e.detail));

  // ---------- prosjekt / valgt bilde ----------
  App.frame = () => App.project.frames[App.project.sel];
  App.snapshot = function () {
    App.undo.push({ sel: App.project.sel, data: App.frame().slice() }); if (App.undo.length > 200) App.undo.shift(); App.redo = [];
  };
  App.frameChanged = function () { App.refreshDisplay(); App.emit('frame-changed'); };

  // ---------- visning ----------
  App.setView = function (v) {
    App.view = v; if (App.display) App.display.hover = null;
    $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    $('#viewHint').textContent = v === 'twin' ? 'Viser det skiltet forventes å vise (digital tvilling av minnet)' : 'Viser bildet du redigerer. Klikk og dra for å tegne.';
    $('.signwrap').classList.toggle('draw', v === 'edit');
    App.refreshDisplay();
  };
  App.refreshDisplay = function () {
    const d = App.display; if (!d) return;
    if (App.transient) { d.set(App.transient, { ghost: null }); }
    else if (App.view === 'edit') {
      const p = App.project, onion = $('#optOnion') && $('#optOnion').checked && p.sel > 0 && !App.playing ? p.frames[p.sel - 1] : null;
      d.set(App.frame(), { ghost: onion });
    } else d.set(App.twinFb, { ghost: null });
    d.alpha = P.BRIGHT_ALPHA[App.twin.brightness] || 1; d.draw();
    let n = 0; const fb = App.transient || (App.view === 'edit' ? App.frame() : App.twinFb); for (let i = 0; i < fb.length; i++) n += fb[i];
    $('#pxCount').textContent = n;
  };
  /** Vis et bilde midlertidig (forhåndsvisning uten å sende). */
  App.flash = function (fb, ms = 3000) {
    App.transient = fb; App.refreshDisplay(); clearTimeout(App._flashT);
    App._flashT = setTimeout(() => { App.transient = null; App.refreshDisplay(); }, ms);
  };

  // ---------- tilkobling ----------
  App.setLink = function (link) {
    if (App.link) App.detach();
    App.link = link;
    link.addEventListener('state', (e) => App.onState(e.detail));
    link.addEventListener('tx', (e) => App.onTx(e.detail));
    link.addEventListener('rx', (e) => App.onRx(e.detail));
    link.addEventListener('stats', () => App.emit('stats'));
    link.addEventListener('error', (e) => {
      App.toast('Seriell feil: ' + e.detail.message, 'err');
      if (App.log) App.log('FEIL: ' + e.detail.message);
      if (root.Diag) root.Diag.add('seriell', e.detail.message);
    });
  };
  App.detach = function () { App.link = null; };
  App.onState = function ({ state, kind }) {
    const chip = $('#chipLink'), dot = chip.querySelector('i'), txt = chip.querySelector('span');
    dot.className = 'dot ' + (state === 'tilkoblet' ? (kind === 'sim' ? 'sim' : 'on') : state === 'kobler' ? 'busy' : 'off');
    txt.textContent = state === 'tilkoblet' ? (kind === 'sim' ? 'SIMULATOR' : 'TILKOBLET') : state === 'kobler' ? 'KOBLER TIL…' : 'FRAKOBLET';
    $('#btnConnect').textContent = (state === 'tilkoblet' && kind === 'serial') ? 'KOBLE FRA' : 'KOBLE TIL SKILT';
    $('#btnSim').textContent = (state === 'tilkoblet' && kind === 'sim') ? 'STOPP SIMULATOR' : 'SIMULATOR';
    if (state === 'tilkoblet' && kind === 'serial') App.lostSerial = false;
    if (state === 'frakoblet' && kind === 'serial' && App.link && !App.link.userClosed) {      // brutt uten at brukeren koblet fra
      App.lostSerial = true;
      App.toast('Forbindelsen ble brutt' + (App.link.lastError ? ' (' + App.link.lastError + ')' : '') + '. Kobles til igjen automatisk når Uno-en er tilbake, eller trykk KOBLE TIL SKILT.', 'err');
    }
    App.emit('link-state', { state, kind });
  };
  App.onTx = function (d) {
    App.emit('tx', d);
    if ($('#optBlackout').checked && App.display) {                           // skiltet er mørkt mens det mottar data
      const real = d.packet.length * root.BYTE_MS * (App.link.kind === 'sim' ? App.link.speed : 1);
      App.display.setDim(0.08); clearTimeout(App._dimT); App._dimT = setTimeout(() => App.display.setDim(1), Math.max(45, real));
    }
  };
  App.onRx = function (d) {
    App.emit('rx', d);
    if (d.parsed.kind === 'ACK') {
      const note = App.twin.ingest(d.payload);
      $('#twinInfo').textContent = App.twinSummary();
      if (note) App.emit('twin-note', note);
    }
  };
  App.twinSummary = function () {
    const t = App.twin, np = Object.keys(t.pages).length, ng = Object.keys(t.gfx).length;
    if (!np && !ng) return 'tomt minne';
    return `${np} sider · ${ng} grafikkblokker · ${t.source || ''} · ${(t.order || []).length} i løkka`;
  };

  App.requireLink = function () {
    if (!App.link || !App.link.connected) { App.toast('Ikke tilkoblet. Koble til skiltet eller start simulatoren først.', 'err'); return false; }
    return true;
  };
  /** Send én kommando og rapporter i statuslinjen. */
  App.send = async function (data, label) {
    if (!App.requireLink()) return null;
    try {
      const r = await App.link.transact(data, { label });
      App.status(`${label || 'kommando'}: ${r.kind}${r.parsed.expected != null ? ' (forventet sjekksum 0x' + r.parsed.expected.toString(16).toUpperCase().padStart(2, '0') + ')' : ''} · ${r.ms.toFixed(0)} ms`);
      if (!r.ok) App.toast(`${label || 'Kommandoen'}: ${r.kind}`, 'err');
      return r;
    } catch (e) { App.toast(String(e.message || e), 'err'); return null; }
  };
  /** Kjør en plan med fremdrift. */
  App.runPlan = async function (plan, opt = {}) {
    if (!App.requireLink()) return { ok: false };
    const bar = $('#uBar'), info = $('#uInfo');
    const res = await App.link.runPlan(plan, (i, n, step, r) => {
      const pct = Math.round(i / n * 100); if (bar) bar.style.width = pct + '%';
      const msg = `${i}/${n} · ${step.label} · ${r.kind}`; if (info) info.textContent = msg; App.status(msg);
    }, opt.stopOnError !== false);
    if (bar) bar.style.width = res.ok ? '100%' : bar.style.width;
    if (res.ok) App.toast(opt.doneMsg || 'Ferdig', 'ok'); else App.toast(res.aborted ? 'Avbrutt' : `Stoppet: ${res.result ? res.result.kind : 'feil'} i steg ${res.at + 1} av ${plan.length}`, 'err');
    return res;
  };
  /** Vis et bilde på skiltet som én grafikkside. */
  App.showFrameOnSign = function (fb, label = 'Bilde') {
    const plan = P.animationPlan([fb], {}, { perGpage: 1, wait: 'Z', lag: 'K' });
    plan[plan.length - 1].label = 'Tidsplan A'; return App.runPlan(plan, { doneMsg: label + ' vist på skiltet' });
  };
  /** Vis en tekstside på skiltet (sletter først). */
  App.showPageOnSign = function (pageOpts, label = 'Tekst') {
    const o = Object.assign({ page: 'A' }, pageOpts);
    return App.runPlan([
      { label: 'Slett alt', data: P.cmd.deleteAll(), pause: 600 },
      { label: 'Side ' + o.page, data: P.cmd.page(o) },
      { label: 'Tidsplan A', data: P.cmd.schedule('A', P.ALWAYS.start, P.ALWAYS.end, o.page) },
    ], { doneMsg: label + ' vist på skiltet' });
  };

  App.rowsToFrame = P.frameFromRows; App.frameToRows = P.frameToRows;
  root.App = App;
})(window);
