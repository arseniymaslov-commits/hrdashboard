import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='composition' AND period=${PERIOD}`;
if (!rows.length) { console.error('no composition row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// User-provided directly (no source file): add ОКС (60) and Securi Force
// (287) to structureByDept. This chart is already a partial "biggest
// departments" view, not an exhaustive breakdown — its existing 6 entries
// sum to 2131, well under the 2419 total headcount — so adding 2 more
// entries doesn't need (and doesn't get) any change to gender/total/
// turnover here; those are separate fields untouched by this chart.
const additions = [
  { dept: 'ОКС', count: 60 },
  { dept: 'Securi Force', count: 287 },
];

const structureByDept = [...current.structureByDept, ...additions]
  .sort((a, b) => b.count - a.count);

const updated = { ...current, structureByDept };

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='composition' AND period=${PERIOD}
`;
console.log('composition.structureByDept updated for', PERIOD);
console.log(JSON.stringify(structureByDept, null, 2));
