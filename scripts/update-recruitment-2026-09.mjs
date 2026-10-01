import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='recruitment' AND period=${PERIOD}`;
if (!rows.length) { console.error('no recruitment row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: Google Sheet "Конструктор (база кандидатов)", tab "вакансии
// сентябрь" (vacancy-level tracker, not a candidate funnel). Only the
// "byDept" open-position counts/avgDays and "avgTimeToHire" are replaced
// with real data below — this source has NO candidate-stage funnel data
// (Заявки/Скрининг/Собеседование/Оффер/Выход), NO talent-reserve pool
// sizing, and NO probation/adaptation pass-fail data, so `funnel`,
// `reserve` and `adaptation` are intentionally left as demo, same as
// `admin`'s docsByType/avgProcessingDays (see project memory) — don't
// invent those from this source.
//
// The sheet's own "active" list (46 open/in-progress rows, before its
// "закрытые вакансии" historical archive) sums to exactly 142 required
// headcount (общ) / 41 excluding mass field-roles (без учета полевых,
// i.e. minus 6 водитель "Е" + 20 ОКП водители-курьеры + 50 ОДТ
// водители-курьеры + 25 ОРП операторы АЗС = 101) — matches the sheet's
// own totals exactly, confirming the row-level read.
//
// Per-dept open-position counts (sum of "необходимое кол-во" grouped by
// "Отдел" across the active list):
const byDeptAll = {
  'СВКА': 1, 'ОРН': 5, 'Али Гарант': 2, 'ОПЗИ': 5, 'Ред Маркет': 1, 'ОЦП': 1,
  'СКП': 1, 'УЧР': 1, 'КРО': 1, 'Маркетинг /КД': 1, 'ОКП': 22,
  'Учебный проект': 4, 'БЦ Салима': 1, 'ТС': 4, 'САУП': 4, 'ОМ': 1,
  'ДИТ': 1, 'ОМТС': 1, 'СЭТС': 8, 'ОДТ': 52, 'ОРП': 25,
};

// Time-to-close (Дата заявки -> Дата закрытие вакансии), only for rows
// where BOTH dates are clean calendar dates (most rows have a narrative
// comment instead, e.g. "выход 21.09" or "сказали пауза" — excluded).
// Only 8 of the ~46 active-list rows qualify; a thin sample, grouped by
// dept below only for the 6 depts that have at least one such pair:
const timeToClose = [
  { dept: 'СКП', days: 21 },       // Аналитик по автоматизации: 24.08 -> ~14.09
  { dept: 'УЧР', days: 37 },       // Рекрутер: 25.08 -> выход 01.10
  { dept: 'ТС', days: 50 },        // Инженер-электронщик: 04.08 -> 23.09
  { dept: 'ДИТ', days: 49 },       // IT специалист: 13.08 -> выход 01.10
  { dept: 'ОРН', days: 23 },       // делопроизводитель: 25.08 -> 17.09
  { dept: 'САУП', days: 16 },      // Бухгалтер стажер: 18.08 -> 03.09
  { dept: 'СЭТС', days: 40 },      // водитель автокрана: 13.08 -> 22.09
  { dept: 'САУП', days: 28 },      // бухгалтер по лимитам: 20.08 -> 17.09
];
const byDeptDays = {};
for (const t of timeToClose) (byDeptDays[t.dept] ??= []).push(t.days);
const avgOf = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

const byDept = Object.keys(byDeptDays)
  .map((dept) => ({ dept, open: byDeptAll[dept], avgDays: avgOf(byDeptDays[dept]) }))
  .sort((a, b) => b.open - a.open);

const overallAvg = avgOf(timeToClose.map((t) => t.days));

const updated = {
  ...current,
  byDept,
  avgTimeToHire: { ...current.avgTimeToHire, current: overallAvg },
  conclusion: 'Срок закрытия вакансии в сентябре — ' + overallAvg + ' дн. (по 8 вакансиям с полными датами заявки и закрытия; сравнение с прошлым месяцем пока недоступно — это первый период с реальными данными по срокам подбора). Всего в работе 142 вакансии (41 без учёта массового найма), больше всего открыто в ОДТ (52, преимущественно курьеры) и ОКП (22, преимущественно курьеры и опт).',
};
// prev intentionally left equal to current (explicit +0 дн. delta) rather
// than fabricated — see conclusion text above, which spells out that the
// comparison isn't real yet. funnel/reserve/adaptation untouched (demo).
updated.avgTimeToHire.prev = overallAvg;

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='recruitment' AND period=${PERIOD}
`;
console.log('recruitment updated (byDept + avgTimeToHire, real data) for', PERIOD);
console.log(JSON.stringify(byDept, null, 2));
console.log('overall avg:', overallAvg);
