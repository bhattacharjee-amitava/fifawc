module.exports = async (req, res) => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured on server. Add FOOTBALL_DATA_API_KEY to Vercel environment variables.' });
    return;
  }

  try {
    const upstream = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': apiKey }
    });

    if (!upstream.ok) {
      const msgs = {
        401: 'Invalid API key configured on server.',
        403: 'API key does not cover the World Cup competition.',
        429: 'Rate limit reached (10 req/min). Please wait a moment.'
      };
      res.status(upstream.status).json({ error: msgs[upstream.status] || `API error ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: `Upstream fetch failed: ${err.message}` });
  }
};
