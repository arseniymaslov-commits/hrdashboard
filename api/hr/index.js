const { neon } = require('@neondatabase/serverless');

// GET /api/hr[?period=YYYY-MM] — returns every stored block for one period:
// { ok:true, period:'2026-09', data: { meta:{...}, composition:{...}, ... } }
// Omitting ?period returns the latest (current) period.
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    let period = req.query && req.query.period;
    if (!period) {
      const latest = await sql`SELECT max(period) AS p FROM hr_data`;
      period = latest[0] && latest[0].p;
    }
    if (!period) {
      return res.status(200).json({ ok: true, period: null, data: {} });
    }
    const rows = await sql`SELECT key, data FROM hr_data WHERE period = ${period}`;
    const data = {};
    for (const row of rows) data[row.key] = row.data;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, period, data });
  } catch (err) {
    console.error('GET /api/hr failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
