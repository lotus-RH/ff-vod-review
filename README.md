# VOD Review — no-login setup (Cloudflare Workers)

Cloudflare's dashboard now deploys sites as a **Worker with a static assets
folder**, rather than the older separate "Pages Functions" file layout. This
package matches that current model:

```
public/
  index.html       <- the app itself
src/
  index.js         <- one small Worker script: handles /api/fflogs and
                       /api/youtube, and serves everything else from public/
wrangler.jsonc      <- tells Cloudflare how to build/deploy this
package.json
```

## One-time setup (only you do this, not your teammates)

1. Push all of these files to your GitHub repo, **keeping this exact folder
   structure** (`public/`, `src/`, `wrangler.jsonc`, `package.json` all at
   the repo root — not nested inside another folder).

2. In the Cloudflare dashboard: **Workers & Pages** → **Create** →
   **Workers** → **Import a repository** → connect GitHub → pick this repo.

3. Build settings Cloudflare should detect automatically from
   `wrangler.jsonc`; if it asks, the deploy command is `npx wrangler deploy`
   and no separate build command is needed. Deploy.

4. You'll get a URL like `https://ff-vod-review.<your-subdomain>.workers.dev`.

5. Get an FFLogs API client at `fflogs.com/api/clients` → Create.
   **Leave "Public Client" unchecked** — this client needs a secret.
   Any value in the redirect URL field is fine; it isn't actually used.
   Copy the **Client ID** and **Client Secret**.

6. In your Worker's page in the Cloudflare dashboard, go to **Settings** →
   **Variables and secrets** (this is the "Runtime variables and secrets"
   panel, not the "Previews" one next to it) → **Add variable** for each of:
   - `FFLOGS_CLIENT_ID` (type: Secret)
   - `FFLOGS_CLIENT_SECRET` (type: Secret)
   - `YOUTUBE_API_KEY` (type: Secret) — optional, only needed for auto-sync

7. Trigger a new deployment so the variables take effect — push
   any small commit, or use the dashboard's redeploy option.

That's it — anyone opening your `.workers.dev` URL can paste an FFLogs
report link and go, no login and no keys on their end.

Each visitor's setup (tracked abilities, mechanics, categories, planned
cooldowns, POVs, Helper scenarios) is stored only in their own browser, so
nobody can overwrite anyone else's. The Setup modal has **Download backup**
and **Import backup** buttons to keep a copy or move to another browser.

### Share link (report + POVs)

Specific logs and POVs are not part of backups or the starter template. To
share a log with its videos, use a link instead:

`https://your-site/?report=REPORTCODE&Lunner+North=VIDEOID&Toby+Smallboi=VIDEOID`

Each parameter name is a player's name as it appears in the report (not case
sensitive; spaces can be `+` or `%20`), and its value is that player's video —
just the 11-character YouTube ID, or a full link. Several videos for one player
(split VODs) are separated by commas. Names that aren't in the report are ignored. Plain
`channel=YOUTUBE_URL` entries also work: the video goes to the report player
whose name is in its title or YouTube channel name, otherwise it becomes its
own POV. `pov1`, `pov2`… (players numbered by role then name) are still
accepted too. Videos are synced automatically when `YOUTUBE_API_KEY` is set and the
video was a live broadcast, and videos already added are skipped when a link is
reopened. The address bar updates itself as you add POVs, and the link button
above the pull list copies it.

### Starter template

`public/vod-review-config.json` is a read-only starter template. When someone
opens the site, anything their browser doesn't already have (abilities,
mechanics, categories) is filled in from
it; their own existing data is never overwritten and nothing is ever saved
back to the server. To update the template, set things up the way you want in
the app, click **Download backup** in Setup, put the downloaded
`vod-review-config.json` in `public/` and push. Browsers pick up the change
once, when the file's `updatedAt` changes, and only gain what they're missing.

## Checking it worked

Open the site, load a report, and open your browser's DevTools (F12) →
Network tab. Find the request to `/api/fflogs`:
- **404** → the Worker script isn't deployed/routing correctly; double-check
  the folder structure above matches exactly.
- **200 with an `errors` array mentioning FFLOGS_CLIENT_ID** → the
  environment variables aren't set yet, or a deploy hasn't happened since
  you added them.
- **200 with report data** → it's working.

## Updating the site later

Push changes to `public/index.html` in the GitHub repo as before — Cloudflare
redeploys automatically on every push.

The **Helper** page has separate **Create** and **Use** modes. Create reusable
scenarios by defining button groups and mapping state combinations to titled
reminders or callouts; in Use mode, click the buttons to show matching output.
Scenarios are saved locally in that browser and included in the Setup modal's
backup. JSON import/export is also available for individual scenario files.
Use mode can also be popped out into its own window.
