// S-DES (Simplified DES) page.
// Live trace of the full cipher: key schedule, IP, two Feistel rounds with
// S-box lookups, the swap, and IP⁻¹. Clicking any plaintext or key bit
// re-renders every intermediate value, so the page doubles as a worked
// example viewers can follow by hand alongside the lesson.

import './nav.js';

// Permutation tables — 1-indexed source positions, matching the lesson.
const P10 = [3, 5, 2, 7, 4, 10, 1, 9, 8, 6];
const P8  = [6, 3, 7, 4, 8, 5, 10, 9];
const IP  = [2, 6, 3, 1, 4, 8, 5, 7];
const IPI = [4, 1, 3, 5, 7, 2, 8, 6];
const EP  = [4, 1, 2, 3, 2, 3, 4, 1];
const P4  = [2, 4, 3, 1];

const S0 = [[1, 0, 3, 2], [3, 2, 1, 0], [0, 2, 1, 3], [3, 1, 3, 2]];
const S1 = [[0, 1, 2, 3], [2, 0, 1, 3], [3, 0, 1, 0], [2, 1, 0, 3]];

const permute = (bits, table) => table.map((p) => bits[p - 1]);
const rotl    = (bits, n)     => [...bits.slice(n), ...bits.slice(0, n)];
const xor     = (a, b)        => a.map((bit, i) => bit ^ b[i]);
const range   = (n)           => Array.from({ length: n }, (_, i) => i + 1);

// Source-position labels for a left-rotation of a 5-bit half.
const ROT1 = [2, 3, 4, 5, 1];
const ROT2 = [3, 4, 5, 1, 2];

function keySchedule(key) {
  const p10 = permute(key, P10);
  const c1  = rotl(p10.slice(0, 5), 1);
  const d1  = rotl(p10.slice(5), 1);
  const k1  = permute([...c1, ...d1], P8);
  const c2  = rotl(c1, 2);
  const d2  = rotl(d1, 2);
  const k2  = permute([...c2, ...d2], P8);
  return { p10, c1, d1, k1, c2, d2, k2 };
}

function sboxLookup(bitsIn, box) {
  const row = bitsIn[0] * 2 + bitsIn[3];   // outer bits pick the row
  const col = bitsIn[1] * 2 + bitsIn[2];   // inner bits pick the column
  const val = box[row][col];
  return { in: bitsIn, row, col, out: [(val >> 1) & 1, val & 1] };
}

function feistelRound(l, r, k) {
  const ep  = permute(r, EP);
  const mix = xor(ep, k);
  const s0  = sboxLookup(mix.slice(0, 4), S0);
  const s1  = sboxLookup(mix.slice(4), S1);
  const cat = [...s0.out, ...s1.out];
  const p4  = permute(cat, P4);
  return { l, r, ep, mix, s0, s1, cat, p4, newL: xor(l, p4) };
}

function sdes(input, roundKeys) {
  const ip = permute(input, IP);
  const r1 = feistelRound(ip.slice(0, 4), ip.slice(4), roundKeys[0]);
  const r2 = feistelRound(r1.r, r1.newL, roundKeys[1]);   // the swap happens here
  const pre = [...r2.newL, ...r2.r];
  return { ip, r1, r2, pre, out: permute(pre, IPI) };
}

