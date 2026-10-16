// Lifelike French read-aloud for model paragraphs and corrections.
// Prefers Google Cloud Text-to-Speech (native French Chirp 3 HD voices) when
// GOOGLE_TTS_API_KEY is set; otherwise falls back to OpenAI's speech API.
const GOOGLE_VOICE = process.env.GOOGLE_TTS_VOICE || 'fr-FR-Chirp3-HD-Leda';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let p;
  try { p = JSON.parse(event.body || '{}'); } catch { return json(400, { error: { message: 'Bad JSON body.' } }); }
  const text = String(p.text || '').slice(0, 1500);
  if (!text) return json(400, { error: { message: 'No text.' } });

  const googleKey = process.env.GOOGLE_TTS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    if (googleKey) {
      const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(googleKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'fr-FR', name: p.voice || GOOGLE_VOICE },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.92 },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.audioContent) return json(200, { audio: d.audioContent, mime: 'audio/mpeg', provider: 'google' });
      console.log('Google TTS failed:', r.status, d?.error?.message);
      if (!openaiKey) return json(r.status || 502, { error: { message: d?.error?.message || 'Google speech failed (' + r.status + ')' } });
    }

    if (!openaiKey) return json(500, { error: { message: 'No speech key set — add GOOGLE_TTS_API_KEY (or OPENAI_API_KEY) in Netlify.' } });
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'coral',
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
    return json(200, { audio: buf.toString('base64'), mime: 'audio/mpeg', provider: 'openai' });
  } catch (err) {
    return json(502, { error: { message: err.message } });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
