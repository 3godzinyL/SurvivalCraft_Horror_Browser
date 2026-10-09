# NightCraft V22 — GitHub Pages verification

- Native ES modules and runtime data use URLs relative to their own module (`import.meta.url`) or the HTML document, not absolute-root `/...` URLs.
- Worker path remains module-relative (`new URL('./world-worker.js', import.meta.url)`).
- The Windows launcher and `server.cjs` are still bundled in the complete source ZIP, and not included in the deployed static website.
- `dist-pages/` is created automatically from `index.html`, styles, `src/`, `data/` and `assets/` with `.nojekyll`.
- Automated HTTP tests load every static file under both `/` and `/nightcraft/` and confirm that invalid prefixes return 404.
- Older world formats, fixed block IDs and worldgen hashes are checked by `npm run check`.
- IndexedDB saves for different project-site path prefixes have different keys (`main@/repo/`) while the legacy localhost/root key remains `main`.

## Not tested here

- The remote deployment itself was not executed (requires the repository owner's GitHub account and selecting Pages → GitHub Actions).
- Actual WebGL rendering and GPU performance have not been fully exercised in this test environment: headless Chromium could not initialize a graphics context. Browser compatibility must be checked on the target computer.
- Windows `.bat` and the PowerShell fallback were validated statically, not run on Windows in this environment.
