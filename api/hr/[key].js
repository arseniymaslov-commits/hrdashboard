const { neon } = require('@neondatabase/serverless');

// One row per report block, matching BLOCKS in index.html plus 'meta'.
const ALLOWED_KEYS = new Set([
  'meta', 'recruitment', 'admin', 'assessment', 'discipline', 'analytics',
  'departments', 'budget', 'plan', 'hrEfficiency', 'proposals',
]);

const MAX_BODY_CHARS = 2_000_000; // 2MB of JSON is more than enough for one block

module.exports = async (req, res) => {
  const key = req.query && req.query.key;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(404).json({ ok: false, error: 'unknown_key' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT data, updated_at FROM hr_data WHERE key = ${key}`;
      if (!rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, data: rows[0].data, updated_at: rows[0].updated_at });
    } catch (err) {
      console.error('GET /api/hr/[key] failed:', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  }

  if (req.method === 'PUT') {
    if (!process.env.EDIT_TOKEN || req.headers['x-edit-token'] !== process.env.EDIT_TOKEN) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ ok: false, error: 'invalid_body' });
    }
    const json = JSON.stringify(body);
    if (json.length > MAX_BODY_CHARS) {
      return res.status(413).json({ ok: false, error: 'too_large' });
    }
    try {
      const rows = await sql`
        INSERT INTO hr_data (key, data, updated_at)
        VALUES (${key}, ${json}::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
        RETURNING updated_at
      `;
      return res.status(200).json({ ok: true, updated_at: rows[0].updated_at });
    } catch (err) {
      console.error('PUT /api/hr/[key] failed:', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
};
