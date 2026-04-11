// Brute-force Caesar crack visualisation.
// Tries all 26 shifts, scores each candidate plaintext against expected
// English letter frequencies via a chi-squared statistic, and ranks them.

import './nav.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// English letter frequencies as percentages (sums ~100). Standard table from
// the Cornell / Cryptographical Mathematics references — close enough for
// short-message scoring.
const ENGLISH_FREQ = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
  G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
  M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
  S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074,
};

const $ = (id) => document.getElementById(id);

const els = {
  ciphertext:    $('ciphertext'),
  crackBtn:      $('crack-btn'),
  sampleBtn:     $('sample-btn'),
  bestKey:       $('best-key'),
  bestScore:     $('best-score'),
  bestPlaintext: $('best-plaintext'),
  candidates:    $('candidates'),
};

const SAMPLES = [
  'Wkh txlfn eurzq ira mxpsv ryhu wkh odcb grj',
  'Bpm tibm ivl bpm mizgz inbmz uw whx mvbmzml bpm zwwu',
  'Khoor zruog, wklv lv d vhfuhw phvvdjh',
  'Cipher text here is just a longer English sentence shifted by some amount',
];
let sampleIdx = 0;

function shiftChar(ch, k) {
  const upper = ch.toUpperCase();
  const idx = ALPHABET.indexOf(upper);
  if (idx === -1) return ch;
  const shifted = ALPHABET[(idx + k + 26) % 26];
  return ch === upper ? shifted : shifted.toLowerCase();
}

function caesar(text, k) {
  let out = '';
  for (const c of text) out += shiftChar(c, k);
  return out;
}

// Chi-squared distance between the observed letter counts in `text` and the
// counts you'd expect from English of the same length. Lower = more English.
function chiSquaredEnglish(text) {
  const counts = Object.fromEntries([...ALPHABET].map((l) => [l, 0]));
  let total = 0;
  for (const ch of text.toUpperCase()) {
    if (counts[ch] !== undefined) {
      counts[ch]++;
      total++;
    }
  }
  if (total === 0) return Infinity;

  let chi = 0;
  for (const letter of ALPHABET) {
    const expected = (ENGLISH_FREQ[letter] / 100) * total;
    const diff = counts[letter] - expected;
    chi += (diff * diff) / expected;
  }
  return chi;
}

function crack(ciphertext) {
  const results = [];
  for (let k = 0; k < 26; k++) {
    // Encryption with key k means decryption applies -k.
    const candidate = caesar(ciphertext, -k);
    results.push({ key: k, text: candidate, score: chiSquaredEnglish(candidate) });
  }
  // Rank ascending — best (lowest chi²) first.
  results.sort((a, b) => a.score - b.score);
  return results;
}

function formatScore(s) {
  if (!isFinite(s)) return '∞';
  return s.toFixed(1);
}

function renderBest(best) {
  els.bestKey.textContent = best.key;
  els.bestScore.textContent = formatScore(best.score);
  els.bestPlaintext.textContent = best.text || '\u00a0';
}

function renderCandidates(results) {
  els.candidates.innerHTML = '';

  // Compute a 0..1 normalized score so we can shade rows by quality.
  const finiteScores = results.map((r) => r.score).filter(isFinite);
  const minScore = Math.min(...finiteScores);
  const maxScore = Math.max(...finiteScores);
  const range = maxScore - minScore || 1;

  results.forEach((r, rank) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'candidate';
    if (rank === 0) row.classList.add('top');

    const norm = isFinite(r.score) ? (r.score - minScore) / range : 1;
    // Bar width: best = full, worst = sliver. Inverted because lower is better.
    const barPct = Math.max(4, (1 - norm) * 100);

    const keyEl = document.createElement('span');
    keyEl.className = 'cand-key';
    keyEl.textContent = `k=${String(r.key).padStart(2, '0')}`;

    const textEl = document.createElement('span');
    textEl.className = 'cand-text';
    textEl.textContent = r.text;

    const scoreEl = document.createElement('span');
    scoreEl.className = 'cand-score';
    scoreEl.textContent = formatScore(r.score);

    const bar = document.createElement('span');
    bar.className = 'cand-bar';
    bar.style.width = `${barPct}%`;

    row.append(bar, keyEl, textEl, scoreEl);
    row.addEventListener('click', () => renderBest(r));
    els.candidates.appendChild(row);
  });
}

function update() {
  const ct = els.ciphertext.value;
  const results = crack(ct);
  renderCandidates(results);
  renderBest(results[0]);
}

els.ciphertext.addEventListener('input', update);
els.crackBtn.addEventListener('click', update);
els.sampleBtn.addEventListener('click', () => {
  sampleIdx = (sampleIdx + 1) % SAMPLES.length;
  els.ciphertext.value = SAMPLES[sampleIdx];
  update();
});

update();
