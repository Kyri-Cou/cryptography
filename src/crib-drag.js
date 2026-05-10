import './nav.js';
import { xorBytes, toHex, hexSpaced } from './rc4.js';

const enc = new TextEncoder();

// ── State ──────────────────────────────────────────────────────────────────
let XOR12 = null;
let currentKey = null;
let C1 = null, C2 = null;
let dragPos = 0;
let lastCribStr = '';

// ── Simple XOR stream cipher ───────────────────────────────────────────────
function xorCipher(plainBytes, key) {
  const out = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) out[i] = plainBytes[i] ^ key[i % key.length];
  return out;
}

// ── Setup ──────────────────────────────────────────────────────────────────
function setup() {
  const p1 = enc.encode(document.getElementById('msg1').value);
  const p2 = enc.encode(document.getElementById('msg2').value);
  const keyLen = Math.max(p1.length, p2.length);
  currentKey = crypto.getRandomValues(new Uint8Array(keyLen));
  C1 = xorCipher(p1, currentKey);
  C2 = xorCipher(p2, currentKey);
  XOR12 = xorBytes(C1, C2);

  document.getElementById('key-display').textContent  = hexSpaced(toHex(currentKey));
  document.getElementById('c1-display').textContent   = hexSpaced(toHex(C1));
  document.getElementById('c2-display').textContent   = hexSpaced(toHex(C2));
  document.getElementById('xor-display').textContent  = hexSpaced(toHex(XOR12));

  document.getElementById('cipher-section').hidden = false;
  document.getElementById('crib-section').hidden   = false;

  dragPos = 0;
  lastCribStr = '';
  updateCrib();
}

