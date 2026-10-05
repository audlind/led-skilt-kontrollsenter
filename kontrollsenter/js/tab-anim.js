/* Fane ANIMASJON: bibliotek (med forhåndsvisning), tidslinje, generatorer og opplasting. */
(function (root) {
  'use strict';
  const { App, Proto: P } = root, $ = App.$, $$ = App.$$, W = 80, H = 7;
  const letter = (i) => String.fromCharCode(65 + i);

  // ---------- avspiller ----------
  const Player = {
    timer: null, key: null,
    play(key, frames, holds, opt) {
      this.stop();
      const order = P.scheduleOrder(frames.length, holds), speed = +$('#aSpeed').value || 1;
      if (!order.length) return;
      this.key = key; let i = 0; App.playing = true;
      const tick = () => {
        const idx = order[i];
        App.display.set(frames[idx], { ghost: null }); App.display.alpha = 1; App.display.draw();
        if (opt.onFrame) opt.onFrame(idx, i, order.length);
        i++;
        if (i >= order.length) { if (!$('#aLoop').checked && !opt.forceLoop) { this.timer = setTimeout(() => this.stop(), 500 / speed); return; } i = 0; }
        this.timer = setTimeout(tick, 500 / speed);
      };
      tick();
    },
    stop() {
      clearTimeout(this.timer); this.timer = null; const was = this.key; this.key = null; App.playing = false;
      $$('.tl.play').forEach((e) => e.classList.remove('play'));
      $$('[data-pv]').forEach((b) => { b.textContent = 'Forhåndsvis'; b.classList.remove('on'); });
      $('#aPlay').textContent = '▶ SPILL';
      if (was) App.refreshDisplay();
    },
  };
  App.Player = Player;

  // ---------- prosjekt ----------
  const P_ = () => App.project;
  function slots(p = P_()) { let n = 0; p.frames.forEach((_, i) => { n += p.holds[i] || 1; }); return n; }
  function newProject(name, frames, holds) { App.project = { name, frames, holds: holds || {}, sel: 0 }; App.undo = []; App.redo = []; changed(); }
  function changed() { renderTimeline(); App.emit('project-changed'); App.frameChanged(); }
  App.on('project-changed', () => {});

  function renderTimeline() {
    const p = P_(), tl = $('#timeline'); tl.innerHTML = '';
    p.frames.forEach((fb, i) => {
      const d = document.createElement('div'); d.className = 'tl' + (i === p.sel ? ' sel' : ''); d.dataset.i = i;
      const cv = document.createElement('canvas'); root.drawThumb(cv, fb, { cell: 4 }); d.appendChild(cv);
      d.insertAdjacentHTML('beforeend', `<div class="n"><span>${i + 1} · side ${letter(i)}</span>${(p.holds[i] || 1) > 1 ? `<span class="hold">×${p.holds[i]}</span>` : ''}</div>`);
      d.addEventListener('click', () => { Player.stop(); p.sel = i; if (App.view !== 'edit') App.setView('edit'); renderTimeline(); App.frameChanged(); });
      tl.appendChild(d);
    });
    const s = slots(p), secs = s * 0.5;
    $('#aSlots').textContent = s; $('#aSlots').style.color = s > 31 ? 'var(--err)' : ''; $('#aSecs').textContent = secs.toFixed(1);
    $('#aCount').textContent = p.frames.length; $('#aCount').style.color = p.frames.length > 26 ? 'var(--err)' : '';
    $('#aHold').value = p.holds[p.sel] || 1; $('#projName').textContent = '· ' + p.name;
    const sel = tl.children[p.sel]; if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  App.renderTimeline = renderTimeline;
  App.on('frame-changed', () => {   // oppdater bare miniatyren til valgt bilde
    const p = P_(), el = $('#timeline').children[p.sel]; if (el) root.drawThumb(el.querySelector('canvas'), App.frame(), { cell: 4 });
  });

  // ---------- knapper ----------
  const blank = () => P.newFrame();
  $('#aAdd').addEventListener('click', () => { const p = P_(); if (p.frames.length >= 26) return App.toast('Maks 26 bilder (sidene A–Z)', 'err'); Player.stop(); p.frames.splice(p.sel + 1, 0, blank()); shiftHolds(p.sel + 1, 1); p.sel++; changed(); });
  $('#aDup').addEventListener('click', () => { const p = P_(); if (p.frames.length >= 26) return App.toast('Maks 26 bilder (sidene A–Z)', 'err'); Player.stop(); p.frames.splice(p.sel + 1, 0, App.frame().slice()); shiftHolds(p.sel + 1, 1); p.sel++; changed(); });
  App.on('add-frame-copy', () => $('#aDup').click());
  $('#aDel').addEventListener('click', () => {
    const p = P_(); if (p.frames.length <= 1) { App.frame().fill(0); return changed(); }
    Player.stop(); p.frames.splice(p.sel, 1); shiftHolds(p.sel, -1); p.sel = Math.min(p.sel, p.frames.length - 1); changed();
  });
  /** d > 0: d bilder satt inn fra indeks `at` (hold flyttes opp). d < 0: bildet på `at` slettet (holdet fjernes, senere hold flyttes ned). */
  function shiftHolds(at, d) {
    const p = P_(), n = {};
    for (const [ks, v] of Object.entries(p.holds)) {
      const k = +ks;
      if (d > 0) n[k >= at ? k + d : k] = v;
      else { if (k === at) continue; n[k > at ? k + d : k] = v; }
    }
    p.holds = n;
  }
  function move(d) {
    const p = P_(), j = p.sel + d; if (j < 0 || j >= p.frames.length) return; Player.stop();
    [p.frames[p.sel], p.frames[j]] = [p.frames[j], p.frames[p.sel]];
    const a = p.holds[p.sel], b = p.holds[j]; if (a) p.holds[j] = a; else delete p.holds[j]; if (b) p.holds[p.sel] = b; else delete p.holds[p.sel];
    p.sel = j; changed();
  }
  $('#aLeft').addEventListener('click', () => move(-1)); $('#aRight').addEventListener('click', () => move(1));
  $('#aHold').addEventListener('change', (e) => { const p = P_(), v = Math.max(1, Math.min(6, +e.target.value || 1)); if (v > 1) p.holds[p.sel] = v; else delete p.holds[p.sel]; renderTimeline(); });
  $('#aNew').addEventListener('click', () => { Player.stop(); newProject('Uten navn', [blank()], {}); App.setView('edit'); });
  const goto = (d) => { const p = P_(); Player.stop(); p.sel = (p.sel + d + p.frames.length) % p.frames.length; if (App.view !== 'edit') App.setView('edit'); renderTimeline(); App.frameChanged(); };
  $('#aPrev').addEventListener('click', () => goto(-1)); $('#aNext').addEventListener('click', () => goto(1));
  App.animGoto = goto;

  function play() {
    if (Player.key === 'project') return Player.stop();
    const p = P_(); $('#aPlay').textContent = '■ PAUSE'; if (App.view !== 'edit') App.setView('edit');
    Player.play('project', p.frames, p.holds, { onFrame: (idx) => { $$('.tl').forEach((e) => e.classList.toggle('play', +e.dataset.i === idx)); } });
  }
  App.animToggle = play;
  $('#aPlay').addEventListener('click', play); $('#aStop').addEventListener('click', () => Player.stop());
  $('#aSpeed').addEventListener('change', () => { if (Player.key === 'project') { Player.stop(); play(); } });

  // ---------- generatorer ----------
  $$('[data-gen]').forEach((b) => b.addEventListener('click', () => {
    const p = P_(), n = Math.max(1, Math.min(25, +$('#gN').value || 1)), step = Math.max(1, +$('#gStep').value || 1), g = b.dataset.gen; Player.stop();
    if (g === 'scrollL' || g === 'scrollR') {
      if (p.frames.length + n > 26) return App.toast(`Det blir over 26 bilder (har ${p.frames.length}, legger til ${n})`, 'err');
      const base = App.frame(), out = [];
      for (let k = 1; k <= n; k++) { const f = base.slice(); App.shiftFrame(f, (g === 'scrollL' ? -1 : 1) * step * k, 0, true); out.push(f); }
      p.frames.splice(p.sel + 1, 0, ...out); shiftHolds(p.sel + 1, n); p.sel += 1;
    } else if (g === 'blink') {
      if (p.frames.length >= 26) return App.toast('Maks 26 bilder', 'err');
      p.frames.splice(p.sel + 1, 0, blank()); shiftHolds(p.sel + 1, 1); p.sel++;
    } else if (g === 'reverse') {
      p.frames.reverse(); const h = {}; Object.keys(p.holds).forEach((k) => { h[p.frames.length - 1 - k] = p.holds[k]; }); p.holds = h; p.sel = p.frames.length - 1 - p.sel;
    } else if (g === 'pingpong') {
      const mid = p.frames.slice(1, -1).reverse().map((f) => f.slice()); if (p.frames.length + mid.length > 26) return App.toast('Blir over 26 bilder', 'err');
      p.frames.push(...mid);
    }
    changed();
  }));

  // ---------- bibliotek ----------
  function presetToProject(pre) {
    const holds = {}; Object.entries(pre.holds || {}).forEach(([k, v]) => { holds[+k] = v; });
    return { name: pre.navn || pre.name, frames: pre.frames.map((r) => (typeof r[0] === 'string' ? P.frameFromRows(r) : Uint8Array.from(r))), holds };
  }
  function card(pre, user, idx) {
    const pr = presetToProject(pre), s = slots(pr), div = document.createElement('div'); div.className = 'preset';
    div.innerHTML = `<canvas></canvas><h4></h4><p></p><div class="stats">${pr.frames.length} bilder · ${s} plasser · ${(s * 0.5).toFixed(1)} s</div>
      <div class="row wrap"><button data-pv="1">Forhåndsvis</button><button data-ed="1">Rediger</button><button data-up="1" class="primary">Last opp</button>${user ? '<button data-rm="1" class="danger">Slett</button>' : ''}</div>`;
    div.querySelector('h4').textContent = pr.name; div.querySelector('p').textContent = pre.beskrivelse || '';
    const cv = div.querySelector('canvas'); root.drawThumb(cv, pr.frames[Math.min(1, pr.frames.length - 1)], { cell: 4 });
    let hov = null, hi = 0;
    div.addEventListener('mouseenter', () => { const order = P.scheduleOrder(pr.frames.length, pr.holds); hov = setInterval(() => { root.drawThumb(cv, pr.frames[order[hi++ % order.length]], { cell: 4 }); }, 500); });
    div.addEventListener('mouseleave', () => { clearInterval(hov); root.drawThumb(cv, pr.frames[Math.min(1, pr.frames.length - 1)], { cell: 4 }); });
    const key = (user ? 'u' : 'p') + (pre.id || idx), pvBtn = div.querySelector('[data-pv]');
    pvBtn.addEventListener('click', () => {
      if (Player.key === key) return Player.stop();
      Player.stop(); App.transient = null; if (App.view !== 'edit') App.setView('edit');
      Player.play(key, pr.frames, pr.holds, { forceLoop: true, onFrame: () => {} });
      pvBtn.textContent = '■ Stopp'; pvBtn.classList.add('on');            // etter play(), som nullstiller knappene via stop()
      App.status(`Forhåndsvisning: ${pr.name}`);
    });
    div.querySelector('[data-ed]').addEventListener('click', () => { Player.stop(); newProject(pr.name, pr.frames.map((f) => f.slice()), { ...pr.holds }); App.setView('edit'); App.toast(`«${pr.name}» lastet inn i tidslinjen`, 'ok'); });
    div.querySelector('[data-up]').addEventListener('click', () => upload(pr));
    const rm = div.querySelector('[data-rm]'); if (rm) rm.addEventListener('click', () => { const list = App.store.get('anims', []); list.splice(idx, 1); App.store.set('anims', list); renderLibs(); });
    return div;
  }
  function renderLibs() {
    const pl = $('#presetList'); pl.innerHTML = ''; (root.PRESETS || []).forEach((p, i) => pl.appendChild(card(p, false, i)));
    const ul = $('#userList'); ul.innerHTML = ''; const list = App.store.get('anims', []);
    if (!list.length) ul.innerHTML = '<div class="muted">Ingen lagrede ennå. Bruk «Lagre lokalt» under Opplasting.</div>';
    list.forEach((a, i) => ul.appendChild(card(a, true, i)));
  }

  // ---------- opplasting ----------
  const fill = (sel, opts, dflt) => { const el = $(sel); el.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); el.value = dflt; };
  fill('#uLead', P.LEAD.map(([c, n]) => [c, `${c} · ${n}`]), 'A');
  fill('#uLag', P.LAG.map(([c, n]) => [c, `${c} · ${n}`]), 'K');
  fill('#uWait', P.waitLetters.map((c) => [c, `${c} · ${P.waitSeconds(c)} s`]), 'A');
  async function upload(pr) {
    const proj = pr || P_();
    if (proj.frames.length > 26) return App.toast('Maks 26 bilder (sidene A–Z)', 'err');
    if (slots(proj) > 31) return App.toast(`${slots(proj)} plasser, men tidsplanen rommer bare 31. Reduser hold eller bilder.`, 'err');
    if (!App.requireLink()) return;
    Player.stop();
    const plan = P.animationPlan(proj.frames, proj.holds, { perGpage: +$('#uPer').value, lead: $('#uLead').value, lag: $('#uLag').value, wait: $('#uWait').value });
    const bytes = plan.reduce((n, s) => n + P.bytesOf(s.data).length + 11, 0);
    $('#uInfo').textContent = `${plan.length} kommandoer, ca. ${bytes} byte, ${(bytes * root.BYTE_MS / 1000).toFixed(1)} s på ledningen`;
    App.status(`Laster opp «${proj.name}»…`);
    await App.runPlan(plan, { doneMsg: `«${proj.name}» er lastet opp. Skiltet spiller den selv.` });
    App.setView('twin');
  }
  $('#aUpload').addEventListener('click', () => upload());
  $('#aAbort').addEventListener('click', () => { if (App.link) App.link.abort(); });

  // ---------- eksport / import / lagring ----------
  function serialise(p) { return { format: 'led-skilt-anim', version: 1, navn: p.name, frames: p.frames.map(P.frameToRows), holds: Object.fromEntries(Object.entries(p.holds)) }; }
  $('#aExport').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(serialise(P_()), null, 1)], { type: 'application/json' })); a.download = (P_().name || 'animasjon').replace(/\W+/g, '_') + '.json'; a.click();
  });
  $('#aImport').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      try {
        const j = JSON.parse(t); if (j.format !== 'led-skilt-anim') throw new Error('ukjent filformat');
        newProject(j.navn || f.name, j.frames.map(P.frameFromRows), Object.fromEntries(Object.entries(j.holds || {}).map(([k, v]) => [+k, v])));
        App.setView('edit'); App.toast('Importert: ' + (j.navn || f.name), 'ok');
      } catch (err) { App.toast('Kunne ikke importere: ' + err.message, 'err'); }
    });
    e.target.value = '';
  });
  $('#aSaveLib').addEventListener('click', () => {
    const name = prompt('Navn på animasjonen:', P_().name); if (!name) return;
    const s = serialise(P_()); s.navn = name; s.id = 'u' + Date.now(); const list = App.store.get('anims', []); list.push(s);
    if (!App.store.set('anims', list)) return App.toast('Fikk ikke lagret (nettleserlageret er fullt eller blokkert)', 'err');
    P_().name = name; renderTimeline(); renderLibs(); App.toast('Lagret lokalt', 'ok');
  });

  renderLibs(); renderTimeline();
})(window);
