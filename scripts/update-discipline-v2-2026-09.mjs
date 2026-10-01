import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='discipline' AND period=${PERIOD}`;
if (!rows.length) { console.error('no discipline row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Adds real company-wide lateness/absence data on top of the СЭТС fines
// already entered. Sources:
// - "Ежедневный учёт опозданий сотрудников" (СКУД-based daily log,
//   104633-row sheet, real events only where Тип события is filled):
//   September 2026 (date range in file runs through 24.09) — 593
//   "Опоздание" events (176 unique people) + 164 "Отсутствие" events
//   (absence type not broken out for September in this sheet).
// - "Заявление на отпуск без сохранения заработной платы" — real
//   September tab: 53 БС requests, 0 flagged "Превышение лимита" — not
//   counted as a violation (мостly authorised family-reasons leave + a
//   21-person УНБХ "Оздоровительный отдых" group booking), just reported
//   in the conclusion as attendance context.
// This changes the whole picture: lateness (593) dwarfs the earlier
// СЭТС-only count (21) — kept honest rather than cherry-picked, since
// this company's own УЧР KPI framework treats "опоздания" as THE core
// "дисциплина" metric (see "Эффективность профилактики" criterion).
const byType = [
  { type: 'Опоздания', count: 593 },
  { type: 'Отсутствие', count: 164 },
  { type: 'Превышение скоростного режима', count: 9 },
  { type: 'Телефон за рулём', count: 5 },
  { type: 'Нарушение техники безопасности (ОТ/ТБ)', count: 4 },
  { type: 'Прочее', count: 3 },
];
const byDept = [
  { dept: 'Руководители и зам. рук.', count: 175 },
  { dept: 'САУП', count: 120 },
  { dept: 'ДИТ', count: 50 },
  { dept: 'ПЭО', count: 47 },
  { dept: 'ОКП', count: 45 },
  { dept: 'СЭТС', count: 21 },
];
const totalCurrent = byType.reduce((a, t) => a + t.count, 0); // 778

const recent = [
  { date: 'сен.', dept: 'Администрация', type: 'Систематические опоздания', status: '14 раз за месяц', employee: 'А. Темиржанова', severity: 'serious' },
  { date: '07.09', dept: 'Руководители и зам. рук.', type: 'Опоздание', status: '155 минут', employee: 'У. Акушев', severity: 'critical' },
  { date: '22.09', dept: 'СЭТС', type: 'Телефон за рулём', status: 'Штраф 5000 с', employee: 'Р. Хуснулин', severity: 'serious' },
  { date: '18.09', dept: 'СЭТС', type: 'Допуск посторонних в кабину', status: 'Штраф 5000 с', employee: 'Б. Арапбаев', severity: 'warning' },
  { date: '14.09', dept: 'СЭТС', type: 'Превышение скоростного режима', status: 'Штраф 9000 с', employee: 'А. Сыдыков', severity: 'critical' },
];

const updated = {
  ...current,
  totalViolations: { ...current.totalViolations, current: totalCurrent },
  byType,
  byDept,
  recent,
  history: current.history.map((h, i, arr) =>
    i === arr.length - 1 ? { ...h, count: totalCurrent } : h
  ),
  conclusion: `За сентябрь — 593 опоздания (176 человек, больше всего в руководстве и САУП) и 164 отсутствия, плюс 21 взыскание по СЭТС (скорость/телефон/ОТ-ТБ). Справочно: 53 заявления на отпуск без содержания, превышений лимита нет.`,
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='discipline' AND period=${PERIOD}
`;
console.log('discipline updated (v2, +lateness/absence) for', PERIOD, '- total:', totalCurrent);
