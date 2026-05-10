import './nav.js';
import { rc4, xorBytes, toHex, hexSpaced } from './rc4.js';

const enc = new TextEncoder();

// ── WEP constants ──────────────────────────────────────────────────────────
// 40-bit WEP: 3-byte IV prepended to 5-byte secret key → 8-byte RC4 key
const SECRET_KEY_LEN = 5;
const IV_LEN = 3;
const IV_SPACE = 1 << 24;  // 2^24 = 16,777,216

// ── Simulation state ───────────────────────────────────────────────────────
let secretKey = null;
let ivsSeen = new Map();         // iv24 → { ivBytes, ciphertext, payloadIdx }
let recentPackets = [];          // ring buffer — last 6 packets for display only
let packetCount = 0;
let running = false;
let rafId = null;
let collisionPair = null;

// Realistic-ish payload templates (cleartext after LLC/SNAP header)
// In real WEP, the first 8 bytes are always LLC/SNAP: AA AA 03 00 00 00 + EtherType
const LLC_SNAP = new Uint8Array([0xAA, 0xAA, 0x03, 0x00, 0x00, 0x00]);
const PAYLOADS = [
  'GET / HTTP/1.1',
  'POST /login HTTP',
  'ARP who-has 10.0',
  'DNS query: google',
  'DHCP Discover msg',
  'GET /index.html H',
  'ICMP echo request',
  'TLS ClientHello v',
];

function makePayload(idx) {
  const text = enc.encode(PAYLOADS[idx % PAYLOADS.length]);
  const full = new Uint8Array(LLC_SNAP.length + text.length);
  full.set(LLC_SNAP);
  full.set(text, LLC_SNAP.length);
  return full;
}

// ── WEP encrypt: RC4(IV || secretKey, payload) ─────────────────────────────
function wepEncrypt(ivBytes, payload) {
  const fullKey = new Uint8Array(IV_LEN + SECRET_KEY_LEN);
  fullKey.set(ivBytes);
  fullKey.set(secretKey, IV_LEN);
  return rc4(fullKey, payload);
}

function randomIv() {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  return { bytes: iv, int: (iv[0] << 16) | (iv[1] << 8) | iv[2] };
}

// ── Birthday paradox probability ───────────────────────────────────────────
// P(collision after n packets) ≈ 1 - e^(-n*(n-1)/(2*N))  where N = 2^24
function collisionProb(n) {
  return 1 - Math.exp(-n * (n - 1) / (2 * IV_SPACE));
}

// ── Simulation loop ────────────────────────────────────────────────────────
const BATCH = 20;  // packets per animation frame

function simulate() {
  if (!running) return;

  for (let i = 0; i < BATCH && !collisionPair; i++) {
    const iv = randomIv();
    const payload = makePayload(packetCount);
    const ciphertext = wepEncrypt(iv.bytes, payload);
    const packet = { ivBytes: iv.bytes, ciphertext, payloadIdx: packetCount % PAYLOADS.length };

    if (ivsSeen.has(iv.int)) {
      collisionPair = { a: ivsSeen.get(iv.int), b: packet, iv: iv.bytes };
    } else {
      ivsSeen.set(iv.int, packet);
    }
    recentPackets.push(packet);
    if (recentPackets.length > 6) recentPackets.shift();
    packetCount++;
  }

  renderStatus();

  if (collisionPair) {
    running = false;
    onCollision();
    return;
  }
  rafId = requestAnimationFrame(simulate);
}

// ── Render running status ──────────────────────────────────────────────────
function renderStatus() {
  document.getElementById('pkt-count').textContent = packetCount.toLocaleString();
  const prob = collisionProb(packetCount);
  document.getElementById('prob-bar').style.width = (prob * 100).toFixed(1) + '%';
  document.getElementById('prob-pct').textContent = (prob * 100).toFixed(1) + '%';

  // Show last few packets (most recent first) — use ring buffer, not the full Map
  const list = document.getElementById('packet-list');
  list.innerHTML = [...recentPackets].reverse().map(pkt => {
    const ivHex = toHex(pkt.ivBytes);
    const ctHex = toHex(pkt.ciphertext.slice(0, 6)) + '…';
    return `<div class="pkt-row">
      <span class="pkt-iv">${ivHex}</span>
      <span class="pkt-ct">${ctHex}</span>
      <span class="pkt-payload dim">${PAYLOADS[pkt.payloadIdx]}</span>
    </div>`;
  }).join('');
}

// ── Collision handler ──────────────────────────────────────────────────────
function onCollision() {
  const { a, b, iv } = collisionPair;
  const xorCt = xorBytes(a.ciphertext, b.ciphertext);

  document.getElementById('collision-section').hidden = false;

  document.getElementById('col-iv').textContent = toHex(iv);
  document.getElementById('col-pkts').textContent = packetCount.toLocaleString();
  document.getElementById('col-a-ct').textContent = hexSpaced(toHex(a.ciphertext));
  document.getElementById('col-b-ct').textContent = hexSpaced(toHex(b.ciphertext));
  document.getElementById('col-xor-ct').textContent = hexSpaced(toHex(xorCt));

  // Apply LLC/SNAP crib at position 0
  const crib = LLC_SNAP;
  const cribResult = xorBytes(xorCt.slice(0, crib.length), crib);

  document.getElementById('crib-section2').hidden = false;
  document.getElementById('crib-crib').textContent = toHex(crib);
  document.getElementById('crib-crib-str').textContent =
    Array.from(crib).map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
  document.getElementById('crib-result-hex').textContent = toHex(cribResult);
  document.getElementById('crib-result-str').textContent =
    Array.from(cribResult).map(b => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '·').join('');
  // LLC/SNAP crib contains non-printable bytes (0xAA, 0x03, 0x00) so printableScore
  // is meaningless here — the crib always matches by construction (same header on every frame)
  document.getElementById('crib-score').textContent = 'match';

  // Reveal actual plaintext for comparison
  document.getElementById('col-a-pt').textContent =
    Array.from(makePayload(a.payloadIdx)).map(b => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2,'0')}`).join('');
  document.getElementById('col-b-pt').textContent =
    Array.from(makePayload(b.payloadIdx)).map(b => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : `\\x${b.toString(16).padStart(2,'0')}`).join('');

  document.getElementById('reveal-section').hidden = false;

  document.getElementById('capture-btn').textContent = 'Reset';
  document.getElementById('capture-btn').classList.remove('primary');
}

// ── Controls ───────────────────────────────────────────────────────────────
function startCapture() {
  // Reset
  cancelAnimationFrame(rafId);
  ivsSeen.clear();
  recentPackets = [];
  packetCount = 0;
  collisionPair = null;
  running = true;
  document.getElementById('collision-section').hidden = true;
  document.getElementById('crib-section2').hidden = true;
  document.getElementById('reveal-section').hidden = true;
  document.getElementById('capture-btn').textContent = 'Stop capture';
  document.getElementById('capture-btn').classList.add('primary');

  // Generate a fresh secret key
  secretKey = crypto.getRandomValues(new Uint8Array(SECRET_KEY_LEN));
  document.getElementById('wep-key-display').textContent = toHex(secretKey);

  rafId = requestAnimationFrame(simulate);
}

function stopCapture() {
  running = false;
  cancelAnimationFrame(rafId);
  document.getElementById('capture-btn').textContent = 'Resume capture';
}

document.getElementById('capture-btn').addEventListener('click', () => {
  if (collisionPair) { startCapture(); return; }
  if (running) { stopCapture(); } else { startCapture(); }
});

// Boot
document.getElementById('wep-key-display').textContent = '— press Start capture —';
