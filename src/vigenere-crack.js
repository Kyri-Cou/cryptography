// Vigenère cracking visualisation.
// Implements Kasiski examination to recover the key length, then brute-forces
// each Caesar coset against English letter frequencies to recover the key
// itself. Every step is rendered live as the user edits the ciphertext.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ENGLISH_FREQ = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702, F: 2.228,
  G: 2.015, H: 6.094, I: 6.966, J: 0.153, K: 0.772, L: 4.025,
  M: 2.406, N: 6.749, O: 7.507, P: 1.929, Q: 0.095, R: 5.987,
  S: 6.327, T: 9.056, U: 2.758, V: 0.978, W: 2.360, X: 0.150,
  Y: 1.974, Z: 0.074,
};

const MAX_KEY_LEN = 16;

const $ = (id) => document.getElementById(id);

const els = {
  ciphertext:    $('ciphertext'),
  crackBtn:      $('crack-btn'),
  sampleBtn:     $('sample-btn'),
  sampleHint:    $('sample-hint'),
  repeats:       $('repeats'),
  keylens:       $('keylens'),
  cosets:        $('cosets'),
  bestKey:       $('best-key'),
  bestLen:       $('best-len'),
  bestPlaintext: $('best-plaintext'),
  activeLenLabel:  $('active-len-label'),
  activeLenLabel2: $('active-len-label-2'),
};

// User-chosen key length, or null to fall back to the auto-pick from Kasiski.
let manualKeyLength = null;

// ── Vigenère + Caesar primitives ────────────────────────────────────────────

const letterIdx = (ch) => ALPHABET.indexOf(ch.toUpperCase());

function cleanLetters(text) {
  return text.toUpperCase().replace(/[^A-Z]/g, '');
}

function vigenereDecrypt(text, key) {
  if (!key) return text;
  let out = '';
  let keyPos = 0;
  for (const ch of text) {
    const idx = letterIdx(ch);
    if (idx === -1) { out += ch; continue; }
    const k = letterIdx(key[keyPos % key.length]);
    const shifted = ALPHABET[(idx - k + 26) % 26];
    out += ch === ch.toUpperCase() ? shifted : shifted.toLowerCase();
    keyPos++;
  }
  return out;
}

function vigenereEncrypt(text, key) {
  let out = '';
  let keyPos = 0;
  for (const ch of text) {
    const idx = letterIdx(ch);
    if (idx === -1) { out += ch; continue; }
    const k = letterIdx(key[keyPos % key.length]);
    const shifted = ALPHABET[(idx + k) % 26];
    out += ch === ch.toUpperCase() ? shifted : shifted.toLowerCase();
    keyPos++;
  }
  return out;
}

function chiSquaredEnglish(letters) {
  if (letters.length === 0) return Infinity;
  const counts = new Array(26).fill(0);
  for (const c of letters) counts[letterIdx(c)]++;
  let chi = 0;
  for (let i = 0; i < 26; i++) {
    const expected = (ENGLISH_FREQ[ALPHABET[i]] / 100) * letters.length;
    const diff = counts[i] - expected;
    chi += (diff * diff) / expected;
  }
  return chi;
}

// ── Step 1: find repeated n-grams ───────────────────────────────────────────

function findRepeats(cipherClean, minLen = 3, maxLen = 5) {
  const seen = new Map();
  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i + len <= cipherClean.length; i++) {
      const seq = cipherClean.slice(i, i + len);
      if (!seen.has(seq)) seen.set(seq, []);
      seen.get(seq).push(i);
    }
  }

  // Drop length-N sequences that are wholly contained inside a longer repeat
  // with the same starting positions — they're redundant noise.
  const longer = new Set();
  for (const [seq, positions] of seen) {
    if (positions.length < 2 || seq.length < maxLen) continue;
    longer.add(seq);
  }

  const repeats = [];
  for (const [seq, positions] of seen) {
    if (positions.length < 2) continue;
    let redundant = false;
    if (seq.length < maxLen) {
      for (const big of longer) {
        if (big.includes(seq)) {
          // Cheap subsumption check: same first occurrence inside a longer repeat.
          const bigPositions = seen.get(big);
          const offset = big.indexOf(seq);
          const matches = bigPositions.every((bp) => positions.includes(bp + offset));
          if (matches && bigPositions.length === positions.length) {
            redundant = true;
            break;
          }
        }
      }
    }
    if (redundant) continue;

    const distances = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        distances.push(positions[j] - positions[i]);
      }
    }
    repeats.push({ seq, positions, distances });
  }

  // Longer sequences first, then more occurrences. They're the strongest evidence.
  repeats.sort((a, b) =>
    b.seq.length - a.seq.length ||
    b.positions.length - a.positions.length ||
    a.positions[0] - b.positions[0]
  );
  return repeats;
}

