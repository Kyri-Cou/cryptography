import { defineConfig } from 'vite';
import { resolve } from 'path';

// For GitHub Pages project sites the site is served from /<repo>/.
// Override with VITE_BASE if your repo name differs.
const base = process.env.VITE_BASE ?? '/cryptography/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        caesar: resolve(__dirname, 'ciphers/caesar.html'),
        caesarCrack: resolve(__dirname, 'ciphers/caesar-crack.html'),
        vigenere: resolve(__dirname, 'ciphers/vigenere.html'),
        vigenereCrack: resolve(__dirname, 'ciphers/vigenere-crack.html'),
        chiSquared:   resolve(__dirname, 'ciphers/chi-squared.html'),
        binary:       resolve(__dirname, 'ciphers/binary.html'),
        bitwiseAnd:   resolve(__dirname, 'ciphers/bitwise-and.html'),
        bitwiseOr:    resolve(__dirname, 'ciphers/bitwise-or.html'),
        bitwiseNot:   resolve(__dirname, 'ciphers/bitwise-not.html'),
        bitwiseXor:   resolve(__dirname, 'ciphers/bitwise-xor.html'),
      },
    },
  },
});
