const { neon } = require('@neondatabase/serverless');
const { validateSnapshot, BLOCK_KEYS, PERIOD_RE } = require('../../lib/hr-validate');

// POST /api/hr/import?period=YYYY-MM[&dryRun=1]
// Body: снимок отчёта { meta:{...}, composition:{...}, ... } (та же форма, что DEMO).
// Заголовок X-Edit-Token обязателен.
//
// 1. Проверяет снимок (lib/hr-validate.js). Ошибки → 422, запись не делается.
// 2. dryRun=1 — только проверка, без записи.
// 3. Пишет все блоки одной транзакцией. Только последний (текущий) период,
//    как и PUT /api/hr/:key. Архивный период вернёт 403.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }
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

  const period = req.query && req.query.period;
  if (!period || !PERIOD_RE.test(period)) {
    return res.status(400).json({ ok: false, error: 'period_required_YYYY-MM' });
  }
  const dryRun = !!(req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true'));

  const { errors, warnings } = validateSnapshot(body, period);
  if (errors.length) {
    return res.status(422).json({ ok: false, error: 'validation_failed', period, errors, warnings });
  }
  if (dryRun) {
    return res.status(200).json({ ok: true, dryRun: true, period, blocks: Object.keys(body), warnings });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const latestRow = await sql`SELECT max(period) AS p FROM hr_data`;
    const latest = latestRow[0] && latestRow[0].p;
    if (latest && period !== latest) {
      return res.status(403).json({ ok: false, error: 'period_not_editable', latest });
    }

    const keys = Object.keys(body).filter((k) => BLOCK_KEYS.includes(k));
    const queries = keys.map((k) => {
      const json = JSON.stringify(body[k]);
      return sql`
        INSERT INTO hr_data (key, period, data, updated_at)
        VALUES (${k}, ${period}, ${json}::jsonb, now())
        ON CONFLICT (key, period) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `;
    });
    await sql.transaction(queries);

    return res.status(200).json({ ok: true, period, written: keys, warnings });
  } catch (err) {
    console.error('POST /api/hr/import failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