// ── Step 2: score candidate key lengths ─────────────────────────────────────

// For every repeat distance, count it against each candidate L it's divisible
// by. The true key length collects far more hits than its neighbours.
function scoreKeyLengths(repeats, maxLen = MAX_KEY_LEN) {
  const scores = new Array(maxLen + 1).fill(0);
  for (const r of repeats) {
    for (const d of r.distances) {
      for (let L = 2; L <= maxLen; L++) {
        if (d % L === 0) scores[L]++;
      }
    }
  }
  return scores;
}

// Pick the best small L. If two lengths tie (a multiple commonly matches its
// divisor), prefer the smaller — that's almost always the actual key length.
function pickBestKeyLength(scores) {
  let bestL = 0;
  let bestScore = -1;
  for (let L = 2; L < scores.length; L++) {
    if (scores[L] > bestScore) {
      bestScore = scores[L];
      bestL = L;
    }
  }
  return bestL || 2;
}

// ── Step 3: brute-force each coset ──────────────────────────────────────────

function crackForLength(cipherClean, L) {
  const positions = [];
  let key = '';
  for (let i = 0; i < L; i++) {
    let coset = '';
    for (let j = i; j < cipherClean.length; j += L) coset += cipherClean[j];

    // Brute-force all 26 shifts and keep every score so the UI can show the
    // full spectrum, not just the winner.
    const allScores = new Array(26);
    let bestK = 0;
    let bestScore = Infinity;
    for (let k = 0; k < 26; k++) {
      let decrypted = '';
      for (const c of coset) {
        decrypted += ALPHABET[(letterIdx(c) - k + 26) % 26];
      }
      const s = chiSquaredEnglish(decrypted);
      allScores[k] = s;
      if (s < bestScore) { bestScore = s; bestK = k; }
    }
    key += ALPHABET[bestK];
    positions.push({ pos: i, coset, cosetLen: coset.length, bestK, bestScore, allScores });
  }
  return { key, positions };
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderRepeats(repeats) {
  els.repeats.innerHTML = '';
  if (repeats.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No repeated trigrams found. Try a longer ciphertext.';
    els.repeats.appendChild(empty);
    return;
  }

  const top = repeats.slice(0, 10);
  for (const r of top) {
    const row = document.createElement('div');
    row.className = 'repeat-row';

    const seq = document.createElement('span');
    seq.className = 'repeat-seq';
    seq.textContent = r.seq;

    const positions = document.createElement('span');
    positions.className = 'repeat-positions';
    positions.textContent = `at ${r.positions.join(', ')}`;

    const distances = document.createElement('span');
    distances.className = 'repeat-distances';
    distances.textContent = `Δ = ${r.distances.join(', ')}`;

    row.append(seq, positions, distances);
    els.repeats.appendChild(row);
  }

  if (repeats.length > top.length) {
    const more = document.createElement('p');
    more.className = 'empty';
    more.textContent = `…and ${repeats.length - top.length} more repeats not shown`;
    els.repeats.appendChild(more);
  }
}

function renderKeyLengths(scores, activeL) {
  els.keylens.innerHTML = '';
  const max = Math.max(...scores.slice(2));
  if (max === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No repeats — Kasiski cannot suggest a key length yet.';
    els.keylens.appendChild(empty);
    return;
  }

  for (let L = 2; L < scores.length; L++) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'candidate';
    if (L === activeL) row.classList.add('top');

    const barPct = Math.max(4, (scores[L] / max) * 100);

    const keyEl = document.createElement('span');
    keyEl.className = 'cand-key';
    keyEl.textContent = `L=${String(L).padStart(2, '0')}`;

    const textEl = document.createElement('span');
    textEl.className = 'cand-text';
    textEl.textContent = `${scores[L]} matching distances`;

    const scoreEl = document.createElement('span');
    scoreEl.className = 'cand-score';
    scoreEl.textContent = scores[L];

    const bar = document.createElement('span');
    bar.className = 'cand-bar';
    bar.style.width = `${barPct}%`;

    row.append(bar, keyEl, textEl, scoreEl);
    row.addEventListener('click', () => {
      manualKeyLength = L;
      update();
    });
    els.keylens.appendChild(row);
  }
}

