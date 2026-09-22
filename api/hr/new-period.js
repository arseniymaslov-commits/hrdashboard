const { neon } = require('@neondatabase/serverless');

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function nextPeriodKey(periodKey) {
  var parts = periodKey.split('-');
  var y = Number(parts[0]), m = Number(parts[1]);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return y + '-' + String(m).padStart(2, '0');
}
function labelForKey(periodKey) {
  var parts = periodKey.split('-');
  var y = Number(parts[0]), m = Number(parts[1]);
  return RU_MONTHS[m - 1] + ' ' + y;
}

// POST /api/hr/new-period — clones every block from the current (latest)
// period into a brand-new next-month period, which then becomes the new
// latest/editable period (the old one freezes automatically — "latest" is
// just MAX(period)). Idempotent: if that next period already exists, it is
// reported back as-is and never overwritten, so a double-click or an
// already-started month never loses in-progress edits.
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
  try {
    const sql = neon(process.env.DATABASE_URL);
    const latestRow = await sql`SELECT max(period) AS p FROM hr_data`;
    const latest = latestRow[0] && latestRow[0].p;
    if (!latest) return res.status(400).json({ ok: false, error: 'no_current_period' });

    const nextPeriod = nextPeriodKey(latest);

    const existing = await sql`SELECT 1 FROM hr_data WHERE period = ${nextPeriod} LIMIT 1`;
    if (existing.length) {
      const metaRow = await sql`SELECT data FROM hr_data WHERE key = 'meta' AND period = ${nextPeriod}`;
      const label = (metaRow[0] && metaRow[0].data && metaRow[0].data.period) || labelForKey(nextPeriod);
      return res.status(200).json({ ok: true, period: nextPeriod, label, alreadyExisted: true });
    }

    const rows = await sql`SELECT key, data FROM hr_data WHERE period = ${latest}`;
    if (!rows.length) return res.status(400).json({ ok: false, error: 'current_period_empty' });

    const nextLabel = labelForKey(nextPeriod);
    const prevLabel = labelForKey(latest);

    for (const r of rows) {
      const data = r.key === 'meta' ? Object.assign({}, r.data, { period: nextLabel, prevPeriod: prevLabel }) : r.data;
      await sql`
        INSERT INTO hr_data (key, period, data, updated_at)
        VALUES (${r.key}, ${nextPeriod}, ${JSON.stringify(data)}::jsonb, now())
        ON CONFLICT (key, period) DO NOTHING
      `;
    }

    return res.status(200).json({ ok: true, period: nextPeriod, label: nextLabel, alreadyExisted: false, clonedFrom: latest });
  } catch (err) {
    console.error('POST /api/hr/new-period failed:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
