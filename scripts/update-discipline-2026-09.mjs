import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='discipline' AND period=${PERIOD}`;
if (!rows.length) { console.error('no discipline row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real September 2026 disciplinary actions found in the Google Drive HR
// records (СЭТС "ЛС" order log — the only subdivision whose personnel-order
// log actually contains "О дисциплинарном взыскании" entries; office and
// АЗС personnel-order logs for this period contain no violations).
const byType = [
  { type: 'Превышение скоростного режима', count: 9 },
  { type: 'Использование телефона за рулём', count: 5 },
  { type: 'Нарушение техники безопасности (ОТ/ТБ)', count: 4 },
  { type: 'Прочее', count: 3 },
];
const byDept = [{ dept: 'СЭТС', count: 21 }];

const recent = [
  { date: '22.09', dept: 'СЭТС', type: 'Телефон за рулём', status: 'Штраф 5000 с', employee: 'Р. Хуснулин', severity: 'serious' },
  { date: '18.09', dept: 'СЭТС', type: 'Допуск посторонних в кабину', status: 'Штраф 5000 с', employee: 'Б. Арапбаев', severity: 'warning' },
  { date: '14.09', dept: 'СЭТС', type: 'Превышение скоростного режима', status: 'Штраф 9000 с', employee: 'А. Сыдыков', severity: 'critical' },
  { date: '09.09', dept: 'СЭТС', type: 'Нарушение ОТ/ТБ (без заземления)', status: 'Штраф 5000 с', employee: 'Э. Мааткеримов', severity: 'serious' },
  { date: '08.09', dept: 'СЭТС', type: 'Телефон за рулём', status: 'Штраф 5000 с', employee: 'К. Айдаров', severity: 'serious' },
];

const totalCurrent = 21;
const updated = {
  ...current,
  totalViolations: { ...current.totalViolations, current: totalCurrent },
  byType,
  byDept,
  recent,
  history: current.history.map((h, i, arr) =>
    i === arr.length - 1 ? { ...h, count: totalCurrent } : h
  ),
  conclusion: 'За сентябрь зафиксировано 21 дисциплинарное взыскание, все — по водительскому составу СЭТС: 9 случаев превышения скоростного режима, 5 — использование телефона за рулём, 4 — нарушения техники безопасности при сливе топлива, остальные — разовые случаи (неявка, допуск посторонних в кабину).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='discipline' AND period=${PERIOD}
`;
console.log('discipline updated for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