function renderCosets(cracked) {
  els.cosets.innerHTML = '';
  for (const p of cracked.positions) {
    const card = document.createElement('div');
    card.className = 'coset-card';

    // ── Header: position, coset preview, winning letter, χ² ──
    const header = document.createElement('div');
    header.className = 'coset-header';

    const idx = document.createElement('span');
    idx.className = 'coset-idx';
    idx.textContent = `coset #${p.pos}`;

    const len = document.createElement('span');
    len.className = 'coset-len';
    len.textContent = `${p.cosetLen} letters`;

    const arrow = document.createElement('span');
    arrow.className = 'coset-arrow';
    arrow.textContent = '→';

    const letter = document.createElement('span');
    letter.className = 'coset-letter';
    letter.textContent = ALPHABET[p.bestK];

    const shift = document.createElement('span');
    shift.className = 'coset-shift';
    shift.textContent = `shift ${p.bestK} · χ² ${p.bestScore.toFixed(1)}`;

    header.append(idx, len, arrow, letter, shift);
    card.appendChild(header);

    // ── Raw coset letters ──
    const rawLabel = document.createElement('div');
    rawLabel.className = 'coset-sublabel';
    rawLabel.textContent = 'every Lth letter from the ciphertext';
    const raw = document.createElement('div');
    raw.className = 'coset-raw';
    raw.textContent = p.coset;
    card.append(rawLabel, raw);

    // ── Spectrum: all 26 shift scores ──
    const specLabel = document.createElement('div');
    specLabel.className = 'coset-sublabel';
    specLabel.textContent = 'χ² for each candidate Caesar shift (lower is more English)';
    card.appendChild(specLabel);

    const spectrum = document.createElement('div');
    spectrum.className = 'coset-spectrum';

    // Normalise within this coset so the colour ramp uses the full range.
    const finite = p.allScores.filter(isFinite);
    const minS = Math.min(...finite);
    const maxS = Math.max(...finite);
    const range = maxS - minS || 1;

    for (let k = 0; k < 26; k++) {
      const s = p.allScores[k];
      const norm = isFinite(s) ? (s - minS) / range : 1; // 0 = best, 1 = worst
      // Green (best, hue 130) → red (worst, hue 0). Saturation/lightness fixed.
      const hue = 130 * (1 - norm);
      const cell = document.createElement('div');
      cell.className = 'spec-cell';
      if (k === p.bestK) cell.classList.add('best');
      cell.style.background = `hsl(${hue}, 55%, ${k === p.bestK ? 40 : 22}%)`;

      const lt = document.createElement('span');
      lt.className = 'spec-letter';
      lt.textContent = ALPHABET[k];

      const sc = document.createElement('span');
      sc.className = 'spec-score';
      sc.textContent = isFinite(s) ? s.toFixed(0) : '∞';

      cell.append(lt, sc);
      cell.title = `Shift ${k} (key letter ${ALPHABET[k]}) · χ² = ${isFinite(s) ? s.toFixed(2) : '∞'}`;
      spectrum.appendChild(cell);
    }
    card.appendChild(spectrum);

    els.cosets.appendChild(card);
  }
}

function renderRecovered(key, fullCiphertext) {
  els.bestKey.textContent = key || '–';
  els.bestLen.textContent = key.length || '–';
  els.bestPlaintext.textContent = vigenereDecrypt(fullCiphertext, key) || '\u00a0';
}

// ── Main update loop ────────────────────────────────────────────────────────

function update() {
  const cipherRaw = els.ciphertext.value;
  const cipherClean = cleanLetters(cipherRaw);

  const repeats = findRepeats(cipherClean);
  renderRepeats(repeats);

  const scores = scoreKeyLengths(repeats);
  const autoL = pickBestKeyLength(scores);
  const activeL = manualKeyLength ?? autoL;
  renderKeyLengths(scores, activeL);

  els.activeLenLabel.textContent  = activeL;
  els.activeLenLabel2.textContent = activeL;

  if (cipherClean.length === 0) {
    els.cosets.innerHTML = '';
    renderRecovered('', cipherRaw);
    return;
  }

  const cracked = crackForLength(cipherClean, activeL);
  renderCosets(cracked);
  renderRecovered(cracked.key, cipherRaw);
}

// ── Sample data ─────────────────────────────────────────────────────────────

const SAMPLE_PLAINTEXT =
  'Cryptography is the practice and study of techniques for secure ' +
  'communication in the presence of third parties called adversaries. ' +
  'The art of writing and solving codes has fascinated mathematicians ' +
  'and spies for centuries. Modern cryptography sits at the intersection ' +
  'of mathematics, computer science, and electrical engineering, and it ' +
  'underpins almost everything we do online today.';
const SAMPLE_KEY = 'LEMON';

function loadSample() {
  els.ciphertext.value = vigenereEncrypt(SAMPLE_PLAINTEXT, SAMPLE_KEY);
  els.sampleHint.textContent =
    `Sample is the paragraph above encrypted with key "${SAMPLE_KEY}". ` +
    `The cracker doesn't know that — see if it agrees.`;
  manualKeyLength = null;
  update();
}

// ── Wire up ─────────────────────────────────────────────────────────────────

els.ciphertext.addEventListener('input', () => {
  manualKeyLength = null;
  update();
});
els.crackBtn.addEventListener('click', update);
els.sampleBtn.addEventListener('click', loadSample);

loadSample();
