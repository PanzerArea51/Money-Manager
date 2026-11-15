# Implementation Plan: PWA and GitHub Pages Hosting

## Overview

The design uses TypeScript, so all tasks use TypeScript with `strict` mode. The plan follows this order: pure helpers and constants, service worker and build plugin, manifest/icons/`index.html`, registration and `UpdatePrompt`, Vite `base` config, GitHub Actions workflow, documentation, tests, then a final checkpoint.

Rules that apply to every task (from `.kiro/steering`):
- Add no runtime or dev dependency. `fast-check` is already a dev dependency and is used for property tests.
- Named exports only, no `any`, no enums.
- PWA code lives in `src/pwa/`. `sw.ts` declares minimal worker types locally because `tsconfig` has the DOM lib and not WebWorker.
- Do not start dev servers; ask the user to run `npm run dev`. Run tests with `vitest --run`.
- Every property test uses at least 100 runs and carries the tag comment `Feature: pwa-github-pages, Property N: <text>`.
- Existing code (IndexedDB schema, domain, `useStoragePersistence`, `PersistenceNotice`) stays unchanged.

## Tasks

- [x] 1. Pure helpers and constants
  - [x] 1.1 Create `src/pwa/repoName.ts` and `src/pwa/basePath.ts`
    - Export `REPO_NAME = 'Money-Manager'`
    - Implement `toBasePath(repoName)` that strips surrounding slashes and returns `/<name>/`
    - _Requirements: 3.1, 3.2, 3.6, 11.3_

  - [x] 1.2 Create `src/pwa/cacheNames.ts` and `src/pwa/requestRouting.ts`
    - `cacheName(prefix, version)`, `cachePrefix(repoName)` (lowercased), `staleCacheNames(allNames, prefix, current)`
    - `chooseStrategy({ url, mode, method, scope })` returning `'navigation' | 'cache-first' | 'passthrough'`
    - No globals and no browser or Node imports
    - _Requirements: 4.3, 4.4, 4.5, 5.2, 5.4, 5.5, 5.11_

  - [x] 1.3 Create `src/pwa/buildVersion.ts`
    - Implement `computeBuildVersion(files)` with `node:crypto` SHA-256 over files sorted by path (path and bytes both hashed), first 12 hex characters
    - This module is Node only and is imported by the Vite plugin, never by `sw.ts`
    - _Requirements: 5.1, 10.2, 11.1_

- [x] 2. Service worker and build plugin
  - [x] 2.1 Implement `src/pwa/sw.ts`
    - Declare `__PRECACHE_URLS__`, `__CACHE_PREFIX__`, `__CACHE_VERSION__` and local minimal worker types
    - `install`: precache with `cache: 'reload'` requests into `cacheName(prefix, version)`, no `skipWaiting()`
    - `message`: call `skipWaiting()` only for `{ type: 'SKIP_WAITING' }`
    - `activate`: delete `staleCacheNames(...)` then `clients.claim()`
    - `fetch`: use `chooseStrategy`; passthrough returns without `respondWith`, navigation is network-first with cached `index.html` fallback, other in-scope requests are cache-first
    - Never touch IndexedDB or cache cross-origin requests
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.4, 5.5, 5.8, 5.10_

  - [x] 2.2 Implement `src/pwa/swPlugin.ts`
    - Vite plugin with `apply: 'build'` and a `closeBundle` hook
    - List files in `dist` except `sw.js`, compute the version with `computeBuildVersion`, run a nested `vite.build` (iife, `configFile: false`, `emptyOutDir: false`) emitting `dist/sw.js` with `define` values for the three constants
    - Throw on any failure so `npm run build` fails
    - _Requirements: 3.4, 5.1, 10.1, 10.2, 10.3_

