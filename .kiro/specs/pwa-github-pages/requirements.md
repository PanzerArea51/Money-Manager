# Requirements Document

## Introduction

This feature makes the existing local-first Personal Finance Tracker installable on a phone as a Progressive Web App (PWA) and hosted as static files on GitHub Pages, so the user can open and use it away from the laptop and home Wi-Fi.

The app remains local-first. GitHub Pages serves only static files (HTML, JS, CSS, icons, manifest, service worker). There is no backend, no authentication, no data sync, and no network call for user data. All data stays in IndexedDB on the device and browser where the app is used.

PWA install and offline use were listed as "planned later" in the product rules. The user has now explicitly requested them. Static hosting on GitHub Pages is read as permitted under the "no cloud infrastructure" rule, because it holds no user data and runs no server code.

### Assumptions and Open Items

- **Repository name (open)**: The GitHub repository name is not yet confirmed. Until the user confirms it, the System uses the placeholder `REPO_NAME_PLACEHOLDER`, defined in a single configuration value. Replacing that one value is the only change needed to retarget the deployment subpath.
- **Hosting type**: The site is a GitHub Pages project site served at `https://<user>.github.io/<repo-name>/`.
- **No new dependencies**: The web app manifest and service worker are hand-written. `vite-plugin-pwa` and Workbox are not used unless the user approves them.
- **Default branch**: The default branch is `main`.
- **Theme colors**: The theme color and background color are chosen during design and defined as constants that match the existing CSS variables.
- **Data scope**: Data is per-device and per-browser. Installing the PWA on a second device or in a second browser starts with empty data.

## Glossary

- **App**: The Personal Finance Tracker React + TypeScript + Vite single-page application.
- **Web_App_Manifest**: The `manifest.webmanifest` JSON file that describes the App for installation.
- **Service_Worker**: The hand-written script registered by the App that intercepts network requests and serves cached App_Shell files.
- **App_Shell**: The static files needed to start the App: `index.html`, the built JavaScript and CSS bundles, the Web_App_Manifest, and the App_Icons.
- **App_Icons**: The set of PNG icons referenced by the Web_App_Manifest, including standard icons, maskable icons, and the Apple touch icon.
- **Maskable_Icon**: An icon whose important content lies inside the safe zone (the central 80% circle) so that Android can crop it into any shape.
- **Base_Path**: The URL subpath under which the App is served, in the form `/<repo-name>/`.
- **Repo_Name_Config**: The single configuration value holding the GitHub repository name, from which the Base_Path is derived.
- **Cache_Version**: A string identifier that names one version of the Service_Worker cache and changes with each build.
- **Deploy_Workflow**: The GitHub Actions workflow that builds the App and publishes `dist` to GitHub Pages.
- **Pages_Site**: The published GitHub Pages project site that serves the built App.
- **User**: The single person who owns and uses the App on their devices.
- **Update_Prompt**: The in-app notice that tells the User a new version is ready and lets the User apply it.

## Requirements

### Requirement 1: Web App Manifest

**User Story:** As a user, I want the app to describe itself to my phone, so that I can install it with a proper name, icon and full-screen display.

#### Acceptance Criteria

1. THE Web_App_Manifest SHALL declare `name` as "Personal Finance Tracker" and `short_name` as a value of 12 characters or fewer.
2. THE Web_App_Manifest SHALL declare `display` as `standalone`.
3. THE Web_App_Manifest SHALL declare `start_url` and `scope` as relative URLs that resolve to the Base_Path when the Pages_Site is served.
4. THE Web_App_Manifest SHALL declare `theme_color` and `background_color` as six-digit hexadecimal color values.
5. THE Web_App_Manifest SHALL declare `orientation` as `portrait`.
6. THE Web_App_Manifest SHALL list a 192x192 icon, a 512x512 icon, and a 512x512 Maskable_Icon, each with its `type` set to `image/png`.
7. THE App SHALL link the Web_App_Manifest from `index.html` using a path that resolves under the Base_Path.
8. THE App SHALL declare a `theme-color` meta tag in `index.html` whose value equals the `theme_color` in the Web_App_Manifest.

### Requirement 2: App Icons

**User Story:** As a user, I want a recognizable icon on my home screen, so that I can find and launch the app quickly.

#### Acceptance Criteria

1. THE App SHALL provide App_Icons at 192x192 and 512x512 pixels in PNG format.
2. THE App SHALL provide a Maskable_Icon at 512x512 pixels in PNG format with all meaningful artwork inside the central 80% safe zone.
3. THE App SHALL provide a 180x180 PNG Apple touch icon and reference it from `index.html` with a `link rel="apple-touch-icon"` element.
4. THE App SHALL store App_Icons as static files in the `public` directory so that the build copies them to `dist` without renaming.
5. THE App SHALL reference every icon by a path relative to the Base_Path, so that icons load on the Pages_Site.

