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

7. Create the KV namespace that stores the "shared setup" everyone saves to
   from inside the app: run `npx wrangler kv namespace create VOD_CONFIG`.
   It prints an `id` — put that in `wrangler.jsonc` under `kv_namespaces`
   (replacing `REPLACE_WITH_KV_NAMESPACE_ID`), commit, and deploy. Without
   this step the Setup modal's "Save for everyone" button won't work, but
   the site still loads the bundled `vod-review-config.json` as a starting
   point and the "Download backup" button still works.

8. Trigger a new deployment so the variables/KV binding take effect — push
   any small commit, or use the dashboard's redeploy option.

That's it — anyone opening your `.workers.dev` URL can paste an FFLogs
report link and go, no login and no keys on their end.

### Optional: require a password to save shared setup changes

By default, anyone who opens the site can click **Save for everyone** and
overwrite the shared setup. To require a password first, add one more
variable under **Settings** → **Variables and secrets**:
- `CONFIG_SAVE_PASSWORD` (type: Secret) — any value you choose

Share that password only with people you trust to edit the shared setup.
The first time someone clicks **Save for everyone** they'll be prompted for
it; their browser remembers it after that. Leaving this variable unset
keeps saving open to anyone, like it is today.

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

Shared setup (tracked abilities, mechanic categories, planned cooldowns,
POVs/notes) is different: anyone can change it from the Setup modal in the
app and click **Save for everyone** — that writes straight to the KV
namespace, live, with no git push or redeploy needed. The bundled
`public/vod-review-config.json` is just the initial/fallback copy used
before anyone has saved anything (or if the KV binding isn't set up yet).

The **Helper** page has separate **Create** and **Use** modes. Create reusable
scenarios by defining button groups and mapping state combinations to titled
reminders or callouts; in Use mode, click the buttons to show matching output.
Scenarios are saved locally in that browser and included when **Save for
everyone** is used in Setup, so other browsers receive them with the shared
setup. JSON import/export is also available for individual scenario files.
Use mode can also be popped out into its own window.
