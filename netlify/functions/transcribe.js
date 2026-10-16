// Speech-to-text for Parler: receives one short audio chunk (base64) and
// returns OpenAI's transcription. The browser splits long recordings into
// ~1-minute pieces so each request stays well under Netlify's payload limit.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(500, { error: { message: 'OPENAI_API_KEY environment variable not set in Netlify.' } });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: { message: 'Bad JSON body.' } }); }

  const { audio, mime, prompt, language } = payload;
  if (!audio) return json(400, { error: { message: 'No audio supplied.' } });

  try {
    const buf = Buffer.from(audio, 'base64');
    const type = mime || 'audio/wav';
    const ext = type.includes('wav') ? 'wav' : type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';

    const form = new FormData();
    form.append('file', new Blob([buf], { type }), 'chunk.' + ext);
    // whisper-1 transcribes what was said (errors included) rather than
    // polishing it, which is what we want for feedback on a learner's French.
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (prompt) form.append('prompt', String(prompt).slice(0, 800));
    if (language) form.append('language', language);

    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey },
      body: form,
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.log('OpenAI status:', upstream.status, data?.error?.message);
      return json(upstream.status, { error: { message: data?.error?.message || 'Transcription failed (' + upstream.status + ')' } });
    }
    return json(200, { text: data.text || '' });
  } catch (err) {
    console.log('Transcribe error:', err.message);
    return json(502, { error: { message: err.message } });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
