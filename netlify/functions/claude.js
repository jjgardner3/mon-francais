exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY environment variable not set.' } }),
    };
  }

  try {
    console.log('Calling Anthropic, key prefix:', apiKey.slice(0, 16) + '...');
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: event.body,
    });

    const data = await upstream.json();
    console.log('Anthropic status:', upstream.status, data?.error?.message || 'ok');
    return {
      statusCode: upstream.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.log('Fetch error:', err.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
