// Caesar cipher visualisation.
// Renders two alphabet tracks, an input/output panel, and a per-character
// mapping grid that updates live as the user types or moves the shift slider.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const $ = (id) => document.getElementById(id);

const els = {
  plaintext:    $('plaintext'),
  shift:        $('shift'),
  shiftDisplay: $('shift-display'),
  trackShift:   $('track-shift'),
  trackPlain:   $('track-plain'),
  trackCipher:  $('track-cipher'),
  input:        $('input-display'),
  output:       $('output-display'),
  inputLabel:   $('input-label'),
  outputLabel:  $('output-label'),
  mapping:      $('mapping'),
  toggle:       $('decrypt-toggle'),
};

let mode = 'encrypt'; // or 'decrypt'

function shiftChar(ch, k) {
  const upper = ch.toUpperCase();
  const idx = ALPHABET.indexOf(upper);
  if (idx === -1) return ch;
  const shifted = ALPHABET[(idx + k + 26) % 26];
  return ch === upper ? shifted : shifted.toLowerCase();
}

function caesar(text, k) {
  return [...text].map((c) => shiftChar(c, k)).join('');
}

function buildTracks() {
  els.trackPlain.innerHTML = '';
  els.trackCipher.innerHTML = '';
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div');
    p.className = 'cell';
    p.textContent = ALPHABET[i];
    p.dataset.index = i;
    els.trackPlain.appendChild(p);

    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.index = i;
    els.trackCipher.appendChild(c);
  }
}

function renderTracks(k) {
  // Cipher track shows the shifted alphabet column-aligned with the plaintext.
  const cipherCells = els.trackCipher.children;
  for (let i = 0; i < 26; i++) {
    cipherCells[i].textContent = ALPHABET[(i + k) % 26];
  }
}

function highlightUsedLetters(text, k) {
  const plain = els.trackPlain.children;
  const cipher = els.trackCipher.children;
  for (let i = 0; i < 26; i++) {
    plain[i].classList.remove('highlight');
    cipher[i].classList.remove('highlight');
  }
  const seen = new Set();
  for (const ch of text.toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1 || seen.has(idx)) continue;
    seen.add(idx);
    plain[idx].classList.add('highlight');
    cipher[idx].classList.add('highlight');
  }
}

function renderMapping(text, k) {
  els.mapping.innerHTML = '';
  for (const ch of text) {
    const pair = document.createElement('div');
    pair.className = 'pair';
    const isLetter = /[a-zA-Z]/.test(ch);
    if (!isLetter) pair.classList.add('passthrough');

    const from = document.createElement('span');
    from.className = 'from';
    from.textContent = ch === ' ' ? '␣' : ch;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '↓';

    const to = document.createElement('span');
    to.className = 'to';
    const mapped = shiftChar(ch, k);
    to.textContent = mapped === ' ' ? '␣' : mapped;

    pair.append(from, arrow, to);
    els.mapping.appendChild(pair);
  }
}

function update() {
  const rawShift = parseInt(els.shift.value, 10);
  // In decrypt mode the displayed key is still positive, but we apply -k.
  const k = mode === 'encrypt' ? rawShift : (26 - rawShift) % 26;

  els.shiftDisplay.textContent = rawShift;
  els.trackShift.textContent = rawShift;

  const inputText = els.plaintext.value;
  const outputText = caesar(inputText, k);

  els.input.textContent = inputText || '\u00a0';
  els.output.textContent = outputText || '\u00a0';

  // Tracks always show the encryption shift visually so the slider has a
  // consistent meaning regardless of mode.
  renderTracks(rawShift);
  highlightUsedLetters(inputText, rawShift);
  renderMapping(inputText, k);
}

function setMode(next) {
  mode = next;
  if (mode === 'encrypt') {
    els.toggle.textContent = 'Switch to decrypt';
    els.inputLabel.textContent  = 'Plaintext';
    els.outputLabel.textContent = 'Ciphertext';
    els.plaintext.previousElementSibling.textContent = 'Plaintext';
  } else {
    els.toggle.textContent = 'Switch to encrypt';
    els.inputLabel.textContent  = 'Ciphertext';
    els.outputLabel.textContent = 'Plaintext';
    els.plaintext.previousElementSibling.textContent = 'Ciphertext';
  }
  update();
}

buildTracks();
els.plaintext.addEventListener('input', update);
els.shift.addEventListener('input', update);
els.toggle.addEventListener('click', () => {
  setMode(mode === 'encrypt' ? 'decrypt' : 'encrypt');
});
update();
