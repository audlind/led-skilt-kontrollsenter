// Node-test: JavaScript-protokollen må gi nøyaktig samme bytes som Python-implementasjonen.
//   python tools/dump_expected.py   (lager expected.json)
//   node tools/test_protocol.js
const fs = require('fs');
const path = require('path');
const Proto = require('../js/protocol.js');

const exp = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'));
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../js/presets.js'), 'utf8'));
const hex = (u8) => Buffer.from(u8).toString('hex');
let fail = 0, ok = 0;
const check = (name, a, b) => { if (a === b) ok++; else { fail++; console.log('FEIL', name, '\n  js:     ', a, '\n  python: ', b); } };

// 1) blokker for alle forhåndsbilder
for (const e of exp.blocks) {
  const p = window.PRESETS.find((x) => x.id === e.id);
  const blocks = Proto.frameBlocks(Proto.frameFromRows(p.frames[e.frame]));
  blocks.forEach((b, i) => check(`${e.id}[${e.frame}] blokk ${i + 1}`, hex(b), e.blocks[i]));
}
// 2) pakker
check('pakke slett', hex(Proto.packet('<D*>')), exp.samples.slett);
check('encode', Proto.encodeText('Hei på deg: Æ Ø Å æ ø å'), exp.samples.encode);
check('pakke side', hex(Proto.packet('<L1><PA><FE><Ma><WA><FE><AA><CB><N00>' + Proto.encodeText('Hei på deg: Æ Ø Å'))), exp.samples.side);
// 3) opplastingsplan for Pong
const pong = window.PRESETS.find((x) => x.id === 'pong');
const frames = pong.frames.map(Proto.frameFromRows);
const holds = {}; for (const [k, v] of Object.entries(pong.holds)) holds[+k] = v;
const plan = Proto.animationPlan(frames, holds, { perGpage: 2, extras: { 5: '<BA>', 15: '<BA>' } });
check('plan lengde', plan.length, exp.pong_plan.length);
plan.forEach((s, i) => check(`plan[${i}] ${s.label}`, hex(Proto.bytesOf(s.data)), exp.pong_plan[i]));
// 4) klokke, ukedag (mandag = 01)
check('klokke mandag', Proto.cmd.clock(new Date(2026, 9, 5, 22, 30, 45)), '<SC>26011005223045');
check('klokke søndag', Proto.cmd.clock(new Date(2026, 9, 4, 8, 5, 9)), '<SC>26071004080509');
console.log(`${ok} sjekker OK, ${fail} feil`);
process.exit(fail ? 1 : 0);
