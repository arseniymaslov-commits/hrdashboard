import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='composition' AND period=${PERIOD}`;
if (!rows.length) { console.error('no composition row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real data sources (2026-10-01):
// - "Новый вид ШР" staffing sheet (1Ng7oXR3Jg...), snapshot ~20.09.2026:
//   2419 active (2669 total rows - 250 marked "Уволен (авто)"), gender
//   1882м/537ж, department breakdown via "Отдел" column, УЧР (HR dept)
//   headcount 16 -> hrRatio.
// - "Текучесть по СП — 2026" companion sheet (1qHhJX5CVRQ...): real
//   company-wide ССЧ (avg headcount) + turnover % for Jan-Aug 2026, and
//   per-СП turnover for ranking departments (ЭБ/ОПЗИ excluded as tiny-unit
//   single-departure noise spikes, per earlier project note).
// - HR order logs (office/АЗС/СЭТС "Прием"/"Увольнение" tabs, Google
//   Drive folder shared 2026-09-30): real September hire/fire counts.
const hired = 113;
const fired = 123;
const gender = { male: 1882, female: 537 };
const hrRatio = Math.round((16 / 2419) * 1000) / 10; // УЧР headcount / total active, per 100

const headcountHistory = [
  { month: 'Апр', count: 2467 },
  { month: 'Май', count: 2429 },
  { month: 'Июн', count: 2446 },
  { month: 'Июл', count: 2412 },
  { month: 'Авг', count: 2445 },
  { month: 'Сен', count: 2419 },
];
const turnoverHistory = [
  { month: 'Апр', rate: 8.4 },
  { month: 'Май', rate: 3.8 },
  { month: 'Июн', rate: 6.4 },
  { month: 'Июл', rate: 7.5 },
  { month: 'Авг', rate: 5.6 },
  { month: 'Сен', rate: 5.1 },
];

const structureByDept = [
  { dept: 'ОРП', count: 1399 },
  { dept: 'СЭТС', count: 212 },
  { dept: 'ОДТ', count: 186 },
  { dept: 'УНБХ', count: 133 },
  { dept: 'ТД', count: 123 },
  { dept: 'САУП', count: 78 },
];

const departmentTurnover = [
  { dept: 'ОРП', history: [
    { month: 'Апр', rate: 10.9 }, { month: 'Май', rate: 4.6 }, { month: 'Июн', rate: 8.1 },
    { month: 'Июл', rate: 9.6 }, { month: 'Авг', rate: 7.7 },
  ] },
  { dept: 'ОДТ', history: [
    { month: 'Апр', rate: 10.7 }, { month: 'Май', rate: 7.6 }, { month: 'Июн', rate: 0 },
    { month: 'Июл', rate: 0 }, { month: 'Авг', rate: 7.7 },
  ] },
  { dept: 'СЭТС', history: [
    { month: 'Апр', rate: 5.9 }, { month: 'Май', rate: 4.2 }, { month: 'Июн', rate: 5.3 },
    { month: 'Июл', rate: 6.3 }, { month: 'Авг', rate: 4.3 },
  ] },
];

const updated = {
  ...current,
  hired,
  fired,
  gender,
  hrRatio,
  headcountHistory,
  structureByDept,
  departmentTurnover,
  turnoverRate: { current: 5.1, prev: 5.6, history: turnoverHistory },
  conclusion: 'Численность снизилась до 2419 человек (−26 за месяц, снимок на ~20.09): принято 113, уволено 123; в штате 78% мужчин и 22% женщин; текучесть кадров — 5,1% (−0,5 п.п. к прошлому месяцу), самая высокая — на ОРП и ОДТ (7,7%).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='composition' AND period=${PERIOD}
`;
console.log('composition updated for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
