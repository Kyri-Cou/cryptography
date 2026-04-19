// Shared script for all four bitwise-operator pages.
// Each HTML page sets data-op on <body> to "and" | "or" | "not" | "xor".
// This file reads that attribute and wires everything up.

import './nav.js';

const BITS = 8;
const MAX  = 0xFF;

const $ = (id) => document.getElementById(id);

// ── Operator definitions ────────────────────────────────────────────────────

const OPS = {
  and: {
    name: 'AND', symbol: '&', mathSym: '∧', unary: false,
    fn: (a, b) => a & b,
    truthRows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]],
    subtitle:
      'AND outputs <strong>1</strong> only when <em>both</em> input bits are 1. ' +
      'It acts as a <em>bitmask</em> — keeping selected bits intact while forcing the rest to 0.',
    crypto:
      'Masking is used everywhere in low-level cryptography: extracting a nibble, ' +
      'isolating a flag, reading specific bits of a block-cipher state word.',
  },
  or: {
    name: 'OR', symbol: '|', mathSym: '∨', unary: false,
    fn: (a, b) => a | b,
    truthRows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]],
    subtitle:
      'OR outputs <strong>1</strong> when <em>at least one</em> input bit is 1. ' +
      'It <em>sets</em> bits — ORing with a pattern forces those positions to 1 ' +
      'regardless of their previous value.',
    crypto:
      'Setting flags, assembling a byte from two nibbles, merging independent ' +
      'bit-fields — OR is the complement to AND masking.',
  },
  not: {
    name: 'NOT', symbol: '~', mathSym: '¬', unary: true,
    fn: (a) => (~a) & MAX,
    truthRows: [[0, 1], [1, 0]],
    subtitle:
      'NOT flips every bit: 0 becomes 1, 1 becomes 0. ' +
      'For an 8-bit value, <code>¬n = 255 − n</code> (the <em>one\'s complement</em>).',
    crypto:
      'Inverted masks (complement a pattern then AND it) and two\'s-complement ' +
      'negation — <code>(¬n) + 1</code> — are both built on NOT.',
  },
  xor: {
    name: 'XOR', symbol: '^', mathSym: '⊕', unary: false,
    fn: (a, b) => a ^ b,
    truthRows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]],
    subtitle:
      'XOR outputs <strong>1</strong> when the two bits <em>differ</em>. ' +
      'Its defining property: <code>A ⊕ B ⊕ B = A</code>, so XORing with a key ' +
      'twice returns the original — encryption and decryption are the same operation.',
    crypto:
      'XOR is the fundamental cipher primitive. The one-time pad, stream ciphers ' +
      '(RC4, ChaCha20), AES MixColumns, SHA message schedules — all rely on XOR. ' +
      'No other simple bitwise operation has this self-inverse property.',
  },
};

const opKey = (document.body.dataset.op || '').toLowerCase();
const op    = OPS[opKey];
if (!op) throw new Error(`Unknown op: ${opKey}`);

// ── Static content ──────────────────────────────────────────────────────────

$('op-subtitle').innerHTML = op.subtitle;
$('crypto-use').innerHTML  = op.crypto;

// ── State ───────────────────────────────────────────────────────────────────

const DEFAULTS = { a: 0b10101010, b: 0b11001100 }; // 170, 204 — nice mix of bits
let a = DEFAULTS.a;
let b = op.unary ? 0 : DEFAULTS.b;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBits(n) {
  return Array.from({ length: BITS }, (_, i) => (n >> (BITS - 1 - i)) & 1);
}

function clamp(n) {
  return Math.max(0, Math.min(MAX, Math.round(n) || 0));
}

function makeBitCell(bit, extraClass = '') {
  const cell = document.createElement('div');
  cell.className = `bit-cell ${bit ? 'b1' : 'b0'} ${extraClass}`.trim();
  const v = document.createElement('span');
  v.className = 'bv';
  v.textContent = bit;
  cell.appendChild(v);
  return cell;
}

// ── Op display ───────────────────────────────────────────────────────────────

