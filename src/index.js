// Single Worker entry point (the current Cloudflare model: a Worker with a
// "static assets" binding, not the older separate "Pages Functions" files).
// Static files are served from ./public automatically via env.ASSETS.
// Two API routes are handled here in code instead: /api/fflogs and
// /api/youtube. Both keep credentials server-side; the browser never sees
// them. See README.md for the environment variables this needs.

const FFLOGS_TOKEN_URL = 'https://www.fflogs.com/oauth/token';
const FFLOGS_API_URL = 'https://www.fflogs.com/api/v2/client';

// Cached for the lifetime of this Worker instance; cold starts refetch it.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getFFLogsToken(env) {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60000) return cachedToken;
  if (!env.FFLOGS_CLIENT_ID || !env.FFLOGS_CLIENT_SECRET) {
    throw new Error('Server is missing FFLOGS_CLIENT_ID / FFLOGS_CLIENT_SECRET. Add them under Settings -> Variables and secrets, then redeploy.');
  }
  const basic = btoa(`${env.FFLOGS_CLIENT_ID}:${env.FFLOGS_CLIENT_SECRET}`);
  const res = await fetch(FFLOGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`FFLogs token request failed (${res.status}). Check your Client ID/Secret.`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return cachedToken;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleFflogs(request, env) {
  if (request.method !== 'POST') return json({ error: 'POST only.' }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body.' }, 400); }
  if (!body || typeof body.query !== 'string') return json({ error: 'Missing GraphQL query.' }, 400);
  try {
    const token = await getFFLogsToken(env);
    const res = await fetch(FFLOGS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query: body.query, variables: body.variables || {} })
    });
    const data = await res.json();
    return json(data, res.status);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

async function handleYoutube(request, env) {
  const videoId = new URL(request.url).searchParams.get('videoId');
  if (!videoId) return json({ error: 'Missing videoId.' }, 400);
  if (!env.YOUTUBE_API_KEY) {
    return json({ error: 'Server is missing the YOUTUBE_API_KEY variable. Auto-sync is optional — manual calibration still works without it.' }, 500);
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return json({ error: data.error.message || 'YouTube API error.' }, res.status || 500);
    const item = data.items && data.items[0];
    if (!item) return json({ error: 'Video not found — check the URL/ID.' }, 404);
    return json({ actualStartTime: (item.liveStreamingDetails || {}).actualStartTime || null });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

// Live "shared setup" storage. Backed by a KV namespace (env.VOD_CONFIG) so
// anyone using the site can save their setup and everyone else gets it on
// next load — no manual git push needed. Falls back to the static
// vod-review-config.json bundled in the repo when KV has nothing saved yet
// (or isn't configured), so the site keeps working either way.
const CONFIG_KV_KEY = 'shared-config';
const MAX_CONFIG_BYTES = 5 * 1024 * 1024;

async function handleConfig(request, env) {
  if (request.method === 'GET') {
    if (env.VOD_CONFIG) {
      const stored = await env.VOD_CONFIG.get(CONFIG_KV_KEY, 'json');
      if (stored) {
        const etag = stored.updatedAt ? `"${stored.updatedAt}"` : '';
        if (etag && request.headers.get('If-None-Match') === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-store' } });
        }
        const response = json(stored);
        if (etag) response.headers.set('ETag', etag);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
    }
    return env.ASSETS.fetch(new Request(new URL('/vod-review-config.json', request.url), request));
  }
  if (request.method === 'POST') {
    if (!env.VOD_CONFIG) {
      return json({ error: 'Server is missing the VOD_CONFIG KV binding. See README.md for one-time setup.' }, 500);
    }
    // Optional shared password gate: set CONFIG_SAVE_PASSWORD to require it.
    if (env.CONFIG_SAVE_PASSWORD) {
      const provided = request.headers.get('X-Save-Password') || '';
      if (provided !== env.CONFIG_SAVE_PASSWORD) return json({ error: 'Incorrect password.' }, 401);
    }
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'Invalid JSON body.' }, 400); }
    if (!body || typeof body !== 'object' || !body.storage || typeof body.storage !== 'object') {
      return json({ error: 'Missing storage object.' }, 400);
    }
    const payload = { version: 1, updatedAt: new Date().toISOString(), storage: body.storage };
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_CONFIG_BYTES) return json({ error: 'Config is too large to save.' }, 413);
    await env.VOD_CONFIG.put(CONFIG_KV_KEY, serialized);
    return json({ ok: true, updatedAt: payload.updatedAt });
  }
  return json({ error: 'GET or POST only.' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/fflogs') return handleFflogs(request, env);
    if (url.pathname === '/api/youtube') return handleYoutube(request, env);
    if (url.pathname === '/api/config') return handleConfig(request, env);
    // Anything else: serve the static site from ./public
    return env.ASSETS.fetch(request);
  }
};
