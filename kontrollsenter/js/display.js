/* Gjenskaper skiltet (svart ramme, 80 x 7 punkter, røde LED-er) på et canvas. Brukes også som tegneflate. */
(function (root) {
  'use strict';
  const W = 80, H = 7, LW = 1000, LH = 145;           // logiske mål; forholdet er hentet fra bildet av skiltet
  const DOT_X0 = 77.5, PITCH = 845 / 80, DOT_Y0 = (LH - H * PITCH) / 2;

  class SignDisplay {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.fb = new Uint8Array(W * H); this.ghost = null; this.alpha = 1; this.dim = 1; this.hover = null; this.grid = false; this.overlay = null;
      this.dirty = true;
      // Reager bare når bredden endres, og utsett til neste bilde: å endre høyden på lerretet endrer høyden på foreldreelementet,
      // og da fyrer observatøren på nytt (gir «ResizeObserver loop» og en uendelig løkke).
      this.lastW = 0;
      new ResizeObserver(() => requestAnimationFrame(() => { if (this.canvas.parentElement.clientWidth !== this.lastW) this.resize(); })).observe(canvas.parentElement);
      this.resize();
    }
    resize() {
      const dpr = window.devicePixelRatio || 1, w = this.canvas.parentElement.clientWidth;
      if (!w) return; this.lastW = w;
      this.canvas.style.width = w + 'px'; this.canvas.style.height = (w * LH / LW) + 'px';
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(w * LH / LW * dpr);
      this.scale = this.canvas.width / LW; this.invalidate();
    }
    invalidate() { this.draw(); }
    set(fb, opts = {}) { this.fb = fb; this.ghost = opts.ghost || null; this.alpha = opts.alpha == null ? this.alpha : opts.alpha; this.draw(); }
    setDim(d) { if (this.dim !== d) { this.dim = d; this.draw(); } }
    setAlpha(a) { this.alpha = a; this.draw(); }

    cellAt(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const lx = (clientX - r.left) / r.width * LW, ly = (clientY - r.top) / r.height * LH;
      const x = Math.floor((lx - DOT_X0) / PITCH), y = Math.floor((ly - DOT_Y0) / PITCH);
      return (x >= 0 && x < W && y >= 0 && y < H) ? { x, y } : null;
    }

    draw() {
      const c = this.ctx, s = this.scale;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.setTransform(s, 0, 0, s, 0, 0);
      // ytre kabinett
      this.rr(c, 4, 6, LW - 8, LH - 12, 22);
      const g = c.createLinearGradient(0, 0, 0, LH); g.addColorStop(0, '#2a2b2d'); g.addColorStop(0.12, '#0d0d0e'); g.addColorStop(1, '#050505');
      c.fillStyle = g; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#3a3b3d'; c.stroke();
      // glassflate
      this.rr(c, 40, 22, LW - 80, LH - 44, 10); c.fillStyle = '#101011'; c.fill();
      c.lineWidth = 1; c.strokeStyle = '#1f2022'; c.stroke();
      // modulskiller hver 5. kolonne
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.8;
      for (let m = 5; m < W; m += 5) { const x = DOT_X0 + m * PITCH; c.beginPath(); c.moveTo(x, DOT_Y0 - 6); c.lineTo(x, DOT_Y0 + H * PITCH + 6); c.stroke(); }
      // punkter
      const r = PITCH * 0.34, a = this.alpha * this.dim;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const cx = DOT_X0 + (x + 0.5) * PITCH, cy = DOT_Y0 + (y + 0.5) * PITCH, on = this.fb[y * W + x];
        if (on) {
          c.save(); c.shadowColor = `rgba(255,40,60,${0.9 * a})`; c.shadowBlur = PITCH * 1.1 * s;
          c.beginPath(); c.arc(cx, cy, r, 0, 6.2832);
          const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r);
          rg.addColorStop(0, `rgba(255,170,175,${a})`); rg.addColorStop(0.45, `rgba(255,45,62,${a})`); rg.addColorStop(1, `rgba(200,10,30,${a})`);
          c.fillStyle = rg; c.fill(); c.restore();
        } else {
          c.beginPath(); c.arc(cx, cy, r, 0, 6.2832);
          const gg = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
          gg.addColorStop(0, '#6f706d'); gg.addColorStop(1, '#45463f'); c.fillStyle = gg; c.fill();
          if (this.ghost && this.ghost[y * W + x]) { c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fillStyle = 'rgba(255,60,80,0.28)'; c.fill(); }
        }
      }
      if (this.grid) { c.strokeStyle = 'rgba(80,200,255,0.25)'; c.lineWidth = 0.6; for (let x = 0; x <= W; x += 8) { const px = DOT_X0 + x * PITCH; c.beginPath(); c.moveTo(px, DOT_Y0); c.lineTo(px, DOT_Y0 + H * PITCH); c.stroke(); } }
      if (this.hover) { const { x, y } = this.hover; c.strokeStyle = '#35c8ff'; c.lineWidth = 1.4; c.strokeRect(DOT_X0 + x * PITCH + 1, DOT_Y0 + y * PITCH + 1, PITCH - 2, PITCH - 2); }
      if (this.overlay) { c.fillStyle = 'rgba(53,200,255,0.9)'; c.font = '9px monospace'; c.fillText(this.overlay, DOT_X0, DOT_Y0 - 9); }
      // glassrefleks og typeskilt
      const gl = c.createLinearGradient(0, 22, 0, LH); gl.addColorStop(0, 'rgba(255,255,255,0.05)'); gl.addColorStop(0.45, 'rgba(255,255,255,0.0)');
      this.rr(c, 40, 22, LW - 80, LH - 44, 10); c.fillStyle = gl; c.fill();
      c.fillStyle = '#6b6d70'; c.font = '8px monospace'; c.fillText('AM03127-H11  7x80', LW - 160, LH - 10);
    }
    rr(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
  }

  /** Liten miniatyr av en ramme (for tidslinjen). */
  function drawThumb(canvas, fb, opts = {}) {
    const cell = opts.cell || 3, c = canvas.getContext('2d');
    canvas.width = W * cell; canvas.height = H * cell;
    c.fillStyle = '#0a0a0b'; c.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      c.fillStyle = fb[y * W + x] ? '#ff3b4a' : '#26272a'; c.fillRect(x * cell, y * cell, cell - 1, cell - 1);
    }
  }
  root.SignDisplay = SignDisplay; root.drawThumb = drawThumb;
})(window);