- [x] 3. Manifest, icons and `index.html`
  - [x] 3.1 Create `scripts/generate-icons.mjs` and generate the PNGs
    - Hand-built PNG encoder using `node:zlib` (signature, IHDR, IDAT, IEND, CRC32)
    - Write `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (artwork inside the central 80% circle) and `apple-touch-icon.png` (180x180)
    - Run the script once with `node scripts/generate-icons.mjs` and commit the PNGs; the script is not part of `npm run build`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Create `public/manifest.webmanifest`
    - Fields from the design: `name`, `short_name` "Finance", `start_url` and `scope` as `./`, `display` `standalone`, `orientation` `portrait`, `theme_color` `#1a56c4`, `background_color` `#f4f5f7`, three icons with relative `src` and `type` `image/png`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.5_

  - [x] 3.3 Update `index.html`
    - Add `theme-color` meta, manifest link, icon link, `apple-touch-icon` link, and the two Apple web app meta tags, all using `%BASE_URL%`
    - Keep the existing viewport meta tag
    - _Requirements: 1.7, 1.8, 2.3, 2.5, 3.4_

- [x] 4. Registration and `UpdatePrompt`
  - [x] 4.1 Implement `src/pwa/register.ts`
    - `shouldPromptForUpdate(workerState, hasController)`: true only for `'installed'` with a controller
    - `registerServiceWorker(onUpdateReady)`: return silently without `serviceWorker` support, register `${import.meta.env.BASE_URL}sw.js` with `scope: BASE_URL` and `updateViaCache: 'none'`, catch and `console.error` failures, handle an existing waiting worker and `updatefound`, `apply` posts `SKIP_WAITING`, one `controllerchange` listener reloads once
    - _Requirements: 3.5, 4.1, 4.7, 4.8, 5.3, 5.6, 5.7, 5.9_

  - [x] 4.2 Implement `src/hooks/useServiceWorkerUpdate.ts`
    - Return `{ updateReady, apply, dismiss }`
    - Register once on mount, only when `import.meta.env.PROD`
    - _Requirements: 4.1, 5.6, 5.7, 5.9_

  - [x] 4.3 Implement `src/components/UpdatePrompt.tsx` and `UpdatePrompt.css`
    - Props `visible`, `onUpdate`, `onDismiss`; render `null` when not visible
    - `role="status"` banner "A new version is available." with "Update" and "Later" buttons using the existing `Button`, 44px touch targets, `update-prompt__*` class names, CSS variables only
    - Follow the `PersistenceNotice` pattern; place above the tab bar and below modals
    - _Requirements: 5.6, 5.7, 5.9_

  - [x] 4.4 Wire the hook and prompt into `src/App.tsx`
    - Call `useServiceWorkerUpdate` and render `UpdatePrompt`
    - Leave `main.tsx`, `FinanceProvider` and `PersistenceNotice` unchanged
    - _Requirements: 5.6, 5.7, 5.9, 5.10, 6.1, 6.7_