// ── State ────────────────────────────────────────────────────────────────
// Defaults are the lesson's worked example: 11110000 under key 1010000010
// encrypts to 01101101.
let input = [1, 1, 1, 1, 0, 0, 0, 0];
let key   = [1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
let mode  = 'encrypt';

const $ = (id) => document.getElementById(id);

const els = {
  inTitle:    $('in-title'),
  inBits:     $('in-bits'),
  keyBits:    $('key-bits'),
  modeToggle: $('mode-toggle'),
  ioIn:       $('io-in'),
  ioInLabel:  $('io-in-label'),
  ioInVal:    $('io-in-val'),
  ioOut:      $('io-out'),
  ioOutLabel: $('io-out-label'),
  ioOutVal:   $('io-out-val'),
  ksStages:   $('ks-stages'),
  pipeTitle:  $('pipe-title'),
  pipeSub:    $('pipe-sub'),
  pipeStages: $('pipe-stages'),
};

// ── DOM helpers ──────────────────────────────────────────────────────────

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

// A column of: optional caption, optional gold source-position labels,
// the bit cells themselves, and optional dim position labels beneath.
function bitGroup(bits, role, opts = {}) {
  const g = el('div', 'sd-group');
  if (opts.caption) {
    g.appendChild(el('div', `sd-cap${opts.capHl ? ' hl-key' : ''}`, opts.caption));
  }
  if (opts.src) {
    const row = el('div', 'sd-lbl-row');
    for (const s of opts.src) row.appendChild(el('span', 'sd-src', s));
    g.appendChild(row);
  }
  const cells = el('div', 'sd-cells');
  bits.forEach((b, i) => {
    const cell = el('div',
      `bit-cell sd-bit role-${role} ${b ? 'b1' : 'b0'}${opts.onClick ? ' clickable' : ''}`);
    cell.appendChild(el('span', 'bv', b));
    if (opts.onClick) cell.addEventListener('click', () => opts.onClick(i));
    cells.appendChild(cell);
  });
  g.appendChild(cells);
  if (opts.pos) {
    const row = el('div', 'sd-lbl-row');
    for (const p of opts.pos) row.appendChild(el('span', 'sd-pos', p));
    g.appendChild(row);
  }
  return g;
}

function halves(...groups) {
  const wrap = el('div', 'sd-halves');
  groups.forEach((g) => wrap.appendChild(g));
  return wrap;
}

// A pipeline stage: name + note on the left, content on the right.
function stage(name, note, ...nodes) {
  const s = el('div', 'sd-stage');
  const label = el('div', 'sd-stage-label');
  label.appendChild(el('div', 'sd-stage-name', name));
  if (note) label.appendChild(el('div', 'sd-stage-note', note));
  s.appendChild(label);
  const body = el('div', 'sd-stage-body');
  nodes.forEach((n) => body.appendChild(n));
  s.appendChild(body);
  return s;
}

// Stacked rows of aligned bit cells with an operator gutter, for XORs.
function xorStack(rows) {
  const stack = el('div', 'sd-xstack');
  rows.forEach((r, i) => {
    if (i === rows.length - 1) stack.appendChild(el('div', 'sd-xline'));
    const row = el('div', 'sd-xrow');
    row.appendChild(el('span', 'sd-xop', r.op || ''));
    row.appendChild(el('span', 'sd-xlabel', r.label || ''));
    row.appendChild(bitGroup(r.bits, r.role));
    stack.appendChild(row);
  });
  return stack;
}

// 4×4 S-box table with the active row, column, and cell highlighted.
const bin2 = (n) => n.toString(2).padStart(2, '0');

function sboxPanel(title, box, lk) {
  const wrap = el('div', 'sbox-wrap');
  wrap.appendChild(el('div', 'sbox-title', title));

  const grid = el('div', 'sbox-grid');
  grid.appendChild(el('div', 'sbox-corner'));
  for (let c = 0; c < 4; c++) {
    grid.appendChild(el('div', `sbox-head${c === lk.col ? ' hl' : ''}`, bin2(c)));
  }
  for (let r = 0; r < 4; r++) {
    grid.appendChild(el('div', `sbox-head${r === lk.row ? ' hl' : ''}`, bin2(r)));
    for (let c = 0; c < 4; c++) {
      let cls = 'sbox-cell';
      if (r === lk.row && c === lk.col) cls += ' hl-cell';
      else if (r === lk.row) cls += ' hl-row';
      else if (c === lk.col) cls += ' hl-col';
      grid.appendChild(el('div', cls, bin2(box[r][c])));
    }
  }
  wrap.appendChild(grid);

  wrap.appendChild(el('div', 'sbox-cap',
    `input ${lk.in.join('')} — outer bits ${lk.in[0]}·${lk.in[3]} → row ${lk.row}, ` +
    `inner bits ${lk.in[1]}·${lk.in[2]} → column ${lk.col} → output ${lk.out.join('')}`));
  return wrap;
}

// One full Feistel round.
function roundPanel(n, rd, keyName, keyBits, names) {
  const panel = el('section', 'panel sd-round');
  panel.appendChild(el('h3', 'sd-round-title', `Round ${n} · round key ${keyName}`));

  panel.appendChild(stage('E/P', `expand ${names.r} from four bits to eight`,
    bitGroup(rd.ep, 'algo', { src: EP })));

  panel.appendChild(stage(`⊕ ${keyName}`, 'mix the round key in with XOR',
    xorStack([
      { op: '',  label: 'E/P',   bits: rd.ep,  role: 'algo' },
      { op: '⊕', label: keyName, bits: keyBits, role: 'key' },
      { op: '=', label: '',      bits: rd.mix, role: 'algo' },
    ])));

  const sboxes = el('div', 'sd-sboxes');
  sboxes.appendChild(sboxPanel('S0 — left four bits', S0, rd.s0));
  sboxes.appendChild(sboxPanel('S1 — right four bits', S1, rd.s1));
  sboxes.appendChild(bitGroup(rd.cat, 'algo', { caption: 'S0 out ‖ S1 out' }));
  panel.appendChild(stage('S-boxes',
    'each four-bit half shrinks to two bits via table lookup', sboxes));

  panel.appendChild(stage('P4', 'shuffle the four S-box output bits',
    bitGroup(rd.p4, 'algo', { src: P4 })));

  panel.appendChild(stage(`⊕ ${names.l}`, 'fold the result into the left half',
    xorStack([
      { op: '',  label: names.l,   bits: rd.l,    role: 'algo' },
      { op: '⊕', label: 'P4',      bits: rd.p4,   role: 'algo' },
      { op: '=', label: names.out, bits: rd.newL, role: 'algo' },
    ])));

  panel.appendChild(el('p', 'sd-note',
    `${names.r} passes through the round unchanged — it was only read, never ` +
    `written. That is what makes the round reversible.`));
  return panel;
}

// ── Render ───────────────────────────────────────────────────────────────

const bitsStr = (bits) =>
  bits.join('') + ' · 0x' +
  parseInt(bits.join(''), 2).toString(16).toUpperCase().padStart(2, '0');

function render() {
  const ks = keySchedule(key);
  const encrypting = mode === 'encrypt';
  const roundKeys  = encrypting ? [ks.k1, ks.k2] : [ks.k2, ks.k1];
  const keyNames   = encrypting ? ['K₁', 'K₂'] : ['K₂', 'K₁'];
  const t = sdes(input, roundKeys);

  const inRole  = encrypting ? 'plain'  : 'cipher';
  const outRole = encrypting ? 'cipher' : 'plain';
  const inName  = encrypting ? 'Plaintext'  : 'Ciphertext';
  const outName = encrypting ? 'Ciphertext' : 'Plaintext';

  // Controls
  els.inTitle.textContent = `${inName} (8 bits)`;
  els.inBits.innerHTML = '';
  els.inBits.appendChild(bitGroup(input, inRole, {
    pos: range(8),
    onClick: (i) => { input[i] ^= 1; render(); },
  }));
  els.keyBits.innerHTML = '';
  els.keyBits.appendChild(bitGroup(key, 'key', {
    pos: range(10),
    onClick: (i) => { key[i] ^= 1; render(); },
  }));
  els.modeToggle.textContent = encrypting ? 'Switch to decrypt' : 'Switch to encrypt';

  // Result summary
  els.ioIn.className  = `io-block ${encrypting ? 'plain' : 'cipher'}`;
  els.ioOut.className = `io-block ${encrypting ? 'cipher' : 'plain'}`;
  els.ioInLabel.textContent  = inName;
  els.ioOutLabel.textContent = outName;
  els.ioInVal.textContent  = bitsStr(input);
  els.ioOutVal.textContent = bitsStr(t.out);

  // Key schedule
  const k = els.ksStages;
  k.innerHTML = '';
  k.appendChild(stage('Key', 'the shared 10-bit secret',
    bitGroup(key, 'key', { pos: range(10) })));
  k.appendChild(stage('P10', 'shuffle all ten bits',
    bitGroup(ks.p10, 'key', { src: P10 })));
  k.appendChild(stage('Split', 'left five become C₀, right five become D₀',
    halves(
      bitGroup(ks.p10.slice(0, 5), 'key', { caption: 'C₀' }),
      bitGroup(ks.p10.slice(5), 'key', { caption: 'D₀' }),
    )));
  k.appendChild(stage('LS1', 'rotate each half left by one',
    halves(
      bitGroup(ks.c1, 'key', { caption: 'C₁', src: ROT1 }),
      bitGroup(ks.d1, 'key', { caption: 'D₁', src: ROT1 }),
    )));
  k.appendChild(stage('P8 → K₁', 'pick eight of the ten bits of C₁‖D₁',
    bitGroup(ks.k1, 'key', { caption: 'K₁ — round key one', capHl: true, src: P8 })));
  k.appendChild(stage('LS2', 'rotate each half left by two more',
    halves(
      bitGroup(ks.c2, 'key', { caption: 'C₂', src: ROT2 }),
      bitGroup(ks.d2, 'key', { caption: 'D₂', src: ROT2 }),
    )));
  k.appendChild(stage('P8 → K₂', 'same eight positions, applied to C₂‖D₂',
    bitGroup(ks.k2, 'key', { caption: 'K₂ — round key two', capHl: true, src: P8 })));

  // Pipeline
  els.pipeTitle.textContent = encrypting
    ? 'Encryption — through the pipeline'
    : 'Decryption — same pipeline, keys reversed';
  els.pipeSub.textContent = encrypting
    ? 'IP shuffles the block, two Feistel rounds do the real work with a swap in between, and IP⁻¹ returns every bit to its original seat.'
    : 'Decryption runs the identical machinery with the round keys in reverse: K₂ drives round one and K₁ drives round two, so each round un-does its counterpart from encryption.';

  const p = els.pipeStages;
  p.innerHTML = '';

  const intro = el('div', 'panel');
  intro.appendChild(stage(inName, 'the 8-bit input block',
    bitGroup(input, inRole, { pos: range(8) })));
  intro.appendChild(stage('IP', 'initial permutation — shuffle the eight bits',
    bitGroup(t.ip, 'algo', { src: IP })));
  intro.appendChild(stage('Split', 'left four become L₀, right four become R₀',
    halves(
      bitGroup(t.ip.slice(0, 4), 'algo', { caption: 'L₀' }),
      bitGroup(t.ip.slice(4), 'algo', { caption: 'R₀' }),
    )));
  p.appendChild(intro);

  p.appendChild(roundPanel(1, t.r1, keyNames[0], roundKeys[0],
    { l: 'L₀', r: 'R₀', out: 'L₁' }));

  const swap = el('div', 'panel');
  swap.appendChild(stage('Swap', 'the halves trade places between the rounds',
    halves(
      bitGroup(t.r1.r, 'algo', { caption: 'left = R₁' }),
      bitGroup(t.r1.newL, 'algo', { caption: 'right = L₁' }),
    )));
  p.appendChild(swap);

  p.appendChild(roundPanel(2, t.r2, keyNames[1], roundKeys[1],
    { l: 'R₁', r: 'L₁', out: 'L₂' }));

  const outro = el('div', 'panel');
  outro.appendChild(stage('Combine', 'L₂ on the left, R₂ on the right',
    bitGroup(t.pre, 'algo', { caption: 'L₂ ‖ R₂' })));
  outro.appendChild(stage(`IP⁻¹ → ${outName.toLowerCase()}`,
    'undo the initial permutation — every bit returns to its seat',
    bitGroup(t.out, outRole, { src: IPI, pos: range(8) })));
  p.appendChild(outro);
}

els.modeToggle.addEventListener('click', () => {
  // Carry the output across so decrypt immediately un-does the encryption
  // you were just looking at (and vice versa).
  const ks = keySchedule(key);
  const roundKeys = mode === 'encrypt' ? [ks.k1, ks.k2] : [ks.k2, ks.k1];
  input = sdes(input, roundKeys).out;
  mode  = mode === 'encrypt' ? 'decrypt' : 'encrypt';
  render();
});

render();