// ── Scoring ────────────────────────────────────────────────────────────────
// Returns -1 if any byte is non-printable. Otherwise returns the fraction
// of bytes that are ASCII letters or space — English prose ≈ 0.85–1.0.
function textScore(bytes) {
  for (const b of bytes) if (b < 0x20 || b > 0x7e) return -1;
  const letterSpace = bytes.filter(
    b => (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x20
  ).length;
  return letterSpace / bytes.length;
}

function charDisplay(b) {
  return b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '·';
}

function scoreClass(score) {
  if (score < 0)    return 'dv-dead';
  if (score >= 0.75) return 'dv-hit';
  if (score >= 0.55) return 'dv-warm';
  return '';
}

// ── Master update ──────────────────────────────────────────────────────────
function updateCrib() {
  if (!XOR12) return;
  const cribStr = document.getElementById('crib-input').value;

  if (!cribStr.trim()) {
    clearVisual();
    document.getElementById('drag-results').innerHTML = '';
    lastCribStr = '';
    return;
  }

  const crib   = enc.encode(cribStr);
  const maxPos = Math.max(0, XOR12.length - crib.length);
  dragPos = Math.max(0, Math.min(dragPos, maxPos));

  renderVisual(crib, maxPos);

  if (cribStr !== lastCribStr) {
    renderTable(crib);
    lastCribStr = cribStr;
  }

  // Sync active-position highlight in the sorted table
  document.querySelectorAll('.crib-row').forEach(r => {
    r.classList.toggle('active-pos', parseInt(r.dataset.pos) === dragPos);
  });
}

// ── Visual drag panel ──────────────────────────────────────────────────────
function clearVisual() {
  ['dv-xor-cells', 'dv-crib-cells', 'dv-result-cells'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  document.getElementById('pos-label').textContent = '';
  document.getElementById('match-badge').hidden = true;
  document.getElementById('prev-btn').disabled = true;
  document.getElementById('next-btn').disabled = true;
}

function renderVisual(crib, maxPos) {
  const window  = XOR12.slice(dragPos, dragPos + crib.length);
  const cand    = xorBytes(window, crib);
  const score   = textScore(cand);
  const sCls    = scoreClass(score);
  const n       = XOR12.length;

  // ── P₁⊕P₂ row ─────────────────────────────────────────────────────────
  let xorHtml = '';
  for (let i = 0; i < n; i++) {
    const b      = XOR12[i];
    const active = i >= dragPos && i < dragPos + crib.length;
    xorHtml += `<span class="dv-byte dv-xor${active ? ' dv-active' : ''}" data-pos="${i}">`
             + `<span class="dv-hex">${toHex(new Uint8Array([b]))}</span>`
             + `<span class="dv-ch">${charDisplay(b)}</span>`
             + `</span>`;
  }
  document.getElementById('dv-xor-cells').innerHTML = xorHtml;

  // ── Crib row ───────────────────────────────────────────────────────────
  let cribHtml = '';
  for (let i = 0; i < n; i++) {
    const ci = i - dragPos;
    if (ci >= 0 && ci < crib.length) {
      const b = crib[ci];
      cribHtml += `<span class="dv-byte dv-crib">`
               + `<span class="dv-ch dv-ch-big">${String.fromCharCode(b)}</span>`
               + `<span class="dv-hex">${toHex(new Uint8Array([b]))}</span>`
               + `</span>`;
    } else {
      cribHtml += `<span class="dv-byte dv-ghost"></span>`;
    }
  }
  document.getElementById('dv-crib-cells').innerHTML = cribHtml;

  // ── Result row ─────────────────────────────────────────────────────────
  let resHtml = '';
  for (let i = 0; i < n; i++) {
    const ci = i - dragPos;
    if (ci >= 0 && ci < crib.length) {
      const b = cand[ci];
      resHtml += `<span class="dv-byte dv-result ${sCls}">`
              + `<span class="dv-ch dv-ch-big">${charDisplay(b)}</span>`
              + `<span class="dv-hex">${toHex(new Uint8Array([b]))}</span>`
              + `</span>`;
    } else {
      resHtml += `<span class="dv-byte dv-ghost"></span>`;
    }
  }
  document.getElementById('dv-result-cells').innerHTML = resHtml;

  // Click-to-position on XOR bytes
  document.getElementById('dv-xor-cells').querySelectorAll('.dv-byte[data-pos]').forEach(cell => {
    cell.addEventListener('click', () => {
      dragPos = Math.min(parseInt(cell.dataset.pos), maxPos);
      updateCrib();
    });
  });

  // ── Controls ───────────────────────────────────────────────────────────
  const slider = document.getElementById('pos-slider');
  slider.max   = maxPos;
  slider.value = dragPos;

  document.getElementById('pos-label').textContent = `${dragPos} / ${maxPos}`;
  document.getElementById('prev-btn').disabled = dragPos <= 0;
  document.getElementById('next-btn').disabled = dragPos >= maxPos;

  // ── Score badge ────────────────────────────────────────────────────────
  const badge = document.getElementById('match-badge');
  badge.hidden = false;
  badge.style.cssText = '';
  if (score < 0) {
    badge.textContent = 'non-printable';
    badge.className   = 'crib-badge';
    badge.style.color = 'var(--c-dim)';
  } else {
    const pct = Math.round(score * 100);
    if (score >= 0.75) {
      badge.textContent = `${pct}% · match`;
      badge.className   = 'crib-badge hit';
    } else if (score >= 0.55) {
      badge.textContent = `${pct}% · possible`;
      badge.className   = 'crib-badge warm';
    } else {
      badge.textContent = `${pct}%`;
      badge.className   = 'crib-badge';
      badge.style.color = 'var(--c-dim)';
    }
  }

  scrollActiveIntoView();
}

function scrollActiveIntoView() {
  const visual  = document.getElementById('drag-visual');
  const active  = visual.querySelector('.dv-active');
  if (!active) return;
  const cellW  = active.offsetWidth + 3;   // cell + gap
  const labelEl = visual.querySelector('.dv-label');
  const labelW  = labelEl ? labelEl.offsetWidth : 80;
  const pos     = labelW + dragPos * cellW;
  const PAD     = cellW;

  if (pos - PAD < visual.scrollLeft) {
    visual.scrollLeft = Math.max(0, pos - PAD);
  } else if (pos + cellW + PAD > visual.scrollLeft + visual.clientWidth) {
    visual.scrollLeft = pos + cellW + PAD - visual.clientWidth;
  }
}

// ── Sorted results table ───────────────────────────────────────────────────
function renderTable(crib) {
  const rows = [];
  for (let pos = 0; pos <= XOR12.length - crib.length; pos++) {
    const win   = XOR12.slice(pos, pos + crib.length);
    const cand  = xorBytes(win, crib);
    const score = textScore(cand);
    rows.push({ pos, cand, score });
  }
  rows.sort((a, b) => b.score - a.score || a.pos - b.pos);

  const container = document.getElementById('drag-results');
  const cribHex   = toHex(crib);

  if (!rows.length) {
    container.innerHTML = '<p class="empty">Crib is longer than the messages.</p>';
    return;
  }

  container.innerHTML = rows.map(({ pos, cand, score }) => {
    const candStr = Array.from(cand).map(charDisplay).join('');
    const candHex = toHex(cand);

    let cls   = 'crib-row';
    let badge = '';
    let label = '';

    if (score < 0) {
      cls   += ' crib-dead';
      label  = '✗';
    } else {
      const pct = Math.round(score * 100);
      label = pct + '%';
      if (score >= 0.75) {
        cls   += ' crib-hit';
        badge  = '<span class="crib-badge hit">match</span>';
      } else if (score >= 0.55) {
        cls   += ' crib-warm';
        badge  = '<span class="crib-badge warm">possible</span>';
      }
    }

    if (pos === dragPos) cls += ' active-pos';

    return `<div class="${cls}" data-pos="${pos}">
      <span class="cr-pos">${pos}</span>
      <span class="cr-crib-hex">${cribHex}</span>
      <span class="cr-arrow">⊕</span>
      <span class="cr-xor-hex">${toHex(XOR12.slice(pos, pos + crib.length))}</span>
      <span class="cr-arrow">→</span>
      <span class="cr-cand-str">${candStr}</span>
      <span class="cr-cand-hex">${candHex}</span>
      <span class="cr-score">${label}</span>
      ${badge}
    </div>`;
  }).join('');
}

// ── Event listeners ────────────────────────────────────────────────────────
document.getElementById('setup-btn').addEventListener('click', setup);

document.getElementById('crib-input').addEventListener('input', () => {
  dragPos = 0;
  updateCrib();
});

document.getElementById('prev-btn').addEventListener('click', () => {
  dragPos = Math.max(0, dragPos - 1);
  updateCrib();
});

document.getElementById('next-btn').addEventListener('click', () => {
  if (!XOR12) return;
  const maxPos = Math.max(0, XOR12.length - enc.encode(document.getElementById('crib-input').value).length);
  dragPos = Math.min(maxPos, dragPos + 1);
  updateCrib();
});

document.getElementById('pos-slider').addEventListener('input', e => {
  dragPos = parseInt(e.target.value);
  updateCrib();
});

document.getElementById('drag-visual').addEventListener('keydown', e => {
  if (!XOR12) return;
  const maxPos = Math.max(0, XOR12.length - enc.encode(document.getElementById('crib-input').value).length);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    dragPos = Math.max(0, dragPos - 1);
    updateCrib();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    dragPos = Math.min(maxPos, dragPos + 1);
    updateCrib();
  }
});

setup();
