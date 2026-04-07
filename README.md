# Cryptography Visualisations

[![YouTube Channel](https://img.shields.io/badge/YouTube-Related%20content-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/channel/UCKWTNfBKMVPzy5JgEhC6Ghg)

Interactive, browser-based visualisations of classical and modern cryptographic
functions. Built as a static site with [Vite](https://vitejs.dev/) and deployed
to GitHub Pages.

**Live site:** https://kyri-cou.github.io/cryptography/

**Companion videos:** https://www.youtube.com/channel/UCKWTNfBKMVPzy5JgEhC6Ghg

## Pages

- **Home** (`/`) — index of available cipher visualisations.
- **Caesar Cipher** (`/ciphers/caesar.html`) — live shift slider, twin
  alphabet tracks, per-character mapping grid, and an encrypt/decrypt toggle.

More ciphers will be added as separate pages under `ciphers/`.

## Local development

```bash
npm install
npm run dev      # start the Vite dev server
npm run build    # produce a production build in dist/
npm run preview  # preview the production build locally
```

## Project layout

```
index.html              # landing page
ciphers/                # one HTML file per cipher
  caesar.html
src/
  styles.css            # shared stylesheet (palette mirrors the course theme)
  caesar.js             # Caesar cipher logic + DOM rendering
vite.config.js          # multi-page Vite config; sets the GH Pages base path
.github/workflows/
  deploy.yml            # builds and publishes to GitHub Pages on push to main
```

The colour palette in `src/styles.css` is the canonical course theme used
across all visualisations:

| Role        | Colour    |
| ----------- | --------- |
| Plaintext   | `#3fb950` |
| Ciphertext  | `#ff7b72` |
| Key         | `#d2a8ff` |
| Algorithm   | `#79c0ff` |
| Heading     | `#f0c040` |

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs
`npm run build` and publishes `dist/` to GitHub Pages via the official
`actions/deploy-pages` action.

If you fork this repo under a different name, override the base path at build
time:

```bash
VITE_BASE=/your-repo-name/ npm run build
```
