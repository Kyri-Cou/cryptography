import './nav.js';

// ── Entropy pool ───────────────────────────────────────────────────────────
const POOL_SIZE = 64;
const ENTROPY_TARGET = 50;

const pool = new Uint8Array(POOL_SIZE);
let poolIdx = 0;
let entropyCount = 0;

function addEntropy(bytes) {
  for (const b of bytes) {
    pool[poolIdx % POOL_SIZE] ^= b & 0xff;
    poolIdx++;
  }
  entropyCount++;
  renderMeter();
}

function onPointerMove(e) {
  const t = Math.floor(performance.now() * 16) & 0xff;
  addEntropy([e.clientX & 0xff, (e.clientX >> 8) & 0xff,
              e.clientY & 0xff, (e.clientY >> 8) & 0xff, t]);
}

function onKeyDown(e) {
  const t = Math.floor(performance.now() * 16) & 0xff;
  addEntropy([e.keyCode & 0xff, t]);
}

document.addEventListener('pointermove', onPointerMove, { passive: true });
document.addEventListener('keydown', onKeyDown, { passive: true });

function renderMeter() {
  const pct = Math.min(entropyCount / ENTROPY_TARGET, 1);
  const bar = document.getElementById('entropy-bar');
  const pctEl = document.getElementById('entropy-pct');
  const label = document.getElementById('entropy-label');
  if (!bar) return;

  bar.style.width = (pct * 100).toFixed(0) + '%';
  pctEl.textContent = (pct * 100).toFixed(0) + '%';

  if (pct >= 1) {
    bar.classList.add('full');
    label.textContent = 'Entropy pool ready — extra randomness mixed into every key.';
  } else {
    bar.classList.remove('full');
    label.textContent = `Collecting entropy… ${entropyCount} / ${ENTROPY_TARGET} events`;
  }
}

// ── Key generation ─────────────────────────────────────────────────────────
let currentKey = null;
let currentCipherBytes = null;

async function generateKey(len) {
  const key = crypto.getRandomValues(new Uint8Array(len));
  // Mix in SHA-256 of the collected entropy pool for belt-and-suspenders randomness
  if (entropyCount > 0) {
    const hashBuf = await crypto.subtle.digest('SHA-256', pool);
    const hash = new Uint8Array(hashBuf);
    for (let i = 0; i < len; i++) {
      key[i] ^= hash[i % 32];
    }
  }
  return key;
}

// ── Vernam cipher ──────────────────────────────────────────────────────────
function vernam(inputBytes, key) {
  return inputBytes.map((b, i) => b ^ key[i]);
}

// ── Hex helpers ────────────────────────────────────────────────────────────
function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(str) {
  const clean = str.replace(/[\s:]/g, '');
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function hexSpaced(hex) {
  const chunks = [];
  for (let i = 0; i < hex.length; i += 8) chunks.push(hex.slice(i, i + 8));
  return chunks.join(' ');
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── XOR grid renderer ──────────────────────────────────────────────────────
const MAX_COLS = 32;

function printable(b) {
  if (b >= 0x20 && b < 0x7f) {
    const ch = String.fromCharCode(b);
    if (ch === '<') return '&lt;';
    if (ch === '&') return '&amp;';
    return ch;
  }
  return '·';
}

function renderGrid(plainBytes, key, cipherBytes) {
  const grid = document.getElementById('xor-grid');
  const overflow = document.getElementById('grid-overflow');
  const len = Math.min(plainBytes.length, MAX_COLS);
  const extra = plainBytes.length - len;

  const cols = [];
  for (let i = 0; i < len; i++) {
    const ph = plainBytes[i].toString(16).padStart(2, '0');
    const kh = key[i].toString(16).padStart(2, '0');
    const ch = cipherBytes[i].toString(16).padStart(2, '0');
    cols.push(
      `<div class="vb-col">` +
        `<div class="vb-cell vb-char">${printable(plainBytes[i])}</div>` +
        `<div class="vb-cell vb-plain">${ph}</div>` +
        `<div class="vb-sym">⊕</div>` +
        `<div class="vb-cell vb-key">${kh}</div>` +
        `<div class="vb-line"></div>` +
        `<div class="vb-cell vb-cipher">${ch}</div>` +
      `</div>`
    );
  }
  grid.innerHTML = cols.join('');
  overflow.textContent = extra > 0
    ? `… and ${extra} more byte${extra !== 1 ? 's' : ''} (showing first ${MAX_COLS})`
    : '';
}

// ── Encrypt ────────────────────────────────────────────────────────────────
async function encrypt() {
  const text = document.getElementById('plaintext').value;
  if (!text) return;

  const plainBytes = Array.from(enc.encode(text));
  currentKey = await generateKey(plainBytes.length);
  currentCipherBytes = vernam(plainBytes, currentKey);

  const keyHex = toHex(currentKey);
  const cipherHex = toHex(currentCipherBytes);

  // Key section
  document.getElementById('key-display').textContent = hexSpaced(keyHex);
  document.getElementById('key-section').hidden = false;

  // IO grid
  document.getElementById('input-display').textContent = text;
  document.getElementById('output-display').textContent = hexSpaced(cipherHex);
  document.getElementById('io-grid').hidden = false;

  // XOR grid
  renderGrid(plainBytes, currentKey, currentCipherBytes);
  document.getElementById('grid-section').hidden = false;

  // Pre-fill decrypt panel
  document.getElementById('dec-key').value = keyHex;
  document.getElementById('dec-cipher').value = cipherHex;
  document.getElementById('dec-plain').innerHTML = '&nbsp;';
}

// ── Decrypt ────────────────────────────────────────────────────────────────
function decrypt() {
  const keyBytes = fromHex(document.getElementById('dec-key').value);
  const cipherBytes = fromHex(document.getElementById('dec-cipher').value);
  const out = document.getElementById('dec-plain');

  if (!keyBytes || !cipherBytes) {
    out.textContent = 'Error: invalid hex input — check for non-hex characters.';
    return;
  }
  if (keyBytes.length !== cipherBytes.length) {
    out.textContent = `Error: key is ${keyBytes.length} B but ciphertext is ${cipherBytes.length} B — they must be equal.`;
    return;
  }

  const plainBytes = vernam(Array.from(cipherBytes), keyBytes);
  try {
    out.textContent = dec.decode(new Uint8Array(plainBytes));
  } catch {
    out.textContent = '(non-UTF-8 output — raw hex: ' + toHex(new Uint8Array(plainBytes)) + ')';
  }
}

// ── Copy ───────────────────────────────────────────────────────────────────
function copyEl(id) {
  const text = document.getElementById(id).textContent.replace(/\s/g, '');
  navigator.clipboard?.writeText(text);
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.getElementById('gen-btn').addEventListener('click', encrypt);
document.getElementById('dec-btn').addEventListener('click', decrypt);
document.getElementById('copy-key-btn').addEventListener('click', () => copyEl('key-display'));

renderMeter();
