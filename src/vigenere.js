// Vigenère cipher visualisation.
// Per-character mapping shows the key letter aligned beneath each plaintext
// letter, plus a tabula recta with row/column hover highlighting.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const $ = (id) => document.getElementById(id);

const els = {
  plaintext:    $('plaintext'),
  keyword:      $('keyword'),
  toggle:       $('decrypt-toggle'),
  input:        $('input-display'),
  output:       $('output-display'),
  inputLabel:   $('input-label'),
  outputLabel:  $('output-label'),
  mapping:      $('mapping'),
  tabula:       $('tabula'),
};

let mode = 'encrypt';

function letterIndex(ch) {
  return ALPHABET.indexOf(ch.toUpperCase());
}

// Sanitised key — letters only, uppercase. Falls back to "A" (a no-op) so the
// page never breaks while the user is mid-edit.
function cleanKey(raw) {
  const k = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  return k || 'A';
}

function vigenere(text, key, sign) {
  let out = '';
  let keyPos = 0;
  for (const ch of text) {
    const idx = letterIndex(ch);
    if (idx === -1) {
      out += ch;
      continue;
    }
    const k = letterIndex(key[keyPos % key.length]);
    const shifted = ALPHABET[(idx + sign * k + 26) % 26];
    out += ch === ch.toUpperCase() ? shifted : shifted.toLowerCase();
    keyPos++;
  }
  return out;
}

// Build the same key-letter stream the cipher walks, with `null` slots for
// non-letters so the mapping grid stays aligned with the input.
function keyStream(text, key) {
  const stream = [];
  let keyPos = 0;
  for (const ch of text) {
    if (letterIndex(ch) === -1) {
      stream.push(null);
    } else {
      stream.push(key[keyPos % key.length]);
      keyPos++;
    }
  }
  return stream;
}

function buildTabula() {
  els.tabula.innerHTML = '';

  // Header row: blank corner + plaintext letters across the top.
  const corner = document.createElement('div');
  corner.className = 'tab-cell tab-corner';
  els.tabula.appendChild(corner);
  for (let c = 0; c < 26; c++) {
    const head = document.createElement('div');
    head.className = 'tab-cell tab-col-head';
    head.textContent = ALPHABET[c];
    head.dataset.col = c;
    els.tabula.appendChild(head);
  }

  // Each subsequent row: key letter + the alphabet shifted by that key.
  for (let r = 0; r < 26; r++) {
    const rowHead = document.createElement('div');
    rowHead.className = 'tab-cell tab-row-head';
    rowHead.textContent = ALPHABET[r];
    rowHead.dataset.row = r;
    els.tabula.appendChild(rowHead);

    for (let c = 0; c < 26; c++) {
      const cell = document.createElement('div');
      cell.className = 'tab-cell';
      cell.textContent = ALPHABET[(r + c) % 26];
      cell.dataset.row = r;
      cell.dataset.col = c;
      els.tabula.appendChild(cell);
    }
  }
}

function highlightTabula(text, key) {
  // Clear previous highlights.
  for (const el of els.tabula.querySelectorAll('.tab-cell.hl-row, .tab-cell.hl-col, .tab-cell.hl-cell')) {
    el.classList.remove('hl-row', 'hl-col', 'hl-cell');
  }

  // Highlight rows/columns for every (key, plaintext) letter pair currently
  // in use. Rows = key letters; columns = plaintext letters.
  const usedRows = new Set();
  const usedCols = new Set();
  const usedCells = new Set();

  const stream = keyStream(text, key);
  for (let i = 0; i < text.length; i++) {
    const k = stream[i];
    if (k === null) continue;
    const col = letterIndex(text[i]);
    const row = letterIndex(k);
    if (col === -1 || row === -1) continue;
    usedRows.add(row);
    usedCols.add(col);
    usedCells.add(`${row},${col}`);
  }

  for (const row of usedRows) {
    for (const el of els.tabula.querySelectorAll(`.tab-row-head[data-row="${row}"]`)) {
      el.classList.add('hl-row');
    }
  }
  for (const col of usedCols) {
    for (const el of els.tabula.querySelectorAll(`.tab-col-head[data-col="${col}"]`)) {
      el.classList.add('hl-col');
    }
  }
  for (const key of usedCells) {
    const [row, col] = key.split(',');
    const el = els.tabula.querySelector(`.tab-cell[data-row="${row}"][data-col="${col}"]:not(.tab-row-head):not(.tab-col-head)`);
    if (el) el.classList.add('hl-cell');
  }
}

function renderMapping(text, key, sign) {
  els.mapping.innerHTML = '';
  const stream = keyStream(text, key);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isLetter = letterIndex(ch) !== -1;

    const col = document.createElement('div');
    col.className = 'vig-col';
    if (!isLetter) col.classList.add('passthrough');

    const from = document.createElement('span');
    from.className = 'from';
    from.textContent = ch === ' ' ? '␣' : ch;

    const keyEl = document.createElement('span');
    keyEl.className = 'key';
    keyEl.textContent = stream[i] ?? '·';

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '↓';

    const to = document.createElement('span');
    to.className = 'to';
    if (isLetter) {
      const idx = letterIndex(ch);
      const k = letterIndex(stream[i]);
      const shifted = ALPHABET[(idx + sign * k + 26) % 26];
      to.textContent = ch === ch.toUpperCase() ? shifted : shifted.toLowerCase();
    } else {
      to.textContent = ch === ' ' ? '␣' : ch;
    }

    col.append(from, keyEl, arrow, to);
    els.mapping.appendChild(col);
  }
}

function update() {
  const key = cleanKey(els.keyword.value);
  const sign = mode === 'encrypt' ? 1 : -1;

  const inputText = els.plaintext.value;
  const outputText = vigenere(inputText, key, sign);

  els.input.textContent = inputText || '\u00a0';
  els.output.textContent = outputText || '\u00a0';

  renderMapping(inputText, key, sign);
  highlightTabula(inputText, key);
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

buildTabula();
els.plaintext.addEventListener('input', update);
els.keyword.addEventListener('input', update);
els.toggle.addEventListener('click', () => {
  setMode(mode === 'encrypt' ? 'decrypt' : 'encrypt');
});
update();
