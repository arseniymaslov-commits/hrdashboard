// One-off migration: for every period that still has a separate 'analytics'
// row, copy its unique fields (structureByDept, hrRatio, internalFillRate)
// into that same period's 'composition' row, then delete the 'analytics'
// row. Safe to re-run — periods with no 'analytics' row left are skipped.
//
// Usage: DATABASE_URL="postgres://..." node scripts/merge-analytics-into-composition.mjs

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL env var is required'); process.exit(1); }

const sql = neon(DATABASE_URL);

const periods = await sql`SELECT DISTINCT period FROM hr_data ORDER BY period`;
for (const { period } of periods) {
  const compRow = await sql`SELECT data FROM hr_data WHERE key='composition' AND period=${period}`;
  const anaRow = await sql`SELECT data FROM hr_data WHERE key='analytics' AND period=${period}`;
  if (!anaRow.length) {
    console.log(period, '- no analytics row left, nothing to merge (already done or never had one)');
    continue;
  }
  if (!compRow.length) {
    console.log(period, '- WARNING: analytics row exists but no composition row to merge into, skipping');
    continue;
  }
  const comp = compRow[0].data;
  const ana = anaRow[0].data;
  const merged = Object.assign({}, comp, {
    structureByDept: ana.structureByDept,
    hrRatio: ana.hrRatio,
    internalFillRate: ana.internalFillRate,
  });
  await sql`UPDATE hr_data SET data=${JSON.stringify(merged)}::jsonb, updated_at=now() WHERE key='composition' AND period=${period}`;
  await sql`DELETE FROM hr_data WHERE key='analytics' AND period=${period}`;
  console.log(period, '- merged structureByDept/hrRatio/internalFillRate into composition, removed analytics row');
}

const remaining = await sql`SELECT DISTINCT period FROM hr_data WHERE key='analytics'`;
console.log('Done. Periods still holding an analytics row:', remaining.length ? remaining.map(r=>r.period).join(', ') : 'none');