### Requirement 3: Base Path Configuration

**User Story:** As a developer, I want the subpath defined in one place, so that I can confirm or change the repository name without editing many files.

#### Acceptance Criteria

1. THE App SHALL define the repository name in a single Repo_Name_Config value, with the initial value `REPO_NAME_PLACEHOLDER`.
2. THE App SHALL derive the Vite `base` option from Repo_Name_Config as `/<repo-name>/`.
3. WHEN the App runs under the Vite development server, THE App SHALL serve from the root path `/` so that local development does not require the Base_Path.
4. WHEN the build runs, THE App SHALL emit asset URLs, the manifest link, the icon links, and the Service_Worker registration URL that all resolve under the Base_Path.
5. THE Service_Worker registration SHALL set the Service_Worker scope to the Base_Path.
6. WHEN Repo_Name_Config changes, THE App SHALL require no edit to any other source file to retarget the Base_Path.
7. THE project documentation SHALL state that the repository name is unconfirmed and that Repo_Name_Config holds a placeholder until the User confirms it.

### Requirement 4: Service Worker Offline Support

**User Story:** As a user, I want the app to open without internet, so that I can record transactions while I am out and about.

#### Acceptance Criteria

1. WHEN the App loads in a browser that supports service workers, THE App SHALL register the Service_Worker.
2. WHEN the Service_Worker installs, THE Service_Worker SHALL precache the App_Shell files under a cache named with the current Cache_Version.
3. WHILE the device has no network connection, THE Service_Worker SHALL serve navigation requests within the Base_Path from the cached `index.html`.
4. WHILE the device has no network connection, THE Service_Worker SHALL serve cached App_Shell assets for requests under the Base_Path.
5. WHEN a request targets an origin other than the Pages_Site origin, THE Service_Worker SHALL let the request pass to the network without caching it.
6. THE Service_Worker SHALL not cache or intercept IndexedDB operations or any user data.
7. IF the browser does not support service workers, THEN THE App SHALL continue to run without offline support and without displaying an error.
8. IF Service_Worker registration fails, THEN THE App SHALL log the failure to the console and continue to run.
9. WHEN the User opens the installed App with no network connection after one prior online visit, THE App SHALL display the accounts and transactions stored in IndexedDB.

### Requirement 5: Safe Update Strategy

**User Story:** As a user, I want to receive new versions of the app without being stuck on an old cached copy, so that fixes and features reach my phone reliably.

#### Acceptance Criteria

1. THE build SHALL generate a Cache_Version that differs between builds with different App_Shell contents.
2. WHEN a Service_Worker activates, THE Service_Worker SHALL delete every cache created by this App whose name differs from the current Cache_Version.
3. WHEN the App loads and the device has a network connection, THE App SHALL request the Service_Worker script from the network, bypassing the HTTP cache, to detect a new version.
4. THE Service_Worker SHALL fetch `index.html` network-first, falling back to the cached copy only when the network request fails.
5. THE Service_Worker SHALL serve content-hashed build assets cache-first.
6. WHEN a new Service_Worker finishes installing while a previous version controls the page, THE App SHALL display the Update_Prompt.
7. WHEN the User accepts the Update_Prompt, THE App SHALL activate the waiting Service_Worker and reload the page once.
8. WHILE a new Service_Worker is waiting, THE Service_Worker SHALL not take control of open pages until the User accepts the Update_Prompt.
9. WHEN the User dismisses the Update_Prompt, THE App SHALL leave the current version running and apply the update at the next full launch.
10. WHEN the Service_Worker activates after the User accepts the update, THE App SHALL retain all IndexedDB data unchanged.
11. THE Service_Worker cache naming and cache-selection helpers SHALL be pure functions with no dependency on service worker globals, so that the helpers are unit-testable.

### Requirement 6: Persistence Safety and Data Locality

**User Story:** As a user, I want my data to stay safe on my phone, so that installing the app does not put my finances at risk or send them anywhere.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL call `navigator.storage.persist()` as it does before this feature.
2. THE App SHALL send no user data over the network.
3. THE App SHALL store all accounts, transactions and receipts only in IndexedDB on the device.
4. THE project documentation SHALL state that data is per-device and per-browser, and that the installed PWA, the same site in a browser tab, and other browsers or devices do not share data.
5. THE project documentation SHALL state that the App has no sync and no backup in this release, and that clearing site data or uninstalling the PWA can delete stored data.
6. THE project documentation SHALL state that the JSON export/import backup remains a planned later feature.
7. WHERE the browser reports that `navigator.storage.persist()` was denied, THE App SHALL continue to show the existing persistence notice.

