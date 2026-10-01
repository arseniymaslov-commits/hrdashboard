import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='admin' AND period=${PERIOD}`;
if (!rows.length) { console.error('no admin row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// 2026-10-01: user asked to check Red Staff's own "приказы по личному
// составу" (personnel orders) feature as a real source for this block.
// Checked directly against Red Staff's database (Order model,
// category=PERSONNEL): the feature exists (schema, approval workflow,
// subtypes HIRE/DISMISSAL/VACATION/BONUS/TRANSFER/DISCIPLINARY/
// BUSINESS_TRIP/PROBATION_RESULT) but has ZERO records ever created — not
// "no source provided", but confirmed operationally unused so far. No real
// data exists to replace docsByType/avgProcessingDays/overdueList with yet.
const updated = {
  ...current,
  conclusion: 'Данные по срокам исполнения документов и ответственным по ним — демо. Проверено напрямую в Red Staff (модуль приказов по личному составу): функция есть, но ни одного приказа через неё ещё не проведено (0 записей) — реальных цифр оформления/просрочки взять неоткуда, пока модуль не используется в работе. Количество документов по типам и среднее время оформления ниже — тоже демо-данные.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='admin' AND period=${PERIOD}
`;
console.log('admin conclusion updated (findings from Red Staff Order check) for', PERIOD);
