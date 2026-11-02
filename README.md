# Daily Multiplication Trainer

Ten minutes of mental multiplication a day. Plain HTML/CSS/JS, works offline, no backend.

## Using it
- **Online:** your GitHub Pages URL (see below).
- **Offline:** double-click `index.html` (Chrome/Edge/Safari). Everything (libraries, fonts) is in this folder.

Data lives in the browser's IndexedDB **for that address**. The GitHub Pages copy and the opened-from-file copy keep
separate data, and so does each laptop. Use **Export** and **Import** (or drag the file onto the window) to move sessions between them.
Import always combines and never replaces anything.

## Folder
```
index.html          the app
css/app.css         styles
js/*.js             ES-module source
js/app.bundle.js    ready-made single-file copy of js/ (what index.html loads; makes file:// work)
vendor/             GSAP (+SplitText, DrawSVG), NumberFlow, d3-scale/shape/array, idb
fonts/              Geist and Geist Mono
dev/                dev-only fake-data tools (not linked from the app)
tests/              unit tests (node --test)
tools/              build.js (refresh the bundle), vendor.js (refresh libraries)
```

## Editing the code
You need Node 20+ only if you change the code:
```
npm install        # once
npm test           # unit tests
npm run build      # after editing js/ or dev/, regenerates js/app.bundle.js and dev/dev.bundle.js
```
On a local server (`python3 -m http.server`), `index.html?src` runs the ES-module sources directly, without the bundle.

## Fake data (dev only)
Open `dev/index.html` in the same browser and pick a button: ~6 months, ~18 months (≈50k questions), or download
a fake export file. It writes into the same storage as your real data, so use a separate browser profile or export first.
"Delete all data" on that page wipes everything in that browser.

## Putting it on GitHub Pages
1. Create a new repository on github.com (e.g. `multiplication`). Public, or private on a paid plan.
2. In this folder:
   ```
   git init
   git add .
   git commit -m "Daily Multiplication Trainer"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/multiplication.git
   git push -u origin main
   ```
   (Or use "uploading an existing file" on the repo page and drag everything in, except `node_modules`.)
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
4. After about a minute the site is at `https://YOUR-USERNAME.github.io/multiplication/`.
   Updates: commit and push again (run `npm run build` first if you changed code in `js/`).

`.nojekyll` is included so GitHub serves the files as-is.
