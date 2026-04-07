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
      },
    },
  },
});
