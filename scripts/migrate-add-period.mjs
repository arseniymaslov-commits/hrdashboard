// One-off, idempotent migration: adds a 'period' column to hr_data and makes
// the primary key (key, period) instead of just (key), so each report block
// can have one row per month. Existing rows (all implicitly "current" at the
// time this migration first runs) are backfilled with the given period.
//
// Usage: DATABASE_URL="postgres://..." node scripts/migrate-add-period.mjs 2026-09

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL env var is required'); process.exit(1); }
const backfillPeriod = process.argv[2];
if (!backfillPeriod || !/^\d{4}-\d{2}$/.test(backfillPeriod)) {
  console.error('usage: node scripts/migrate-add-period.mjs <YYYY-MM>  (period to backfill existing rows with)');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'hr_data' AND column_name = 'period'
`;

if (cols.length) {
  console.log('period column already exists — nothing to migrate.');
} else {
  console.log('Adding period column...');
  await sql`ALTER TABLE hr_data ADD COLUMN period TEXT`;
  console.log('Backfilling existing rows with period =', backfillPeriod);
  await sql.query('UPDATE hr_data SET period = $1 WHERE period IS NULL', [backfillPeriod]);
  await sql`ALTER TABLE hr_data ALTER COLUMN period SET NOT NULL`;
  console.log('Dropping old primary key, adding (key, period)...');
  await sql`ALTER TABLE hr_data DROP CONSTRAINT IF EXISTS hr_data_pkey`;
  await sql`ALTER TABLE hr_data ADD PRIMARY KEY (key, period)`;
  console.log('Migration done.');
}

const rows = await sql`SELECT key, period FROM hr_data ORDER BY period DESC, key`;
console.log('Current rows:', rows.length);
for (const r of rows) console.log(' ', r.period, r.key);
