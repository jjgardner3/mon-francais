// Lifelike French read-aloud for model paragraphs and corrections.
// Uses OpenAI's speech API with the same OPENAI_API_KEY as transcription.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(500, { error: { message: 'OPENAI_API_KEY environment variable not set in Netlify.' } });

  let p;
  try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: { message: 'Bad JSON body.' } }); }
  const text = String(p.text || '').slice(0, 1500);
  if (!text) return json(400, { error: { message: 'No text.' } });

  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: p.voice || 'coral',
        input: text,
        instructions: 'You are a native speaker of French from Paris. Read in natural, standard metropolitan French with authentic French pronunciation, correct liaisons and natural intonation — no English or American accent. Calm, clear, at a relaxed pace suitable for a learner.',
        response_format: 'mp3',
      }),
    });
    if (!upstream.ok) {
      const d = await upstream.json().catch(() => ({}));
      return json(upstream.status, { error: { message: d?.error?.message || 'Speech failed (' + upstream.status + ')' } });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    return json(200, { audio: buf.toString('base64'), mime: 'audio/mpeg' });
  } catch (err) {
    return json(502, { error: { message: err.message } });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
