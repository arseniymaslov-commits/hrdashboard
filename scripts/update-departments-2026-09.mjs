import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='departments' AND period=${PERIOD}`;
if (!rows.length) { console.error('no departments row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Source: "Оценка персонала" sheet, "Сводная_Отчет 360" tab — real
// 1-5 department-average 360 scores across 30 real СП. Picked top 3 +
// bottom 3, deliberately skipping depts the sheet itself flags "Малая
// группа; осторожно с выводами" (n=1-2 respondents, e.g. Бухгалтерия,
// Ред Маркет, Энергия будущего) in favour of a slightly bigger, still-low
// bottom group (n=3-6).
// Caveat (documented, not hidden): this app's departments card expects 4
// sub-scores (interaction/execution/hrWork) plus a separate 0-100 kpi — a
// different methodology than this real 360 data provides (one blended
// 1-5 score only). Rather than invent a fake breakdown, every sub-field
// reuses the same real score, rescaled x2 to roughly the old 0-10 range,
// so nothing shown is fabricated — just not decomposed.
const real = [
  { dept: 'ОКС', score: 4.97 },
  { dept: 'ПЭО', score: 4.92 },
  { dept: 'ОРС', score: 4.91 },
  { dept: 'ОРН', score: 4.19 },
  { dept: 'УНБХ', score: 4.17 },
  { dept: 'ОПЗИ', score: 4.11 },
];
const rowsOut = real.map((r) => {
  const v = Math.round(r.score * 2 * 10) / 10;
  return { dept: r.dept, interaction: v, execution: v, hrWork: v, kpi: v, total: v };
});

const updated = {
  ...current,
  rows: rowsOut,
  conclusion: 'Рейтинг построен по реальной оценке 360° (а не по прежней композитной формуле): лидер — ОКС (4,97 из 5); в нижней части — ОПЗИ, УНБХ, ОРН (4,1–4,2).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='departments' AND period=${PERIOD}
`;
console.log('departments updated for', PERIOD);