### Requirement 7: GitHub Actions Deployment

**User Story:** As a developer, I want pushes to main to publish the site automatically, so that I do not have to deploy by hand.

#### Acceptance Criteria

1. WHEN a commit is pushed to the `main` branch, THE Deploy_Workflow SHALL run.
2. WHEN the Deploy_Workflow runs, THE Deploy_Workflow SHALL install dependencies with `npm ci`, run `npm run build`, and publish the `dist` directory to the Pages_Site.
3. THE Deploy_Workflow SHALL run `npm run test` before publishing and SHALL not publish when any test fails.
4. THE Deploy_Workflow SHALL declare the minimum permissions required for Pages deployment: `contents: read`, `pages: write`, and `id-token: write`.
5. THE Deploy_Workflow SHALL use a concurrency group that prevents two deployments from running at the same time.
6. THE Deploy_Workflow SHALL support manual start through `workflow_dispatch`.
7. IF the build step fails, THEN THE Deploy_Workflow SHALL stop without publishing and SHALL report the failure in the workflow run.
8. THE Deploy_Workflow SHALL use only actions published by GitHub (`actions/*`).

### Requirement 8: One-Time GitHub Setup Guide

**User Story:** As a user who is new to GitHub Pages, I want step-by-step setup instructions, so that I can publish the app without guessing.

#### Acceptance Criteria

1. THE project documentation SHALL provide a setup guide covering: creating the GitHub repository, setting Repo_Name_Config to the confirmed repository name, pushing the code to `main`, and setting the Pages source to "GitHub Actions" in the repository settings.
2. THE setup guide SHALL state the final Pages_Site URL format `https://<user>.github.io/<repo-name>/`.
3. THE setup guide SHALL describe how to confirm that the Deploy_Workflow succeeded in the Actions tab.
4. THE setup guide SHALL state that a private repository requires a GitHub plan that supports Pages for private repositories, and that the published Pages_Site can be publicly reachable by URL.
5. THE setup guide SHALL state that the Pages_Site contains no user data, because data stays on each device.
6. THE setup guide SHALL list the repository name as an open item to confirm before the first deployment.

### Requirement 9: Phone Installation Guide

**User Story:** As a user, I want clear instructions for installing on my phone, so that the app appears on my home screen like a native app.

#### Acceptance Criteria

1. THE project documentation SHALL provide Android instructions for installing from Chrome using the install prompt or the "Install app" menu item.
2. THE project documentation SHALL provide iPhone instructions for installing from Safari using Share, then "Add to Home Screen".
3. THE project documentation SHALL state that the User must open the Pages_Site once with a network connection before offline use.
4. THE project documentation SHALL state that, on iPhone, the App must be opened from the home screen icon to run in standalone mode.
5. THE project documentation SHALL state that the data in a browser tab and the data in the installed iPhone home screen app can be separate, so the User should pick one place to enter data.
6. THE project documentation SHALL describe how the User applies an update using the Update_Prompt.

### Requirement 10: Build Output Integrity

**User Story:** As a developer, I want the production build to contain all PWA files in the right place, so that the deployed site installs and works offline.

#### Acceptance Criteria

1. WHEN `npm run build` completes, THE build SHALL output the Web_App_Manifest, the Service_Worker, and all App_Icons to `dist`.
2. WHEN `npm run build` completes, THE build SHALL write the App_Shell file list into the Service_Worker precache list.
3. THE Service_Worker file SHALL be emitted at a stable, non-hashed filename in `dist` so that the browser can detect updates to it.
4. WHEN the existing `npm run build` and `npm run test` commands run, THE project SHALL pass type-checking and all existing tests without change to their results.
5. THE project SHALL add no runtime dependency and no dev dependency beyond the approved list.
6. WHEN the Pages_Site receives a request for the Base_Path root, THE Pages_Site SHALL serve `index.html`, because the App uses state-driven navigation and defines no client-side routes.

### Requirement 11: Test Coverage for PWA Logic

**User Story:** As a developer, I want the pure PWA logic covered by tests, so that cache and path mistakes are caught before deployment.

#### Acceptance Criteria

1. THE project SHALL include unit tests for the pure cache-naming helper, covering that equal inputs give equal Cache_Version values and different inputs give different Cache_Version values.
2. THE project SHALL include unit tests for the pure helper that selects stale cache names for deletion, covering an empty list, a list with only the current cache, and a list with caches from other origins' prefixes.
3. THE project SHALL include unit tests for the Base_Path derivation from Repo_Name_Config, covering names with and without surrounding slashes.
4. THE project SHALL include a unit test that checks the Web_App_Manifest values required by Requirement 1.
5. WHERE a pure helper does not exist, THE project SHALL add no test for it.