function renderOpDisplay() {
  const opDisplay = $('op-display');
  opDisplay.innerHTML = '';

  const bitsA = toBits(a);
  const bitsB = op.unary ? null : toBits(b);
  const r     = op.unary ? op.fn(a) : op.fn(a, b);
  const bitsR = toBits(r);

  for (let i = 0; i < BITS; i++) {
    const col = document.createElement('div');
    col.className = 'op-col';

    // A bit
    col.appendChild(makeBitCell(bitsA[i]));

    // Operator symbol
    const sym = document.createElement('div');
    sym.className = 'op-sym';
    sym.textContent = op.mathSym;
    col.appendChild(sym);

    // B bit (binary ops only)
    if (!op.unary) {
      col.appendChild(makeBitCell(bitsB[i]));
    }

    // Separator line
    const line = document.createElement('div');
    line.className = 'op-line';
    col.appendChild(line);

    // Result bit
    col.appendChild(makeBitCell(bitsR[i], 'res'));

    opDisplay.appendChild(col);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

function fillSumBox(el, n) {
  el.querySelector('.sum-dec').textContent = n;
  el.querySelector('.sum-bin').textContent = toBits(n).join('');
  el.querySelector('.sum-hex').textContent = '0x' + n.toString(16).toUpperCase().padStart(2, '0');
}

function renderSummary() {
  const r = op.unary ? op.fn(a) : op.fn(a, b);
  fillSumBox($('sum-a'), a);
  if (!op.unary) fillSumBox($('sum-b'), b);
  fillSumBox($('sum-r'), r);
}

// ── Truth table ──────────────────────────────────────────────────────────────

function buildTruthTable() {
  const container = $('truth-table');
  const table = document.createElement('table');
  table.className = 'truth-table';

  const thead = document.createElement('thead');
  const hr    = document.createElement('tr');
  const cols  = op.unary
    ? ['A', `${op.mathSym} A`]
    : ['A', 'B', `A ${op.mathSym} B`];
  for (const h of cols) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of op.truthRows) {
    const tr = document.createElement('tr');
    for (let i = 0; i < row.length; i++) {
      const td = document.createElement('td');
      td.textContent = row[i];
      td.className = `${row[i] ? 'b1' : 'b0'}${i === row.length - 1 ? ' result' : ''}`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// ── XOR one-time pad demo (XOR page only) ────────────────────────────────────

function initOtpDemo() {
  const msgEl = $('otp-msg');
  const keyEl = $('otp-key');
  const grid  = $('otp-grid');
  if (!msgEl || !keyEl || !grid) return;

  function renderOtp() {
    const msg = (msgEl.value || 'HI').slice(0, 6).toUpperCase();
    const key = (keyEl.value || 'KEY').slice(0, 6).toUpperCase();
    grid.innerHTML = '';

    // Header row
    const headers = ['Char', 'ASCII', 'Binary', '', 'Key', 'ASCII', 'Binary', '', 'XOR', 'Hex'];
    const hdr = document.createElement('div');
    hdr.className = 'otp-row otp-header';
    for (const h of headers) {
      const span = document.createElement('span');
      span.textContent = h;
      hdr.appendChild(span);
    }
    grid.appendChild(hdr);

    for (let i = 0; i < msg.length; i++) {
      const mc  = msg.charCodeAt(i);
      const kc  = key.charCodeAt(i % key.length);
      const xrc = mc ^ kc;

      const row = document.createElement('div');
      row.className = 'otp-row';

      const cells = [
        { text: msg[i],                     cls: 'otp-char plain'   },
        { text: mc,                          cls: 'otp-dec'          },
        { text: mc.toString(2).padStart(8,'0'), cls: 'otp-bin plain' },
        { text: '⊕',                         cls: 'otp-op'           },
        { text: key[i % key.length],         cls: 'otp-char key'     },
        { text: kc,                          cls: 'otp-dec'          },
        { text: kc.toString(2).padStart(8,'0'), cls: 'otp-bin key'   },
        { text: '=',                         cls: 'otp-op'           },
        { text: xrc.toString(2).padStart(8,'0'), cls: 'otp-bin res'  },
        { text: '0x' + xrc.toString(16).toUpperCase().padStart(2,'0'), cls: 'otp-hex' },
      ];

      for (const c of cells) {
        const span = document.createElement('span');
        span.className = c.cls;
        span.textContent = c.text;
        row.appendChild(span);
      }
      grid.appendChild(row);
    }
  }

  msgEl.addEventListener('input', renderOtp);
  keyEl.addEventListener('input', renderOtp);
  renderOtp();
}

// ── Wire controls ─────────────────────────────────────────────────────────────

function update() {
  renderOpDisplay();
  renderSummary();
}

function wireInput(sliderId, numId, onChange) {
  const slider = $(sliderId);
  const num    = $(numId);
  if (!slider || !num) return;

  slider.addEventListener('input', () => {
    const v = clamp(parseInt(slider.value, 10));
    num.value = v;
    onChange(v);
  });
  num.addEventListener('input', () => {
    const v = clamp(parseInt(num.value, 10));
    slider.value = v;
    onChange(v);
  });
  slider.value = onChange === ((v) => { a = v; update(); }) ? a : b;
  num.value    = slider.value;
}

wireInput('a-slider', 'a-num', (v) => { a = v; update(); });
if (!op.unary) {
  wireInput('b-slider', 'b-num', (v) => { b = v; update(); });
}

// Sync initial slider values explicitly
const aSlider = $('a-slider');
if (aSlider) { aSlider.value = a; $('a-num').value = a; }
const bSlider = $('b-slider');
if (bSlider) { bSlider.value = b; $('b-num').value = b; }

buildTruthTable();
initOtpDemo();
update();
