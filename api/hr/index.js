const { neon } = require('@neondatabase/serverless');

// GET /api/hr — returns every stored block in one round trip:
// { ok:true, data: { meta:{...}, recruitment:{...}, admin:{...}, ... } }
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
    const rows = await sql`SELECT key, data FROM hr_data`;
    const data = {};
    for (const row of rows) data[row.key] = row.data;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('GET /api/hr failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
