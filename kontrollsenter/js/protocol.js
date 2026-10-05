/* AM03127-protokollen (Amplus / Clas Ohlson 36-2071).
   Ren logikk uten DOM, så den kan testes i Node og brukes i nettleseren.
   Pakke: <IDxx> + data + XOR(data) som to hex-tegn + <E>. 9600 8N1 (via Uno-bro med invertert logikk). */
(function (root) {
  'use strict';

  const W = 80, H = 7;

  // ---------- byte-hjelpere ----------
  function bytesOf(data) {
    if (data instanceof Uint8Array) return data;
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 0xff;
    return out;
  }
  function concat(...parts) {
    const arrs = parts.map(bytesOf);
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
  function checksum(data) { let x = 0; for (const b of bytesOf(data)) x ^= b; return hex2(x); }
  function packet(data, id = 0) { return concat('<ID' + hex2(id) + '>', data, checksum(data), '<E>'); }

  // Latin-1 U+00C0..U+00FF -> <Uxx> med xx = kode - 0x80 (Æ=U46, Ø=U58, Å=U45, æ=U66, ø=U78, å=U65)
  function encodeText(text) {
    let out = '';
    for (const ch of text) {
      const c = ch.codePointAt(0);
      out += (c >= 0xC0 && c <= 0xFF) ? '<U' + hex2(c - 0x80) + '>' : (c < 0x100 ? ch : '?');
    }
    return out;
  }

  // ---------- tabeller ----------
  const LEAD = [
    ['A', 'Umiddelbart'], ['B', 'Xopen (vokser fra midten)'], ['C', 'Gardin opp'], ['D', 'Gardin ned'],
    ['E', 'Scroll venstre'], ['F', 'Scroll høyre'], ['G', 'Vopen'], ['H', 'Vclose'], ['I', 'Scroll opp'],
    ['J', 'Scroll ned'], ['K', 'Hold'], ['L', 'Snø'], ['M', 'Twinkle'], ['N', 'Blokkflytt'], ['P', 'Tilfeldig'],
    ['Q', 'Penn: «Hello World»'], ['R', 'Penn: «Welcome»'], ['S', 'Penn: «Amplus»']];
  const LAG = LEAD.slice(0, 11);                         // utgående effekt: A-K
  const SPEED_SETS = { 1: 'ABCDE', 2: 'QRSTU', 3: 'abcde', 4: 'qrstu' };   // normal, blink, melodi 1-3
  const FONTS = [['A', '5x7 normal', true], ['B', '6x7 fet', true], ['C', '4x7 smal', true],
    ['D', '7x13 stor (for høyt skilt)', false], ['E', '5x8 lang (for høyt skilt)', false]];
  const COLORS = 'ABCDEFGHIJKLMNPQRS'.split('').map((c) => [c, !'DEFM'.includes(c)]);   // [kode, synlig på rødt skilt]
  const BRIGHTNESS = [['A', '100 %'], ['B', '75 %'], ['C', '50 %'], ['D', '25 %']];
  const BRIGHT_ALPHA = { A: 1, B: 0.75, C: 0.5, D: 0.25 };

  const waitSeconds = (c) => (c === 'A' ? 0.5 : c.charCodeAt(0) - 65);
  const waitLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const modeCode = (speed, kind) => SPEED_SETS[speed][kind];   // kind: 0 normal, 1 blink, 2-4 melodi 1-3

  // ---------- kommandoer ----------
  function pageData(o) {
    const p = Object.assign({ line: 1, page: 'A', lead: 'A', mode: 'a', wait: 'A', lag: 'A', font: 'A', color: 'B', col: 0, text: '' }, o);
    return `<L${p.line}><P${p.page}><F${p.lead}><M${p.mode}><W${p.wait}><F${p.lag}><A${p.font}><C${p.color}><N${hex2(p.col)}>${encodeText(p.text)}`;
  }
  const cmd = {
    deleteAll: () => '<D*>',
    brightness: (l) => `<B${l}>`,
    runPage: (p) => `<RP${p}>`,
    deleteLine: (line, page) => `<DL${line}P${page}>`,
    deleteSchedule: (n) => `<DT${n}>`,
    setId: (id) => '<ID' + hex2(id) + '>',   // OBS: setter skiltets ID. Ikke bruk uten at det er nødvendig.
    clock: (d) => {
      const wd = ((d.getDay() + 6) % 7) + 1;           // mandag = 01 ... søndag = 07
      const p2 = (n) => String(n).padStart(2, '0');
      return `<SC>${p2(d.getFullYear() % 100)}${p2(wd)}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    },
    schedule: (n, start, end, pages) => `<T${n}>${start}${end}${pages}`,   // start/slutt: ÅÅMMDDttmm
    page: pageData,
  };
  const ALWAYS = { start: '0001010000', end: '9912312359' };

  // ---------- grafikk ----------
  // En ramme er Uint8Array(560), indeks y*80+x. Én blokk = 32 x 8 piksler = 64 byte:
  // fire 8x8-enheter, 16 byte per enhet, radvis (2 byte per rad), 4 piksler per byte, venstre piksel i de høyeste bitene.
  const newFrame = () => new Uint8Array(W * H);
  function frameFromRows(rows) {
    const f = newFrame();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = rows[y][x] === '#' ? 1 : 0;
    return f;
  }
  function frameToRows(f) {
    const rows = [];
    for (let y = 0; y < H; y++) { let s = ''; for (let x = 0; x < W; x++) s += f[y * W + x] ? '#' : '.'; rows.push(s); }
    return rows;
  }
  function frameBlocks(f) {
    const blocks = [];
    for (let b = 0; b < 3; b++) {
      const data = new Uint8Array(64);
      let o = 0;
      for (let unit = 0; unit < 4; unit++) for (let row = 0; row < 8; row++) for (let half = 0; half < 2; half++) {
        let byte = 0;
        for (let k = 0; k < 4; k++) {
          const col = b * 32 + unit * 8 + half * 4 + k;
          const on = col < W && row < H && f[row * W + col];
          byte = (byte << 2) | (on ? 0b10 : 0b00);
        }
        data[o++] = byte;
      }
      blocks.push(data);
    }
    return blocks;
  }
  const graphicData = (gpage, blockNo, bytes) => concat(`<G${gpage}${blockNo}>`, bytes);

  // ---------- animasjonsplan (samme opplegg som animlib.load i Python) ----------
  // frames: liste med Uint8Array(560); holds: {bildeindeks: antall plasser}; opts: {perGpage, lead, lag, wait, mode, extras:{indeks:'<BA>'}}
  const MAX_SLOTS = 31;
  function scheduleOrder(n, holds) {
    const seq = [];
    for (let t = 0; t < n; t++) for (let k = 0; k < ((holds && holds[t]) || 1); k++) seq.push(t);
    return seq;
  }
  function animationPlan(frames, holds, o) {
    const opt = Object.assign({ perGpage: 2, lead: 'A', lag: 'K', wait: 'A', mode: 'a', extras: {} }, o);
    const letter = (i) => String.fromCharCode(65 + i);
    const plan = [{ label: 'Slett alt', data: cmd.deleteAll(), pause: 1000 }];
    frames.forEach((f, t) => {
      const gp = letter(Math.floor(t / opt.perGpage));
      const first = (t % opt.perGpage) * 3 + 1;
      frameBlocks(f).forEach((blk, b) => plan.push({ label: `Bilde ${t + 1}: grafikkblokk ${gp}${first + b}`, data: graphicData(gp, first + b, blk) }));
      const labels = [0, 1, 2].map((b) => `<G${gp}${first + b}>`).join('');
      plan.push({
        label: `Bilde ${t + 1}: side ${letter(t)}`,
        data: `<L1><P${letter(t)}><F${opt.lead}><M${opt.mode}><W${opt.wait}><F${opt.lag}>${(opt.extras && opt.extras[t]) || ''}${labels}`,
      });
    });
    const order = scheduleOrder(frames.length, holds);
    plan.push({ label: `Tidsplan A (${order.length} plasser)`, data: cmd.schedule('A', ALWAYS.start, ALWAYS.end, order.map(letter).join('')) });
    return plan;
  }

  function parseReply(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    const i = s.indexOf('NACK');
    if (i >= 0) return { kind: 'NACK', expected: s.length > i + 4 ? s.charCodeAt(i + 4) : null, raw: s };
    if (s.includes('ACK')) return { kind: 'ACK', raw: s };
    if (!bytes.length) return { kind: 'ingen svar', raw: '' };
    return { kind: 'støy', raw: s };
  }

  const Proto = {
    W, H, bytesOf, concat, hex2, checksum, packet, encodeText,
    LEAD, LAG, FONTS, COLORS, BRIGHTNESS, BRIGHT_ALPHA, SPEED_SETS, waitSeconds, waitLetters, modeCode,
    cmd, ALWAYS, MAX_SLOTS,
    newFrame, frameFromRows, frameToRows, frameBlocks, graphicData, scheduleOrder, animationPlan, parseReply,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Proto; else root.Proto = Proto;
})(typeof window !== 'undefined' ? window : globalThis);
