import './nav.js';
import { rc4, toHex } from './rc4.js';

// ── Netscape-style weak PRNG ───────────────────────────────────────────────
// Seed = time ^ pid
// Then use glibc LCG to generate key bytes.
// Real Netscape (1994): sslc.c used MD5(time ^ pid ^ ppid ^ sequence) but the
// seed space was < 2^20 because time ≈ known ± 1 min and pid < 1000 on the system.

function lcgNext(state) {
  // glibc rand() parameters
  return ((Math.imul(state, 1103515245) + 12345) & 0x7fffffff) >>> 0;
}

function generateKeyFromSeed(seed, keyLen) {
  const bytes = new Uint8Array(keyLen);
  let s = seed >>> 0;
  for (let i = 0; i < keyLen; i++) {
    s = lcgNext(s);
    bytes[i] = (s >>> 23) & 0xff;
  }
  return bytes;
}

// ── Scenario setup ─────────────────────────────────────────────────────────
const KEY_LEN = 16;        // 128-bit SSL session key
const TIME_WINDOW = 60;    // attacker knows time ± 60 seconds
const PID_MAX = 1024;      // 1994-era Unix: PIDs rarely exceeded 1000

// Known plaintext: SSL CLIENT_HELLO challenge is always 16 zero bytes.
const KNOWN_PLAIN = new Uint8Array(KEY_LEN);  // 16 × 0x00

let trueTime, truePid, trueSeed, trueKey, encryptedChallenge;

function initScenario() {
  // Pick a "true" time (current unix seconds) and a small PID
  trueTime = Math.floor(Date.now() / 1000);
  truePid = 1 + Math.floor(Math.random() * PID_MAX);
  trueSeed = (trueTime ^ truePid) >>> 0;
  trueKey = generateKeyFromSeed(trueSeed, KEY_LEN);

  // RC4-encrypt the known plaintext (challenge) with the generated key
  encryptedChallenge = rc4(trueKey, KNOWN_PLAIN);

  // Update UI
  document.getElementById('scenario-time').textContent =
    new Date(trueTime * 1000).toUTCString();
  document.getElementById('scenario-pid').textContent = '???';
  document.getElementById('intercepted-hex').textContent = toHex(encryptedChallenge);
  document.getElementById('known-plain-hex').textContent = toHex(KNOWN_PLAIN);
  document.getElementById('key-len').textContent = KEY_LEN * 8;

  const searchSpace = (TIME_WINDOW * 2 + 1) * PID_MAX;
  document.getElementById('search-space').textContent = searchSpace.toLocaleString();
  document.getElementById('brute-bits').textContent = Math.log2(searchSpace).toFixed(1);

  resetCrackUI();
}

// ── Brute force ────────────────────────────────────────────────────────────
let crackRunning = false;
let crackTimer = null;
let crackT, crackPid, crackAttempts, crackTarget;

const BATCH_SIZE = 5000;   // seeds per tick
const TICK_MS = 16;        // update UI every ~frame

function resetCrackUI() {
  document.getElementById('crack-result').hidden = true;
  document.getElementById('crack-attempts').textContent = '0';
  document.getElementById('crack-speed').textContent = '–';
  document.getElementById('crack-progress').style.width = '0%';
  document.getElementById('crack-btn').disabled = false;
  document.getElementById('crack-btn').textContent = 'Crack it';
}

function startCrack() {
  if (crackRunning) return;
  crackRunning = true;
  crackAttempts = 0;
  crackT = trueTime - TIME_WINDOW;
  crackPid = 1;
  crackTarget = toHex(encryptedChallenge);

  const totalSpace = (TIME_WINDOW * 2 + 1) * PID_MAX;
  const startMs = performance.now();
  let lastMs = startMs;

  document.getElementById('crack-btn').disabled = true;
  document.getElementById('crack-btn').textContent = 'Cracking…';

  function tick() {
    if (!crackRunning) return;

    const batchEnd = crackAttempts + BATCH_SIZE;
    while (crackAttempts < batchEnd) {
      const seed = (crackT ^ crackPid) >>> 0;
      const candidateKey = generateKeyFromSeed(seed, KEY_LEN);
      const decrypted = rc4(candidateKey, encryptedChallenge);

      // RC4(RC4(plaintext)) = plaintext; check if decrypted = 16 zero bytes
      if (decrypted.every(b => b === 0)) {
        // Found!
        crackRunning = false;
        const elapsed = ((performance.now() - startMs) / 1000).toFixed(2);

        document.getElementById('crack-attempts').textContent = crackAttempts.toLocaleString();
        document.getElementById('crack-progress').style.width = '100%';
        document.getElementById('crack-result').hidden = false;
        document.getElementById('found-seed').textContent = `0x${seed.toString(16).toUpperCase()}`;
        document.getElementById('found-time').textContent = crackT;
        document.getElementById('found-pid').textContent = crackPid;
        document.getElementById('found-key').textContent = toHex(candidateKey);
        document.getElementById('scenario-pid').textContent = truePid;
        document.getElementById('found-elapsed').textContent = elapsed + 's';
        document.getElementById('crack-btn').textContent = 'Run again';
        document.getElementById('crack-btn').disabled = false;
        return;
      }

      crackAttempts++;
      crackPid++;
      if (crackPid > PID_MAX) {
        crackPid = 1;
        crackT++;
        if (crackT > trueTime + TIME_WINDOW) {
          // Exhausted without finding — shouldn't happen
          crackRunning = false;
          document.getElementById('crack-btn').textContent = 'Not found — reload';
          document.getElementById('crack-btn').disabled = false;
          return;
        }
      }
    }

    // Update UI
    const now = performance.now();
    const rate = Math.round(BATCH_SIZE / ((now - lastMs) / 1000));
    lastMs = now;
    document.getElementById('crack-attempts').textContent = crackAttempts.toLocaleString();
    document.getElementById('crack-speed').textContent = rate.toLocaleString() + '/s';
    document.getElementById('crack-progress').style.width =
      Math.min((crackAttempts / totalSpace) * 100, 99).toFixed(1) + '%';

    crackTimer = setTimeout(tick, TICK_MS);
  }

  tick();
}

// ── Wire up ────────────────────────────────────────────────────────────────
document.getElementById('crack-btn').addEventListener('click', () => {
  if (!crackRunning) startCrack();
});

document.getElementById('new-scenario-btn').addEventListener('click', () => {
  crackRunning = false;
  clearTimeout(crackTimer);
  initScenario();
});

initScenario();
