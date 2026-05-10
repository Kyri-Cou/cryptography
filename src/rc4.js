// Shared cryptographic primitives used by the attack pages.

export function rc4(key, data) {
  const k = key instanceof Uint8Array ? key : new Uint8Array(key);
  const d = data instanceof Uint8Array ? data : new Uint8Array(data);
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + k[i % k.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(d.length);
  let a = 0; j = 0;
  for (let i = 0; i < d.length; i++) {
    a = (a + 1) & 0xff;
    j = (j + S[a]) & 0xff;
    [S[a], S[j]] = [S[j], S[a]];
    out[i] = d[i] ^ S[(S[a] + S[j]) & 0xff];
  }
  return out;
}

export function xorBytes(a, b) {
  const len = Math.min(a.length, b.length);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i];
  return out;
}

export function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(str) {
  const clean = str.replace(/[\s:]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function printableScore(bytes) {
  if (!bytes.length) return 0;
  return bytes.filter(b => b >= 0x20 && b <= 0x7e).length / bytes.length;
}

export function hexSpaced(hex, n = 4) {
  const parts = [];
  for (let i = 0; i < hex.length; i += n) parts.push(hex.slice(i, i + n));
  return parts.join(' ');
}
