# Repository Guidelines

## Project Structure & Module Organization

CENTER LAB is a dependency-free, browser-local PTCG card centering tool.

- `dist/` contains the editable application source and deployable assets: `index.html`, `style.css`, `app.js`, geometry utilities, detection/rectification cores, and their Web Workers. Edit these files directly.
- `tests/` contains standalone CommonJS regression scripts.
- `tools/` contains the local server, static checks, test runner, and offline bundler.
- `.github/workflows/pages.yml` checks pull requests and deploys `dist/` from `main`.
- `outputs/` holds generated offline HTML and is Git-ignored.

## Build, Test, and Development Commands

Use Node.js 20 or newer; CI uses Node.js 24. No dependency installation is required.

- `npm start`: serve `dist/` at `http://127.0.0.1:4173`; override the port with `PORT`.
- `npm run check`: validate project-relative assets and Worker imports for GitHub Pages subpaths.
- `npm test`: run static checks, all regression scripts, the offline build, and standalone interaction checks.
- `npm run build`: generate `outputs/PTCG-Center-Lab.html`, a self-contained offline version.
- `node tests/geometry.cjs`: run a focused regression script.

## Coding Style & Naming Conventions

Use vanilla JavaScript, HTML, and CSS. Preserve each file's existing compact formatting and indentation; avoid unrelated reformatting. JavaScript uses semicolons, single-quoted strings, and camelCase identifiers. Use lowercase, hyphen-separated filenames and `.cjs` for Node tools/tests. Preserve browser globals such as `CenterGeometry` and CommonJS exports used by tests. Keep interface copy consistent with the existing Chinese text. No formatter or linter is configured; follow `.gitattributes` LF rules.

## Testing Guidelines

Tests use Node's `node:assert/strict` and `node:vm`, with synthetic images and DOM/Worker substitutes. Name tests `tests/<feature>.cjs` and register new scripts in `tools/test.cjs`. Cover relevant geometry, detection, precision, import compatibility, or export behavior; no numeric coverage threshold is configured. Run `npm test` before submitting. For interface changes, also verify desktop/mobile layouts in a browser: DOM substitutes do not validate visual layout.

## Commit & Pull Request Guidelines

The single existing commit uses a descriptive imperative subject, `Open source CENTER LAB ...`; no prefix convention is established. Write concise imperative subjects. Pull requests should describe the change, link relevant issues, report validation commands/results, and include screenshots for interface changes.

## Architecture & Configuration Constraints

Preserve original-resolution floating-point coordinates; only previews may scale. Keep clean PNG exports free of overlays and retain legacy four-corner JSON compatibility. Processing stays local: avoid image uploads or third-party scripts. Keep asset paths relative and hosting-account metadata, secrets, and generated output outside commits.
