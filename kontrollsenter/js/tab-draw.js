/* Fane TEGN: pikselstudio. Selve skiltet på skjermen er tegneflaten (REDIGERING). */
(function (root) {
  'use strict';
  const { App, Proto: P, PixelFont: Font } = root, $ = App.$, $$ = App.$$, W = 80, H = 7;
  let tool = 'pen', drag = null, snapshotBase = null;

  const get = (f, x, y) => f[y * W + x];
  const put = (f, x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) f[y * W + x] = v; };
  const mirrorOn = () => $('#optMirror').checked;
  function plot(f, x, y, v) { put(f, x, y, v); if (mirrorOn()) put(f, W - 1 - x, y, v); }

  function line(f, x0, y0, x1, y1, v) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(f, x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function rect(f, x0, y0, x1, y1, fillIt, v) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (fillIt || x === Math.min(x0, x1) || x === Math.max(x0, x1) || y === Math.min(y0, y1) || y === Math.max(y0, y1)) plot(f, x, y, v);
    }
  }
  function flood(f, x, y, v) {
    const target = get(f, x, y); if (target === v) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= W || cy < 0 || cy >= H || get(f, cx, cy) !== target) continue;
      f[cy * W + cx] = v; stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function shift(f, dx, dy, wrap) {
    const src = f.slice(); f.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let nx = x + dx, ny = y + dy;
      if (wrap) { nx = (nx % W + W) % W; ny = (ny % H + H) % H; }
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) f[ny * W + nx] = src[y * W + x];
    }
  }
  App.shiftFrame = shift;

  // ---------- peker ----------
  const canvas = $('#signCanvas');
  canvas.addEventListener('pointermove', (e) => {
    const c = App.display.cellAt(e.clientX, e.clientY);
    $('#curPos').textContent = c ? `x${c.x} y${c.y}` : '–';
    if (App.view === 'edit') { App.display.hover = c; App.display.draw(); }
    if (drag && c) handle(c, e);
  });
  canvas.addEventListener('pointerleave', () => { App.display.hover = null; if (App.view === 'edit') App.display.draw(); });
  canvas.addEventListener('contextmenu', (e) => { if (App.view === 'edit') e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (App.view !== 'edit') return;
    const c = App.display.cellAt(e.clientX, e.clientY); if (!c) return;
    canvas.setPointerCapture(e.pointerId);
    App.snapshot();
    const erase = e.button === 2 || e.ctrlKey || tool === 'erase';
    drag = { start: c, last: c, v: erase ? 0 : 1, base: App.frame().slice() };
    if (tool === 'fill') { flood(App.frame(), c.x, c.y, drag.v ? 1 : 0); drag = null; App.frameChanged(); return; }
    handle(c, e);
  });
  window.addEventListener('pointerup', () => { if (drag) { drag = null; App.frameChanged(); } });
  function handle(c, e) {
    const f = App.frame();
    if (tool === 'pen' || tool === 'erase') { line(f, drag.last.x, drag.last.y, c.x, c.y, drag.v); drag.last = c; }
    else if (tool === 'line' || tool === 'rect' || tool === 'rectf') {
      f.set(drag.base);
      if (tool === 'line') line(f, drag.start.x, drag.start.y, c.x, c.y, drag.v); else rect(f, drag.start.x, drag.start.y, c.x, c.y, tool === 'rectf', drag.v);
    } else if (tool === 'move') {
      f.set(drag.base); shift(f, c.x - drag.start.x, c.y - drag.start.y, $('#optWrap').checked);
    }
    App.refreshDisplay();
  }

  // ---------- verktøy og operasjoner ----------
  $('#toolSeg').addEventListener('click', (e) => { if (!e.target.dataset.tool) return; tool = e.target.dataset.tool; $$('#toolSeg button').forEach((b) => b.classList.toggle('on', b === e.target)); });
  const keyTool = { p: 'pen', e: 'erase', l: 'line', r: 'rect', b: 'rectf', f: 'fill', m: 'move' };
  App.toolKey = (k) => { if (keyTool[k]) { $(`#toolSeg [data-tool="${keyTool[k]}"]`).click(); return true; } return false; };

  function op(name) {
    const f = App.frame(), step = Math.max(1, +$('#shiftStep').value || 1), wrap = $('#optWrap').checked;
    if (name === 'undo') { const u = App.undo.pop(); if (!u) return; App.redo.push({ sel: App.project.sel, data: App.frame().slice() }); App.project.sel = u.sel; App.project.frames[u.sel].set(u.data); App.emit('project-changed'); App.frameChanged(); return; }
    if (name === 'redo') { const u = App.redo.pop(); if (!u) return; App.undo.push({ sel: App.project.sel, data: App.frame().slice() }); App.project.sel = u.sel; App.project.frames[u.sel].set(u.data); App.emit('project-changed'); App.frameChanged(); return; }
    App.snapshot();
    if (name === 'left') shift(f, -step, 0, wrap); if (name === 'right') shift(f, step, 0, wrap);
    if (name === 'up') shift(f, 0, -step, wrap); if (name === 'down') shift(f, 0, step, wrap);
    if (name === 'flipx') { const s = f.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = s[y * W + (W - 1 - x)]; }
    if (name === 'flipy') { const s = f.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = s[(H - 1 - y) * W + x]; }
    if (name === 'invert') for (let i = 0; i < f.length; i++) f[i] = f[i] ? 0 : 1;
    if (name === 'clear') f.fill(0);
    App.frameChanged();
  }
  $$('[data-op]').forEach((b) => b.addEventListener('click', () => op(b.dataset.op)));
  App.drawOp = op;
  $('#optGrid').addEventListener('change', (e) => { App.display.grid = e.target.checked; App.display.draw(); });
  $('#optOnion').addEventListener('change', () => App.refreshDisplay());

  // ---------- tekststempel ----------
  function stamp(center) {
    const rows = Font.render($('#stampText').value || ''), w = rows[0].length;
    const x0 = center ? Math.round((W - w) / 2) : +$('#stampX').value, y0 = center ? 0 : +$('#stampY').value;
    App.snapshot(); const f = App.frame();
    for (let y = 0; y < 7; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '#') put(f, x0 + x, y0 + y, 1);
    App.setView('edit'); App.frameChanged();
  }
  $('#stampBtn').addEventListener('click', () => stamp(false));
  $('#stampCenter').addEventListener('click', () => stamp(true));

  // ---------- bilde inn ----------
  let loaded = null;
  function applyImage() {
    if (!loaded) return;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if ($('#imgFit').value === 'stretch') c.drawImage(loaded, 0, 0, W, H);
    else { const s = Math.min(W / loaded.width, H / loaded.height), w = loaded.width * s, h = loaded.height * s; c.drawImage(loaded, (W - w) / 2, (H - h) / 2, w, h); }
    const d = c.getImageData(0, 0, W, H).data, thr = +$('#imgThr').value, inv = $('#imgInv').checked, dither = $('#imgDither').checked;
    const lum = new Float32Array(W * H); for (let i = 0; i < W * H; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const f = App.frame(); f.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, old = lum[i], on = old >= thr; f[i] = (on !== inv) ? 1 : 0;
      if (dither) { const err = old - (on ? 255 : 0); if (x + 1 < W) lum[i + 1] += err * 7 / 16; if (y + 1 < H) { if (x > 0) lum[i + W - 1] += err * 3 / 16; lum[i + W] += err * 5 / 16; if (x + 1 < W) lum[i + W + 1] += err / 16; } }
    }
    App.frameChanged();
  }
  $('#imgFile').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image(); img.onload = () => { loaded = img; App.snapshot(); App.setView('edit'); applyImage(); }; img.src = URL.createObjectURL(file);
  });
  ['#imgThr', '#imgInv', '#imgDither', '#imgFit'].forEach((s) => $(s).addEventListener('input', () => { $('#thrVal').textContent = $('#imgThr').value; if (loaded) applyImage(); }));

  // ---------- tekst inn/ut ----------
  $('#asciiGet').addEventListener('click', () => { $('#asciiBox').value = App.frameToRows(App.frame()).join('\n'); });
  $('#asciiCopy').addEventListener('click', () => { const t = App.frameToRows(App.frame()).join('\n'); navigator.clipboard && navigator.clipboard.writeText(t); App.toast('Kopiert'); });
  $('#asciiSet').addEventListener('click', () => {
    const lines = $('#asciiBox').value.split('\n'); App.snapshot(); const f = App.frame(); f.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = (lines[y] || '')[x] === '#' ? 1 : 0;
    App.setView('edit'); App.frameChanged();
  });

  // ---------- send / lagre ----------
  $('#drawSend').addEventListener('click', () => App.showFrameOnSign(App.frame(), 'Bildet'));
  $('#drawPng').addEventListener('click', () => {
    const cv = document.createElement('canvas'), s = 12; cv.width = W * s; cv.height = H * s; const c = cv.getContext('2d');
    c.fillStyle = '#0a0a0b'; c.fillRect(0, 0, cv.width, cv.height); const f = App.frame();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { c.fillStyle = f[y * W + x] ? '#ff3b4a' : '#2b2c2f'; c.beginPath(); c.arc(x * s + s / 2, y * s + s / 2, s * 0.38, 0, 6.2832); c.fill(); }
    const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'skilt-bilde.png'; a.click();
  });
  $('#drawToAnim').addEventListener('click', () => { App.emit('add-frame-copy'); App.toast('Kopiert som nytt bilde i animasjonen', 'ok'); });
  function renderSaved() {
    const list = App.store.get('frames', []), box = $('#savedFrames'); box.innerHTML = '';
    list.forEach((it, i) => {
      const d = document.createElement('div'); d.className = 'g'; const cv = document.createElement('canvas'); d.appendChild(cv);
      root.drawThumb(cv, P.frameFromRows(it.rows), { cell: 3 });
      d.insertAdjacentHTML('beforeend', `<div class="row"><span class="muted">${it.name}</span><span class="grow"></span><button class="tiny" data-l="${i}">Åpne</button><button class="tiny" data-d="${i}">Slett</button></div>`);
      box.appendChild(d);
    });
    box.onclick = (e) => {
      const l = e.target.dataset.l, dd = e.target.dataset.d, cur = App.store.get('frames', []);
      if (l != null) { App.snapshot(); App.frame().set(P.frameFromRows(cur[l].rows)); App.setView('edit'); App.frameChanged(); }
      if (dd != null) { cur.splice(+dd, 1); App.store.set('frames', cur); renderSaved(); }
    };
  }
  $('#drawSave').addEventListener('click', () => {
    const list = App.store.get('frames', []); list.push({ name: new Date().toLocaleTimeString('nb-NO'), rows: App.frameToRows(App.frame()) });
    App.store.set('frames', list); renderSaved(); App.toast('Lagret i biblioteket', 'ok');
  });
  renderSaved();
})(window);
