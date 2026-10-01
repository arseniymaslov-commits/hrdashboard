import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='departments' AND period=${PERIOD}`;
if (!rows.length) { console.error('no departments row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// User-clarified org mapping (2026-10-01): in "RP_итоговый_рейтинг_задачи_
// КПЭ_взаимодействие.xlsx", the "Итоговый рейтинг" summary tab's lone "ДИТ"
// row only covered the ДИТ-proper sub-team — it silently excluded ОЦП/ОКИ/
// ОИБ, which the full workbook's "Результативность задач" (per-dept raw
// counts) and "Рейтинг" tabs DO list as their own separate rows. Per the
// user, ДИТ/ОЦП/ОКИ/ОИБ should be shown as ONE combined dept, and "ССБН" is
// the old code for what's now called "АХО" (straight rename, same numbers).
//
// Recombined from the raw per-dept rows (not from the summary row, so the
// task-completion % is a real weighted average rather than ДИТ-alone's):
//   Поручений: ДИТ 27 + ОЦП 1 + ОКИ 2 + ОИБ 3 = 33; Выполнено: 3+0+0+0 = 3
//   -> Задачи % = 3/33 = 9.09% (was 11.11% for ДИТ alone)
//   Взаимодействие %: ДИТ has none ("нет оценки взаимодействия"); ОЦП 98.6,
//   ОКИ 100, ОИБ 99.6 -> average of the 3 available = 99.4%
//   Средний балл = average of the 2 available criteria (Задачи%, Взаимод.%),
//   same "exclude bogus КПЭ% for everyone but УЧР" rule as the original
//   script -> (9.09+99.4)/2 = 54.25
const ditCombined = {
  dept: 'ДИТ (ОЦП+ОКИ+ОИБ)',
  execution: 0.9,   // 9.09% / 10
  interaction: 9.9, // 99.4% / 10
  hrWork: 5.4,      // avg(execution, interaction), same stand-in as before
  kpi: 54,          // rounded Средний балл (0-100)
  total: 5.4,       // Средний балл / 10
};

const updatedRows = current.rows.map((r) => {
  if (r.dept === 'ДИТ') return ditCombined;
  if (r.dept === 'ССБН') return { ...r, dept: 'АХО' };
  return r;
});

const updated = {
  ...current,
  rows: updatedRows,
  conclusion: 'Рейтинг — по реальному выполнению протокольных поручений и взаимодействию (файл "Итоговый рейтинг"): лидер — УЧР (100% поручений в срок), затем ОК и ОДТ. "ДИТ" пересчитан как сумма ДИТ+ОЦП+ОКИ+ОИБ (33 поручения, 9% выполнено в срок, но взаимодействие высокое — 99,4%) — в нижней части рейтинга теперь ТД и АХО (бывш. ССБН, 0% выполненных поручений из найденных).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='departments' AND period=${PERIOD}
`;
console.log('departments regrouped (ДИТ combined, ССБН->АХО) for', PERIOD);
console.log(JSON.stringify(updatedRows, null, 2));
