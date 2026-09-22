const { neon } = require('@neondatabase/serverless');

// GET /api/hr/periods — lists every period that has data, newest first, with
// a human label taken from that period's own 'meta' block (falls back to the
// raw YYYY-MM key if a period somehow has no meta row).
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
    const periodRows = await sql`SELECT DISTINCT period FROM hr_data ORDER BY period DESC`;
    const metaRows = await sql`SELECT period, data FROM hr_data WHERE key = 'meta'`;
    const labelByPeriod = {};
    for (const r of metaRows) labelByPeriod[r.period] = (r.data && r.data.period) || r.period;
    const periods = periodRows.map(r => ({ period: r.period, label: labelByPeriod[r.period] || r.period }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, periods, latest: periods[0] ? periods[0].period : null });
  } catch (err) {
    console.error('GET /api/hr/periods failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
