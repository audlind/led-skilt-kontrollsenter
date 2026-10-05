/* Fane REFERANSE: tabeller og forklaringer bygget fra de samme dataene som protokollen bruker. */
(function (root) {
  'use strict';
  const { App, Proto: P } = root, $ = App.$;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const table = (head, rows) => `<table class="ref"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const sec = (title, body, cls = '') => `<fieldset class="${cls}"><legend>${title}</legend><div class="helpbox">${body}</div></fieldset>`;

  const html = [
    sec('Slik fungerer det', `<p>Skiltet snakker en tekstbasert protokoll over seriell, 9600 baud 8N1. Linjene er <b>invertert</b> (hviler på 0 V), så en Arduino Uno snur signalet i programvare (<code>SoftwareSerial(2, 3, true)</code>) og er en USB-bro mellom PC og skilt.</p>
      <ul><li>Uno pin 2 ← skiltets TX · Uno pin 3 → skiltets RX · GND til GND · 5V kobles ikke.</li><li>Nettleseren åpner Uno-en direkte med Web Serial (Chrome/Edge).</li><li>Skiltet svarer <code>ACK</code>, eller <code>NACK</code> + riktig sjekksumbyte.</li></ul>`),
    sec('Pakken', `<p><code>&lt;ID00&gt;</code> + data + XOR-sjekksum (2 hex-tegn) + <code>&lt;E&gt;</code>. Sjekksummen er XOR av alle databyte, ikke ID-en.</p>
      <p>Eksempel: <code>&lt;ID00&gt;&lt;D*&gt;6C&lt;E&gt;</code> sletter minnet. Hver byte tar ca. 1,04 ms, og skiltet er mørkt mens det mottar.</p>`, ''),
    sec('Inn-effekter (&lt;FX&gt;)', table(['Kode', 'Effekt'], P.LEAD.map(([c, n]) => [c, esc(n)])) + '<p class="muted">Ut-effekt godtar bare A–K. Q, R og S skriver faste ord og ignorerer din tekst.</p>'),
    sec('Hastighet og modus (&lt;MX&gt;)', table(['Hastighet', 'Normal', 'Blink', 'Melodi 1', 'Melodi 2', 'Melodi 3'], [1, 2, 3, 4].map((s) => [s + (s === 1 ? ' (raskest)' : s === 4 ? ' (tregest)' : ''), ...P.SPEED_SETS[s].split('')]))
      + `<p>Ventetid &lt;WX&gt;: A = 0,5 s, B = 1 s, C = 2 s, og ett sekund per bokstav opp til Z = 25 s.</p>`),
    sec('Fonter og farger', table(['Font', 'Størrelse', 'Virker'], P.FONTS.map(([c, n, ok]) => [c, esc(n), ok ? '<span class="yes">ja</span>' : '<span class="no">kuttet på 7 rader</span>']))
      + table(['Fargekode', 'Synlig på rødt skilt'], P.COLORS.map(([c, v]) => [c, v ? '<span class="yes">ja</span>' : '<span class="no">nei (grønn)</span>']))),
    sec('Norske tegn (&lt;Uxx&gt;)', `<p>Tegnkoden er Latin-1-koden minus 0x80. <code>&lt;U40&gt;</code> til <code>&lt;U7F&gt;</code> dekker À til ÿ. Kontrollsenteret gjør dette automatisk.</p>
      ${table(['Tegn', 'Kode'], [['Å', '&lt;U45&gt;'], ['Æ', '&lt;U46&gt;'], ['Ø', '&lt;U58&gt;'], ['å', '&lt;U65&gt;'], ['æ', '&lt;U66&gt;'], ['ø', '&lt;U78&gt;']])}
      <div class="form"><label>Prøv en tekst<input type="text" id="encIn" value="Blåbærsyltetøy på Ørlandet"></label></div><pre class="packet" id="encOut"></pre>`),
    sec('Grafikk', `<p>Én blokk = 32 × 8 piksler = 64 byte: fire 8×8-enheter etter hverandre, 16 byte per enhet, radvis (2 byte per rad), 4 piksler per byte med venstre piksel i de to høyeste bitene.</p>
      ${table(['Verdi', 'Betydning'], [['00', 'av'], ['01', 'grønn (usynlig her)'], ['10', 'rød'], ['11', 'gul (lyser rødt)']])}
      <p>Skjermen er 80 kolonner, så tre blokker dekker den. Rad 8 vises ikke. Bruk bare <code>&lt;GA1&gt;&lt;GA2&gt;&lt;GA3&gt;</code> i siden for grafikk.</p>`),
    sec('Grenser som er målt', table(['Egenskap', 'Verdi'], [['Skjerm', '80 × 7 piksler'], ['Meldingslengde', '975 tegn tekst (1012 byte data)'], ['Sider', 'A–Z (26)'], ['Tidsplaner', 'A–E, opptil 31 sider hver, sider kan gjentas'], ['Grafikk', 'sider A–M testet med to bilder per side (blokk 1–6)'], ['Raskest bilde', '0,5 s per side (ventetid A)'], ['Skilt-ID', '00'], ['Minne', 'Sider, kjøreside og klokke overlever strømbrudd']])),
    sec('Visningsregler som ikke er åpenbare', `<ul>
      <li><b>Kjøreside (&lt;RPn&gt;)</b> blir stående selv etter «Slett alt», og da vises bare den siden. Bruk en tidsplan for animasjoner.</li>
      <li><b>Utgående effekt Hold (K)</b> gir blinkefrie animasjoner. Med A blir skjermen tom mellom bildene.</li>
      <li><b>Mørketid:</b> skiltet er mørkt mens det mottar data. 80 byte tar ca. 83 ms. Mål: 12 byte gir 92 % lys, 80 byte ved 10/s gir 33 %. Se «Display duty» i instrumentene.</li>
      <li>Grafikksider vises bare hvis siden inneholder grafikkreferansene alene, uten font-, farge- og kolonnekoder foran.</li></ul>`),
    sec('Hurtigtaster', table(['Tast', 'Gjør'], [['1–5', 'bytt fane'], ['Ctrl+K', 'kommandopalett'], ['Mellomrom', 'spill/stopp animasjonen'], ['← →', 'forrige/neste bilde (animasjon)'], ['P E L R B F M', 'penn, viskelær, linje, rektangel, fylt rektangel, fyll, flytt (på fanen TEGN)'], ['Ctrl+Z / Ctrl+Y', 'angre/gjenta'], ['Høyreklikk', 'visk ut med pennen']])),
  ];
  $('#helpBody').innerHTML = html.join('');
  const upd = () => { const t = $('#encIn').value; $('#encOut').textContent = P.encodeText(t); };
  $('#encIn').addEventListener('input', upd); upd();
})(window);
