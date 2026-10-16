// Streaming proxy to the Anthropic API. Streaming functions on Netlify may run
// for up to 60 s (regular ones time out much sooner), which long answers such
// as speaking corrections need. The browser reads the server-sent events.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return errorResponse(500, 'ANTHROPIC_API_KEY environment variable not set.');

  let body;
  try { body = JSON.parse(await req.text()); }
  catch { return errorResponse(400, 'Bad JSON body.'); }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    let msg = 'Anthropic error ' + upstream.status;
    try { msg = JSON.parse(text)?.error?.message || msg; } catch {}
    return errorResponse(upstream.status || 502, msg);
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
};

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
