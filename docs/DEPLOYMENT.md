# Deployment

The app is published as static files to GitHub Pages by GitHub Actions.

- Repository: `PanzerArea51/Money-Manager`
- Site URL: `https://panzerarea51.github.io/Money-Manager/`
- URL format: `https://<user>.github.io/<repo-name>/`

## One-time setup

1. Create the repository `PanzerArea51/Money-Manager` on GitHub.
2. Check that `REPO_NAME` in `src/pwa/repoName.ts` is `Money-Manager`.
3. Push the code to the `main` branch:
   ```
   git remote add origin https://github.com/PanzerArea51/Money-Manager.git
   git push -u origin main
   ```
4. In the repository, open **Settings > Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Open the **Actions** tab. The "Deploy to GitHub Pages" run starts on each push to `main`. You can also start it with **Run workflow**.
6. Wait for both jobs (`build` and `deploy`) to show a green check. If a job fails, open the run and read the log. A failed test or build stops the run before anything is published.
7. Open `https://panzerarea51.github.io/Money-Manager/`.

## Private repository

GitHub Pages for a private repository needs a GitHub plan that supports it. The published site can still be reached by anyone who has the URL, even when the repository is private.

The site contains only the app's static files. It holds no user data, because data stays on each device (see "Your data").

## Renaming the repository

`REPO_NAME` in `src/pwa/repoName.ts` is the only value to change. It sets the base path, the service worker scope, and the cache name prefix. After renaming, update `REPO_NAME`, push to `main`, and use the new URL. A wrong value gives a blank page.

## Your data

- Data is per-device and per-browser. It lives in IndexedDB.
- The installed app, the same site in a browser tab, and other browsers or devices do not share data.
- There is no sync and no backup in this release.
- Clearing site data or uninstalling the installed app can delete your data.
- JSON export/import backup is planned for later.

## Manual verification checklist

1. Open the site. In devtools, check **Application > Manifest** and **Service Workers**. There should be no installability warnings.
2. Go offline and reload. Accounts and transactions still appear.
3. Deploy a second build and reload. The update prompt appears. Accept it and confirm the page reloads once and your data is unchanged.
4. Dismiss the prompt on another build and confirm the old version keeps running.
5. Install on Android Chrome and iPhone Safari, following `docs/INSTALL-ON-PHONE.md`.
