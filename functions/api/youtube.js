// Cloudflare Pages Function: /api/youtube?videoId=XXXXXXXXXXX
// Looks up a YouTube video's actual live-broadcast start time so the app can
// auto-sync a VOD without every viewer needing their own API key.
// Requires one environment variable in the Cloudflare Pages dashboard:
//   YOUTUBE_API_KEY
// Get a free one at console.cloud.google.com (enable "YouTube Data API v3").
// In Google Cloud, restrict this key to the YouTube Data API v3 only — it's
// fine for it to be used server-side like this even though the underlying
// key itself isn't secret-sensitive in the way an OAuth secret is.

export async function onRequestGet({ request, env }) {
  try {
    const videoId = new URL(request.url).searchParams.get('videoId');
    if (!videoId) return json({ error: 'Missing videoId.' }, 400);
    if (!env.YOUTUBE_API_KEY) {
      return json({ error: 'Server is missing the YOUTUBE_API_KEY environment variable. See README.md. (Auto-sync is optional — manual calibration still works without it.)' }, 500);
    }
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) return json({ error: data.error.message || 'YouTube API error.' }, res.status || 500);
    const item = data.items && data.items[0];
    if (!item) return json({ error: 'Video not found — check the URL/ID.' }, 404);
    const details = item.liveStreamingDetails || {};
    return json({ actualStartTime: details.actualStartTime || null });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
