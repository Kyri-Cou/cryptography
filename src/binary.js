// Binary number representation page.
// Renders a clickable 8-bit grid alongside a place-value legend. Typing a
// decimal number or moving the slider also drives the display.

import './nav.js';

const BITS = 8;
const MAX  = 255;

const $ = (id) => document.getElementById(id);

const els = {
  slider:     $('slider'),
  numInput:   $('num-input'),
  powersRow:  $('powers-row'),
  bitsRow:    $('bits-row'),
  activeSum:  $('active-sum'),
  decOut:     $('dec-out'),
  binOut:     $('bin-out'),
  hexOut:     $('hex-out'),
};

let bits = new Array(BITS).fill(0);

function toBits(n) {
  return Array.from({ length: BITS }, (_, i) => (n >> (BITS - 1 - i)) & 1);
}

function fromBits() {
  return bits.reduce((acc, b, i) => acc | (b << (BITS - 1 - i)), 0);
}

function clamp(n) {
  return Math.max(0, Math.min(MAX, Math.round(n) || 0));
}

function render() {
  const n = fromBits();

  els.slider.value   = n;
  els.numInput.value = n;
  els.decOut.textContent = n;
  els.binOut.textContent = bits.join('');
  els.hexOut.textContent = '0x' + n.toString(16).toUpperCase().padStart(2, '0');

  const activePowers = bits
    .map((b, i) => (b ? 1 << (BITS - 1 - i) : 0))
    .filter(Boolean);
  els.activeSum.textContent = activePowers.length
    ? activePowers.join(' + ') + ' = ' + n
    : '(no bits set — value is 0)';

  // Re-render bit cells
  els.bitsRow.innerHTML = '';
  for (let i = 0; i < BITS; i++) {
    const cell = document.createElement('div');
    cell.className = `bit-cell clickable ${bits[i] ? 'b1' : 'b0'}`;

    const val = document.createElement('span');
    val.className = 'bv';
    val.textContent = bits[i];
    cell.appendChild(val);

    const idx = i;
    cell.addEventListener('click', () => {
      bits[idx] ^= 1;
      render();
    });
    els.bitsRow.appendChild(cell);
  }
}

function buildPowersRow() {
  for (let i = 0; i < BITS; i++) {
    const power = BITS - 1 - i;
    const cell  = document.createElement('div');
    cell.className = 'power-cell';

    const exp = document.createElement('div');
    exp.className = 'power-exp';
    exp.innerHTML = `2<sup>${power}</sup>`;

    const val = document.createElement('div');
    val.className = 'power-val';
    val.textContent = 1 << power;

    cell.append(exp, val);
    els.powersRow.appendChild(cell);
  }
}

els.slider.addEventListener('input', () => {
  bits = toBits(parseInt(els.slider.value, 10));
  render();
});

els.numInput.addEventListener('input', () => {
  bits = toBits(clamp(parseInt(els.numInput.value, 10)));
  render();
});

bits = toBits(42);
buildPowersRow();
render();
