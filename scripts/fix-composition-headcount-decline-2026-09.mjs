import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='composition' AND period=${PERIOD}`;
if (!rows.length) { console.error('no composition row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// User correction (2026-10-01, direct knowledge): September's final
// headcount (2419) is correct and stays untouched — the MoM decline figure
// (shown as -26, since render_composition computes current-prev from the
// last two headcountHistory entries) undercounted real departures:
// Securi Force -10, ОКС -1 this month. User gave the corrected total
// decline directly as -36 (not re-derived here). Since Sep stays fixed,
// correcting the delta to -36 means adjusting the August comparison point
// in this trend array specifically (2445 -> 2455) — this is just
// September's own stored 6-month trend snapshot, not a rewrite of
// August's own period record.
// turnoverRate is explicitly NOT touched per the user ("в текучести не
// указывай") — these departures are not folded into the turnover %.
const DECLINE = 36;
const sepCount = current.headcountHistory[current.headcountHistory.length - 1].count; // 2419, unchanged
const headcountHistory = current.headcountHistory.map((h, i, arr) =>
  i === arr.length - 2 ? { ...h, count: sepCount + DECLINE } : h
);

const updated = {
  ...current,
  headcountHistory,
  conclusion: `Численность снизилась до ${sepCount} человек (−${DECLINE} за месяц, снимок на ~20.09: из них 10 — увольнения в Securi Force и 1 — в ОКС): принято ${current.hired}, уволено ${current.fired}; в штате 78% мужчин и 22% женщин; текучесть кадров — ${current.turnoverRate.current}% (−0,5 п.п. к прошлому месяцу), самая высокая — на ОРП и ОДТ (7,7%).`,
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='composition' AND period=${PERIOD}
`;
console.log('composition headcount decline fixed for', PERIOD);
console.log(JSON.stringify(headcountHistory, null, 2));
console.log(updated.conclusion);
