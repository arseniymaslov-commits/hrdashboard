const { neon } = require('@neondatabase/serverless');
const { validateSnapshot } = require('../../lib/hr-validate');
const { fetchSnapshotFromSheet } = require('../../lib/hr-sheets');
const { writeSnapshot } = require('../../lib/hr-write');

// POST /api/hr/sync[?dryRun=1]
// Читает отчёт из Google-таблицы (SHEET_ID), проверяет и записывает в текущий период.
// Заголовок X-Edit-Token обязателен. Архивный период не трогается.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!process.env.DATABASE_URL || !process.env.SHEET_ID) {
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }
  if (!process.env.EDIT_TOKEN || req.headers['x-edit-token'] !== process.env.EDIT_TOKEN) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const dryRun = !!(req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true'));

  let snapshot;
  try {
    snapshot = await fetchSnapshotFromSheet(process.env.SHEET_ID);
  } catch (err) {
    if (err.code && String(err.code).startsWith('input_')) {
      // ошибка в таблице ввода: показываем адрес ячейки, запись не делаем
      return res.status(422).json({ ok: false, error: 'validation_failed', errors: [err.message] });
    }
    console.error('sync: read sheet failed:', err);
    return res.status(502).json({ ok: false, error: 'sheet_read_failed', detail: err.code === 'tabs_missing' ? err.message : String(err.message || err) });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    const latestRow = await sql`SELECT max(period) AS p FROM hr_data`;
    const period = latestRow[0] && latestRow[0].p;
    if (!period) return res.status(400).json({ ok: false, error: 'no_current_period' });

    const { errors, warnings } = validateSnapshot(snapshot, period);
    if (errors.length) {
      return res.status(422).json({ ok: false, error: 'validation_failed', period, errors, warnings });
    }
    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, period, blocks: Object.keys(snapshot), warnings });
    }
    const written = await writeSnapshot(sql, period, snapshot);
    return res.status(200).json({ ok: true, period, written, warnings });
  } catch (err) {
    console.error('POST /api/hr/sync failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
