/* Digital tvilling: en modell av skiltets minne og avspilling. Mater alle ACK-ede kommandoer inn og spiller av
   sider, grafikk og tidsplaner som skiltet gjør (0,5 s per side som minimum, hold, løkke). Effekter simuleres ikke. */
(function (root) {
  'use strict';
  const P = root.Proto, Font = root.PixelFont, W = 80, H = 7;
  const str = (b) => { let s = ''; for (const c of b) s += String.fromCharCode(c); return s; };

  /** Dekoder en 64-byte blokk tilbake til 32 x 8 piksler (motsatt av Proto.frameBlocks). */
  function decodeBlock(bytes, blockIndex, fb) {
    let o = 0;
    for (let unit = 0; unit < 4; unit++) for (let row = 0; row < 8; row++) for (let half = 0; half < 2; half++) {
      const byte = bytes[o++];
      for (let k = 0; k < 4; k++) {
        const v = (byte >> (6 - 2 * k)) & 3;                            // 10 og 11 lyser (rødt)
        const col = blockIndex * 32 + unit * 8 + half * 4 + k;
        if (col < W && row < H && (v & 2)) fb[row * W + col] = 1;
      }
    }
  }

  class Twin extends EventTarget {
    constructor() {
      super();
      this.reset();
      this.timer = null;
      this.brightness = 'A';
    }
    reset() { this.pages = {}; this.gfx = {}; this.sched = {}; this.runPage = null; this.cursor = -1; this.current = null; this.history = []; }

    /** Mat inn en kommando (payload uten ID/sjekksum/<E>) som skiltet har kvittert med ACK. */
    ingest(payload) {
      const b = P.bytesOf(payload), s = str(b);
      let note = '';
      if (s.startsWith('<D*>')) { this.reset(); note = 'minnet slettet'; }
      else if (/^<B[A-D]>$/.test(s)) { this.brightness = s[2]; note = 'lysstyrke ' + s[2]; this.emit('brightness'); }
      else if (/^<RP[A-Z]>$/.test(s)) { this.runPage = s[3]; note = 'kjøreside ' + s[3]; }
      else if (/^<DT[A-E]>$/.test(s)) { delete this.sched[s[3]]; note = 'tidsplan ' + s[3] + ' slettet'; }
      else if (/^<DL\dP[A-Z]>$/.test(s)) { delete this.pages[s[5]]; note = 'side ' + s[5] + ' slettet'; }
      else if (s.startsWith('<SC>')) { note = 'klokke satt'; }
      else if (/^<G[A-Z]\d>/.test(s)) {
        const gp = s[2], n = +s[3];
        this.gfx[gp + n] = b.slice(5, 69); note = `grafikkblokk ${gp}${n}`;
      } else if (/^<T[A-E]>/.test(s)) {
        const n = s[2], m = /^(\d{10})(\d{10})([A-Z]*)$/.exec(s.slice(4));
        if (m) { this.sched[n] = { start: m[1], end: m[2], pages: m[3].split('') }; note = `tidsplan ${n}: ${m[3]}`; }
      } else if (/^<L\d><P[A-Z]>/.test(s)) {
        const m = /^<L(\d)><P([A-Z])><F(.)><M(.)><W(.)><F(.)>([\s\S]*)$/.exec(s);
        if (m) { this.pages[m[2]] = { line: +m[1], lead: m[3], mode: m[4], wait: m[5], lag: m[6], body: m[7] }; note = 'side ' + m[2]; }
      }
      this.restart();
      return note;
    }
    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

    // --- hvilken rekkefølge spilles av nå? ---
    activeOrder(now = new Date()) {
      const p2 = (n) => String(n).padStart(2, '0');
      const stamp = p2(now.getFullYear() % 100) + p2(now.getMonth() + 1) + p2(now.getDate()) + p2(now.getHours()) + p2(now.getMinutes());
      for (const n of Object.keys(this.sched).sort()) {
        const t = this.sched[n];
        if (stamp >= t.start && stamp <= t.end) return { source: 'tidsplan ' + n, pages: t.pages.filter((p) => this.pages[p]) };
      }
      if (this.runPage && this.pages[this.runPage]) return { source: 'kjøreside ' + this.runPage, pages: [this.runPage] };
      return { source: 'alle sider', pages: Object.keys(this.pages).sort() };
    }

    // --- tegning av en side til ramme ---
    renderPage(letter) {
      const pg = this.pages[letter], fb = new Uint8Array(W * H);
      if (!pg) return fb;
      const body = pg.body;
      const refs = [...body.matchAll(/<G([A-Z])(\d)>/g)];
      if (refs.length) {
        refs.forEach((m, i) => { const blk = this.gfx[m[1] + m[2]]; if (blk) decodeBlock(blk, i, fb); });
        return fb;
      }
      const col = parseInt((/<N([0-9A-F]{2})>/.exec(body) || [0, '00'])[1], 16);
      let text = body.replace(/<[ABCN][A-Z0-9]{1,2}>/g, '');
      text = text.replace(/<K[TD]>/g, (t) => (t === '<KT>' ? '12:00' : '01/01/26'));
      text = text.replace(/<U([0-9A-F]{2})>/g, (_, h) => String.fromCharCode(parseInt(h, 16) + 0x80));
      text = text.replace(/<[A-Z]{1,3}[0-9A-Z]*>/g, '');
      const rows = Font.render(text);
      for (let y = 0; y < H; y++) for (let x = 0; x < rows[y].length; x++) {
        const px = col + x;
        if (px >= 0 && px < W && rows[y][x] === '#') fb[y * W + px] = 1;
      }
      return fb;
    }

    // --- avspilling ---
    restart() {
      this.stop();
      const { source, pages } = this.activeOrder();
      this.order = pages; this.source = source; this.cursor = -1;
      this.emit('order', { source, pages });
      if (!pages.length) { this.current = null; this.emit('frame', { fb: new Uint8Array(W * H), page: null }); return; }
      this.step();
    }
    step() {
      if (!this.order.length) return;
      this.cursor = (this.cursor + 1) % this.order.length;
      const letter = this.order[this.cursor], pg = this.pages[letter];
      this.current = letter;
      this.emit('frame', { fb: this.renderPage(letter), page: letter, index: this.cursor, total: this.order.length });
      const ms = Math.max(500, P.waitSeconds(pg ? pg.wait : 'A') * 1000);
      this.timer = setTimeout(() => this.step(), this.order.length === 1 ? Math.max(ms, 500) : ms);
    }
    stop() { clearTimeout(this.timer); this.timer = null; }
  }
  root.Twin = Twin; root.decodeBlock = decodeBlock;
})(window);
