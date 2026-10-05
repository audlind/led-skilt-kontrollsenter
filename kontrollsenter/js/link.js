/* Transportlag: ekte USB-seriell (Web Serial) og simulator. Begge har samme grensesnitt.
   Hendelser: 'tx' {packet, payload, label, ms}, 'rx' {bytes, parsed, ms}, 'state' {state}, 'stats'. */
(function (root) {
  'use strict';
  const P = root.Proto;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BYTE_MS = 10 / 9.6;            // 9600 baud, 10 bit per byte = 1,04 ms per byte

  class LinkBase extends EventTarget {
    constructor() {
      super();
      this.state = 'frakoblet';          // frakoblet | kobler | tilkoblet
      this.kind = 'ingen';               // ingen | serial | sim
      this.tail = Promise.resolve();
      this.stats = { txBytes: 0, rxBytes: 0, packets: 0, ack: 0, nack: 0, other: 0, rtt: [], blackout: [] };   // blackout: [{t, ms}]
      this.aborted = false;
    }
    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
    setState(state) { this.state = state; this.emit('state', { state, kind: this.kind }); }
    get connected() { return this.state === 'tilkoblet'; }

    /** Send én kommando (data = streng eller bytes uten ID/sjekksum/slutt). Returnerer {ok, kind, parsed, ms}. */
    transact(data, opt = {}) {
      const run = async () => {
        if (!this.connected) throw new Error('Ikke tilkoblet');
        const id = opt.id == null ? 0 : opt.id;
        const payload = P.bytesOf(data);
        const pkt = opt.raw ? payload : P.packet(payload, id);
        const t0 = performance.now();
        this.emit('tx', { packet: pkt, payload, label: opt.label || '', t: Date.now() });
        this.stats.txBytes += pkt.length; this.stats.packets++;
        this.stats.blackout.push({ t: Date.now(), ms: pkt.length * BYTE_MS });
        const reply = await this._exchange(pkt, opt.timeout || 1500);
        const ms = performance.now() - t0;
        const parsed = P.parseReply(reply);
        this.stats.rxBytes += reply.length;
        if (parsed.kind === 'ACK') this.stats.ack++; else if (parsed.kind === 'NACK') this.stats.nack++; else this.stats.other++;
        this.stats.rtt.push(ms); if (this.stats.rtt.length > 50) this.stats.rtt.shift();
        this.emit('rx', { bytes: reply, parsed, ms, payload, label: opt.label || '', t: Date.now() });
        this.emit('stats', {});
        return { ok: parsed.kind === 'ACK', kind: parsed.kind, parsed, ms };
      };
      const p = this.tail.then(run, run);
      this.tail = p.catch(() => {});
      return p;
    }

    /** Kjør en liste med {label, data, pause}. onProgress(i, n, step, result). Stopper ved første ikke-ACK hvis stopOnError. */
    async runPlan(plan, onProgress, stopOnError = true) {
      this.aborted = false;
      for (let i = 0; i < plan.length; i++) {
        if (this.aborted) return { ok: false, aborted: true, at: i };
        const r = await this.transact(plan[i].data, { label: plan[i].label });
        if (onProgress) onProgress(i + 1, plan.length, plan[i], r);
        if (!r.ok && stopOnError) return { ok: false, at: i, result: r };
        if (plan[i].pause) await sleep(plan[i].pause * (this.speed || 1));
      }
      return { ok: true };
    }
    abort() { this.aborted = true; }

    /** Antall millisekunder siden-vindu der skiltet har vært mørkt pga. seriell mottak. */
    duty(windowMs = 10000) {
      const now = Date.now();
      this.stats.blackout = this.stats.blackout.filter((b) => now - b.t < windowMs + 5000);
      let dark = 0;
      for (const b of this.stats.blackout) {
        const s = Math.max(b.t - b.ms, now - windowMs), e = Math.min(b.t, now);
        if (e > s) dark += e - s;
      }
      return 1 - Math.min(1, dark / windowMs);
    }
    avgRtt() { const r = this.stats.rtt; return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; }
  }

  /** Ekte skilt via Uno-bro, Web Serial (Chrome/Edge). */
  class SerialLink extends LinkBase {
    constructor() { super(); this.kind = 'serial'; this.rx = []; this.waiters = []; this.lastError = null; this.closing = false; }
    static supported() { return 'serial' in navigator; }

    /** Lukk en port som er åpen fra før (for eksempel etter en brutt forbindelse), slik at den kan åpnes på nytt. */
    static async closeStale() {
      const cur = SerialLink.current;
      if (cur) { try { await cur.hardClose(); } catch (e) { /* ignorer */ } }
      let ports = []; try { ports = await navigator.serial.getPorts(); } catch (e) { /* ignorer */ }
      for (const p of ports) { if (p.readable || p.writable) { try { await p.close(); } catch (e) { /* låst av noe annet: ignorer */ } } }
    }
    /** Velg port: bruk den allerede godkjente Arduino-en uten å spørre, ellers vis nettleserens portvelger. */
    static async pickPort(choose) {
      if (!choose) {
        const granted = await navigator.serial.getPorts();
        const uno = granted.filter((p) => (p.getInfo().usbVendorId === 0x2341));
        if (uno.length === 1) return uno[0];
        if (granted.length === 1) return granted[0];
      }
      return navigator.serial.requestPort();
    }

    async connect(opt = {}) {
      if (!SerialLink.supported()) throw new Error('Web Serial støttes ikke i denne nettleseren. Bruk Chrome eller Edge.');
      await SerialLink.closeStale();
      this.port = await SerialLink.pickPort(opt.choose);
      this.closing = false; this.fatal = false; this.lastError = null; this.rx = [];
      this.setState('kobler');
      try { await this.port.open({ baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 }); }
      catch (e) { this.lastError = e.name + ': ' + e.message; this.setState('frakoblet'); throw e; }
      SerialLink.current = this;
      this.readDone = this.readLoop();
      await sleep(2500);                  // Uno-en resettes når porten åpnes
      this.rx = [];
      if (this.fatal) throw new Error('Porten ble lukket under oppstart: ' + this.lastError);
      this.setState('tilkoblet');
    }

    /** Leser kontinuerlig. Ikke-fatale feil (buffer, ramme, paritet, break) gir en ny leser. Fatale feil lukker porten ordentlig. */
    async readLoop() {
      const NONFATAL = ['BufferOverrunError', 'FramingError', 'ParityError', 'BreakError'];
      while (this.port.readable && !this.closing && !this.fatal) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) { for (const b of value) this.rx.push(b); this.waiters.forEach((w) => w()); }
          }
        } catch (e) {
          this.lastError = e.name + ': ' + e.message;
          const fatal = !NONFATAL.includes(e.name);
          this.emit('error', { message: `${e.name}: ${e.message}${fatal ? ' (fatal, forbindelsen er brutt)' : ' (ikke fatal, leseren startes på nytt)'}` });
          if (fatal) this.fatal = true;
        } finally { try { this.reader.releaseLock(); } catch (e) { /* ignorer */ } }
        if (!this.closing && !this.fatal && this.port.readable) await sleep(20);   // etter en ikke-fatal feil: gå videre med ny leser
      }
      // løkka er over: lukk porten, så den kan åpnes igjen
      if (!this.closing) { try { await this.port.close(); } catch (e) { /* ignorer */ } if (this.state !== 'frakoblet') this.setState('frakoblet'); }
    }

    async _exchange(pkt, timeout) {
      this.rx = [];
      try {
        const w = this.port.writable.getWriter();
        try { await w.write(pkt); } finally { w.releaseLock(); }
      } catch (e) {
        this.lastError = e.name + ': ' + e.message; this.fatal = true;
        this.emit('error', { message: `Skriving feilet: ${e.name}: ${e.message}` });
        this.hardClose().then(() => this.setState('frakoblet'));
        throw e;
      }
      const t0 = performance.now();
      for (;;) {
        const s = String.fromCharCode(...this.rx);
        if (s.includes('NACK')) { await sleep(35); break; }          // vent på forventet sjekksumbyte
        if (s.includes('ACK')) break;
        if (performance.now() - t0 > timeout) break;
        await new Promise((r) => { const f = () => { this.waiters = this.waiters.filter((x) => x !== f); r(); }; this.waiters.push(f); setTimeout(f, 8); });
      }
      return new Uint8Array(this.rx.splice(0));
    }

    /** Avslutter alt rent: leser, løkke og port. */
    async hardClose() {
      this.closing = true;
      try { if (this.reader) await this.reader.cancel(); } catch (e) { /* ignorer */ }
      try { if (this.readDone) await this.readDone; } catch (e) { /* ignorer */ }   // leseren må være frigitt før porten lukkes
      try { await this.port.close(); } catch (e) { /* ignorer */ }
      if (SerialLink.current === this) SerialLink.current = null;
    }
    async disconnect() { this.userClosed = true; this.setState('frakoblet'); await this.hardClose(); }
  }

  /** Simulator: svarer ACK på alt som ser riktig ut, med (valgfri) ekte seriell forsinkelse. */
  class SimLink extends LinkBase {
    constructor() { super(); this.kind = 'sim'; this.speed = 0.04; }   // speed 1 = ekte hastighet (1 ms per byte)
    async connect() { this.setState('kobler'); await sleep(250); this.setState('tilkoblet'); }
    async _exchange(pkt, timeout) {
      await sleep(Math.max(1, pkt.length * BYTE_MS * this.speed));
      // verifiser pakkeformatet som skiltet gjør: <IDxx> data cs <E>
      const s = String.fromCharCode(...pkt);
      const m = /^<ID([0-9A-F]{2})>([\s\S]*)([0-9A-F]{2})<E>$/.exec(s);
      if (!m) return new Uint8Array(0);
      if (m[1] !== '00') return new Uint8Array(0);                       // skiltets ID er 00
      const cs = P.checksum(P.bytesOf(m[2]));
      if (cs !== m[3]) return P.bytesOf('NACK' + String.fromCharCode(parseInt(cs, 16)));
      return P.bytesOf('ACK');
    }
    async disconnect() { this.setState('frakoblet'); }
  }

  root.SerialLink = SerialLink; root.SimLink = SimLink; root.sleep = sleep; root.BYTE_MS = BYTE_MS;
})(window);
