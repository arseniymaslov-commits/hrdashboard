import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='assessment' AND period=${PERIOD}`;
if (!rows.length) { console.error('no assessment row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: the canonical "Новый вид ШР" staffing sheet (see project
// memory reference_shr_google_sheet), matched by surname. 2 of 3 are
// unambiguous surname matches (both водитель-курьер, ОДТ). "С. Осмоналиев"
// has two surname+initial matches in ШР — Сулайман Осмоналиев (Зам.
// руководителя УНБХ) and Сталбек Осмоналиев (водитель-курьер, ОДТ); went
// with Сталбек/ОДТ since the other two confirmed movers are both
// водитель-курьер/ОДТ and кейсовые проверки run per-cohort — a judgment
// call documented here, not a certain match, in case this needs revisiting.
const positions = {
  'С. Осмоналиев': 'Водитель-курьер, ОДТ',
  'А. Мамаюсупов': 'Водитель-курьер, ОДТ',
  'С. Мамытбеков': 'Водитель-курьер, ОДТ',
};

const movers = current.movers.map((m) => ({ ...m, position: positions[m.name] || null }));

const updated = { ...current, movers };

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='assessment' AND period=${PERIOD}
`;
console.log('assessment.movers positions added for', PERIOD);
console.log(JSON.stringify(movers, null, 2));