- [x] 5. Vite base configuration
  - [x] 5.1 Update `vite.config.ts` and verify the build output
    - Use `defineConfig(({ command }) => ...)` with `base: command === 'build' ? toBasePath(REPO_NAME) : '/'`, plugins `react()` and `swPlugin({ repoName: REPO_NAME })`, and keep the existing `test` block
    - Run `npm run build` and inspect `dist`: it contains `manifest.webmanifest`, `sw.js` and `icons/*`; `dist/index.html` references `/Money-Manager/assets/...`, the manifest and the icons; `dist/sw.js` contains the precache list and version; two builds of unchanged source give the same version
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 6. Checkpoint - App code complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. GitHub Actions workflow
  - [x] 7.1 Create `.github/workflows/deploy.yml`
    - Triggers: `push` to `main` and `workflow_dispatch`
    - Permissions `contents: read`, `pages: write`, `id-token: write`; concurrency group `pages` with `cancel-in-progress: false`
    - `build` job: `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, npm cache), `npm ci`, `npm run test`, `npm run build`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` with `path: dist`
    - `deploy` job: `needs: build`, `github-pages` environment, `actions/deploy-pages@v4`
    - Use only `actions/*` actions; confirm current major versions when writing the file
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 8. Documentation
  - [x] 8.1 Create `docs/DEPLOYMENT.md`
    - Repository `PanzerArea51/Money-Manager`, pushing to `main`, Settings > Pages > Source "GitHub Actions", checking the Actions tab, URL `https://panzerarea51.github.io/Money-Manager/`
    - Private repository plan note, the site holds no user data, `REPO_NAME` in `src/pwa/repoName.ts` is the only value to change on rename
    - "Your data" section (per-device and per-browser, no sync or backup, clearing site data or uninstalling can delete data, JSON export/import planned later)
    - Manual verification checklist from the design
    - _Requirements: 3.7, 6.2, 6.3, 6.4, 6.5, 6.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 8.2 Create `docs/INSTALL-ON-PHONE.md`
    - Android Chrome install, iPhone Safari Share > Add to Home Screen
    - First visit must be online, iPhone must open from the home screen icon, tab and home screen app data can be separate
    - How to apply an update with the Update_Prompt, plus the same "Your data" section
    - _Requirements: 6.4, 6.5, 6.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 9. Tests
  - [x] 9.1 Write unit tests for the pure helpers
    - `basePath.test.ts`: `Money-Manager`, `/Money-Manager/`, `Money-Manager/` all give `/Money-Manager/`
    - `cacheNames.test.ts`: empty list, only the current cache, caches with another project's prefix are kept
    - `buildVersion.test.ts`: equal inputs give equal versions, one changed byte gives a different version
    - `requestRouting.test.ts`: GET navigation in scope, asset in scope, cross-origin, outside scope, POST
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 9.2 Write property test for base path normalization
    - **Property 1: Base path normalization**
    - File `src/pwa/basePath.property.test.ts`
    - **Validates: Requirements 3.2, 11.3**

  - [x] 9.3 Write property test for build version
    - **Property 2: Build version tracks content**
    - File `src/pwa/buildVersion.property.test.ts`
    - **Validates: Requirements 5.1, 11.1**

  - [x] 9.4 Write property test for stale cache selection
    - **Property 3: Stale cache selection**
    - File `src/pwa/cacheNames.property.test.ts`
    - **Validates: Requirements 5.2, 11.2**

  - [x] 9.5 Write property test for request routing
    - **Property 4: Request routing**
    - File `src/pwa/requestRouting.property.test.ts`
    - **Validates: Requirements 4.3, 4.4, 4.5, 5.4, 5.5**

  - [x] 9.6 Write unit tests for registration
    - `register.test.ts`: `shouldPromptForUpdate` cases (`installed` with and without controller, other states)
    - Resolves without throwing when `serviceWorker` is absent from `navigator`; logs and does not throw when `register` rejects
    - _Requirements: 4.7, 4.8, 5.6_

  - [x] 9.7 Write the manifest and `index.html` test
    - `src/pwa/manifest.test.ts` reads files with `node:fs`
    - Check manifest fields from Requirement 1, `short_name` of 12 characters or fewer, six-digit hex colors, three PNG icon entries, `theme-color` equals `theme_color`, `index.html` links the manifest and apple touch icon, each icon file exists with a PNG signature and the declared dimensions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 11.4_

  - [x] 9.8 Write a minimal `UpdatePrompt` render test
    - Use `react-dom/server` `renderToString` (no new dependency): buttons present when `visible`, empty output when not
    - _Requirements: 5.6, 5.9_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Unit tests and property tests for pure helpers are required by Requirement 11 and are not marked optional.
- Each task references specific requirements for traceability.
- Requirement 11.5: add no test for helpers that do not exist. The service worker runtime, workflow and documentation are verified by build inspection and the manual checklist, not by automated tests.
- Property tests validate universal correctness properties. Unit tests validate specific examples and edge cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "5.1"] },
    { "id": 4, "tasks": ["7.1", "8.1", "8.2", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8"] }
  ]
}
```
