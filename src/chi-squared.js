// Chi-squared demonstration page.
// Live computes χ² between a piece of text and the standard English letter
// frequency table, rendering a dual-bar distribution chart and a ranked table
// of per-letter contributions. A Caesar-shift slider lets the reader see why
// the score explodes under any non-zero shift of an English message.

import './nav.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ENGLISH_FREQ = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
  G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
  M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
  S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074,
};

const $ = (id) => document.getElementById(id);

const els = {
  text:           $('text'),
  shift:          $('shift'),
  shiftDisplay:   $('shift-display'),
  shiftedText:    $('shifted-text'),
  letterCount:    $('letter-count'),
  distChart:      $('dist-chart'),
  contribTable:   $('contrib-table'),
  chiTotal:       $('chi-total'),
  interpretation: $('interpretation'),
};

function caesarShift(text, k) {
  let out = '';
  for (const ch of text) {
    const upper = ch.toUpperCase();
    const idx = ALPHABET.indexOf(upper);
    if (idx === -1) { out += ch; continue; }
    const shifted = ALPHABET[(idx + k + 26) % 26];
    out += ch === upper ? shifted : shifted.toLowerCase();
  }
  return out;
}

// Walk the text once and compute everything the page needs: counts, total
// letter count, observed and expected percentages, per-letter chi² terms,
// and the grand total.
function analyse(text) {
  const counts = new Array(26).fill(0);
  let total = 0;
  for (const ch of text) {
    const idx = ALPHABET.indexOf(ch.toUpperCase());
    if (idx === -1) continue;
    counts[idx]++;
    total++;
  }

  const contributions = [];
  let chiTotal = 0;
  for (let i = 0; i < 26; i++) {
    const letter = ALPHABET[i];
    const observed = counts[i];
    const observedPct = total ? (observed / total) * 100 : 0;
    const expectedPct = ENGLISH_FREQ[letter];
    const expected = (expectedPct / 100) * total;
    const diff = observed - expected;
    const contribution = total && expected > 0 ? (diff * diff) / expected : 0;
    chiTotal += contribution;
    contributions.push({
      letter, observed, observedPct, expected, expectedPct, contribution,
    });
  }
  return { total, contributions, chiTotal };
}

function renderDistChart(contributions) {
  els.distChart.innerHTML = '';
  // Cap the axis at 15 % so E (12.7 %) fits comfortably with headroom, and
  // small observed spikes don't visually dwarf everything else.
  const maxPct = Math.max(
    15,
    ...contributions.map((c) => Math.max(c.observedPct, c.expectedPct))
  );

  for (const c of contributions) {
    const col = document.createElement('div');
    col.className = 'dist-col';

    const bars = document.createElement('div');
    bars.className = 'dist-bars';

    const expBar = document.createElement('div');
    expBar.className = 'dist-bar expected';
    expBar.style.height = `${(c.expectedPct / maxPct) * 100}%`;
    expBar.title = `${c.letter} expected: ${c.expectedPct.toFixed(2)}%`;

    const obsBar = document.createElement('div');
    obsBar.className = 'dist-bar observed';
    obsBar.style.height = `${(c.observedPct / maxPct) * 100}%`;
    obsBar.title = `${c.letter} observed: ${c.observedPct.toFixed(2)}%`;

    bars.append(expBar, obsBar);

    const label = document.createElement('div');
    label.className = 'dist-label';
    label.textContent = c.letter;

    col.append(bars, label);
    els.distChart.appendChild(col);
  }
}

function renderContribTable(contributions) {
  els.contribTable.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'contrib-row header';
  for (const h of ['Letter', 'Observed', 'Expected', '(O − E)² / E']) {
    const span = document.createElement('span');
    span.textContent = h;
    header.appendChild(span);
  }
  els.contribTable.appendChild(header);

  const sorted = [...contributions].sort((a, b) => b.contribution - a.contribution);
  for (const c of sorted) {
    const row = document.createElement('div');
    row.className = 'contrib-row';

    const letter = document.createElement('span');
    letter.className = 'c-letter';
    letter.textContent = c.letter;

    const obs = document.createElement('span');
    obs.textContent = `${c.observed} (${c.observedPct.toFixed(1)}%)`;

    const exp = document.createElement('span');
    exp.textContent = `${c.expected.toFixed(1)} (${c.expectedPct.toFixed(1)}%)`;

    const contrib = document.createElement('span');
    contrib.className = 'c-contrib';
    contrib.textContent = c.contribution.toFixed(2);

    row.append(letter, obs, exp, contrib);
    els.contribTable.appendChild(row);
  }
}

function interpretChi(score, total) {
  if (total === 0) return { label: 'No letters to analyse', cls: '' };
  // Thresholds are deliberately loose — calibrated against a few hundred
  // letters of real English (≈ 10–25) versus its Caesar shifts (≈ 100–400).
  if (score < 30)  return { label: 'Looks like English',  cls: 'good' };
  if (score < 100) return { label: 'Plausibly English',   cls: 'ok'   };
  if (score < 300) return { label: 'Not very English',    cls: 'warn' };
  return               { label: 'Far from English',     cls: 'bad'  };
}

function update() {
  const raw = els.text.value;
  const k = parseInt(els.shift.value, 10) || 0;
  els.shiftDisplay.textContent = k;

  const shifted = caesarShift(raw, k);
  els.shiftedText.textContent = shifted || '\u00a0';

  const { total, contributions, chiTotal } = analyse(shifted);
  els.letterCount.textContent = `${total} letter${total === 1 ? '' : 's'} analysed`;

  renderDistChart(contributions);
  renderContribTable(contributions);

  els.chiTotal.textContent = chiTotal.toFixed(1);
  const { label, cls } = interpretChi(chiTotal, total);
  els.interpretation.textContent = label;
  els.interpretation.className = `interpretation ${cls}`;
}

els.text.addEventListener('input', update);
els.shift.addEventListener('input', update);
update();
