// Cloudflare Pages Function: /api/fflogs
// Proxies FFLogs v2 GraphQL using the "client_credentials" flow, so the
// browser never sees a client secret and visitors never have to log in.
// Requires two environment variables set in the Cloudflare Pages dashboard
// (Settings -> Environment variables, added as Secrets):
//   FFLOGS_CLIENT_ID
//   FFLOGS_CLIENT_SECRET
// Get them from https://www.fflogs.com/api/clients — do NOT check the
// "Public Client" box for this one; this client needs a secret.

const TOKEN_URL = 'https://www.fflogs.com/oauth/token';
const API_URL = 'https://www.fflogs.com/api/v2/client';

// Cached in-memory for the lifetime of this Worker isolate. Cold starts get
// a fresh token; warm requests reuse it until it's about to expire.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken(env) {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60000) return cachedToken;
  if (!env.FFLOGS_CLIENT_ID || !env.FFLOGS_CLIENT_SECRET) {
    throw new Error('Server is missing FFLOGS_CLIENT_ID / FFLOGS_CLIENT_SECRET environment variables. See README.md.');
  }
  const basic = btoa(`${env.FFLOGS_CLIENT_ID}:${env.FFLOGS_CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
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

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    if (!body || typeof body.query !== 'string') {
      return json({ error: 'Missing GraphQL query.' }, 400);
    }
    const token = await getAccessToken(env);
    const res = await fetch(API_URL, {
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

export async function onRequestGet() {
  return json({ ok: true, note: 'POST { query, variables } here.' });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
