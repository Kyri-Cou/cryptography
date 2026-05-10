import './nav.js';
import { xorBytes, toHex, hexSpaced } from './rc4.js';

const enc = new TextEncoder();

// ── State ──────────────────────────────────────────────────────────────────
let XOR12 = null;   // C1 ⊕ C2  =  P1 ⊕ P2
let currentKey = null;
let C1 = null, C2 = null;

// ── Simple XOR stream cipher (same key, different offsets = same stream) ──
// We XOR each message with the same keystream to simulate key reuse.
function xorCipher(plainBytes, key) {
  const out = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) out[i] = plainBytes[i] ^ key[i % key.length];
  return out;
}

// ── Setup ──────────────────────────────────────────────────────────────────
function setup() {
  const p1 = enc.encode(document.getElementById('msg1').value);
  const p2 = enc.encode(document.getElementById('msg2').value);

  // Generate a key as long as the longer message
  const keyLen = Math.max(p1.length, p2.length);
  currentKey = crypto.getRandomValues(new Uint8Array(keyLen));

  // Encrypt both with the SAME keystream — this is the vulnerability
  C1 = xorCipher(p1, currentKey);
  C2 = xorCipher(p2, currentKey);
  XOR12 = xorBytes(C1, C2);   // key cancels: P1 ⊕ P2

  // Fill displays
  document.getElementById('key-display').textContent = hexSpaced(toHex(currentKey));
  document.getElementById('c1-display').textContent = hexSpaced(toHex(C1));
  document.getElementById('c2-display').textContent = hexSpaced(toHex(C2));
  document.getElementById('xor-display').textContent = hexSpaced(toHex(XOR12));

  document.getElementById('cipher-section').hidden = false;
  document.getElementById('crib-section').hidden = false;

  dragCrib();
}

// ── Scoring ────────────────────────────────────────────────────────────────
// Returns -1 if any byte is non-printable (hard fail).
// Otherwise returns fraction of bytes that are ASCII letters or space [0, 1].
// English prose typically scores 0.85–1.0; random printable bytes average ~0.55.
function textScore(bytes) {
  for (const b of bytes) if (b < 0x20 || b > 0x7e) return -1;
  const letterSpace = bytes.filter(
    b => (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x20
  ).length;
  return letterSpace / bytes.length;
}

// ── Crib drag ──────────────────────────────────────────────────────────────
function dragCrib() {
  if (!XOR12) return;

  const cribStr = document.getElementById('crib-input').value;
  if (!cribStr.trim()) {
    document.getElementById('drag-results').innerHTML = '';
    return;
  }
  const crib = enc.encode(cribStr);

  const rows = [];
  for (let pos = 0; pos <= XOR12.length - crib.length; pos++) {
    const window = XOR12.slice(pos, pos + crib.length);
    const candidate = xorBytes(window, crib);
    const score = textScore(candidate);
    rows.push({ pos, candidate, score });
  }

  // Best letter-space score first; non-printable (-1) sink to the bottom
  rows.sort((a, b) => b.score - a.score || a.pos - b.pos);

  renderResults(rows, crib);
}

function charDisplay(b) {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '·';
}

function renderResults(rows, crib) {
  const container = document.getElementById('drag-results');
  const cribHex = toHex(crib);

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Crib is longer than the messages.</p>';
    return;
  }

  container.innerHTML = rows.map(({ pos, candidate, score }) => {
    const candStr = Array.from(candidate).map(charDisplay).join('');
    const candHex = toHex(candidate);

    let cls = 'crib-row';
    let badge = '';
    let scoreLabel = '';

    if (score < 0) {
      // Contains non-printable bytes — definitely not English
      cls += ' crib-dead';
      scoreLabel = '✗';
    } else {
      const pct = Math.round(score * 100);
      scoreLabel = pct + '%';
      if (score >= 0.75) {
        cls += ' crib-hit';
        badge = '<span class="crib-badge hit">match</span>';
      } else if (score >= 0.55) {
        cls += ' crib-warm';
        badge = '<span class="crib-badge warm">possible</span>';
      }
    }

    return `<div class="${cls}">
      <span class="cr-pos">${pos}</span>
      <span class="cr-crib-hex">${cribHex}</span>
      <span class="cr-arrow">⊕</span>
      <span class="cr-xor-hex">${toHex(XOR12.slice(pos, pos + crib.length))}</span>
      <span class="cr-arrow">→</span>
      <span class="cr-cand-str">${candStr}</span>
      <span class="cr-cand-hex">${candHex}</span>
      <span class="cr-score">${scoreLabel}</span>
      ${badge}
    </div>`;
  }).join('');
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.getElementById('setup-btn').addEventListener('click', setup);
document.getElementById('drag-btn').addEventListener('click', dragCrib);
document.getElementById('crib-input').addEventListener('input', dragCrib);

setup();
