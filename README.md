# VOD Review — no-login setup

This version has no "Connect to FFLogs" button and needs no API keys typed
into the app. Instead, two tiny serverless functions (in `functions/api/`)
hold the credentials on the server and the page calls them instead of
FFLogs/YouTube directly. Nobody who opens the site ever sees or needs a key.

This only works on a host that can run serverless functions next to your
static files. GitHub Pages **cannot** do this (static files only), so this
setup moves hosting to **Cloudflare Pages**, which is free and connects
straight to your existing GitHub repo.

## One-time setup (only you do this, not your teammates)

1. Push these files to your GitHub repo, keeping the folder structure:
   ```
   index.html
   functions/
     api/
       fflogs.js
       youtube.js
   ```
   (`functions/` must sit at the repo root, next to `index.html` — not inside another folder.)

2. Go to [dash.cloudflare.com](https://dash.cloudflare.com), sign up free, and open **Workers & Pages**.

3. Click **Create** → **Pages** → **Connect to Git**, and pick this repo.
   Leave the build settings as default (no build command needed — it's a static site) and deploy.

4. You'll get a URL like `https://vod-review.pages.dev`. That's your new site.

5. Get an FFLogs API client:
   - Go to `fflogs.com/api/clients` → Create.
   - **Leave "Public Client" unchecked this time** — this client needs a secret, unlike before.
   - No redirect URL is needed since nobody logs in anymore.
   - Copy the **Client ID** and **Client Secret** it gives you.

6. In Cloudflare, open your Pages project → **Settings** → **Environment variables** → add two, both as **Secret**:
   - `FFLOGS_CLIENT_ID`
   - `FFLOGS_CLIENT_SECRET`

7. (Optional, for YouTube auto-sync) Get a free YouTube Data API key at
   `console.cloud.google.com` (enable "YouTube Data API v3" → Credentials → Create API Key),
   then add one more environment variable:
   - `YOUTUBE_API_KEY`

8. Go to **Deployments** → redeploy (or push any small commit) so the new environment variables take effect.

That's it. Anyone who opens your `.pages.dev` URL can paste an FFLogs report link and go — no login, no keys, nothing to set up on their end.

## Updating the site later

Push changes to the GitHub repo as before (edit `index.html` in the repo, commit). Cloudflare Pages redeploys automatically on every push, the same way GitHub Pages did.

## Why this is necessary

FFLogs' own API docs say the no-login ("client_credentials") flow cannot be called directly from a browser — it requires a server to hold the secret safely. A plain static HTML file has no server, which is why the previous version needed everyone to log in individually. This is the smallest possible server that fixes that.
