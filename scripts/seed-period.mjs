// Seeds a single historical (or future) period from a standalone JSON
// snapshot file (same shape as the DEMO object: {meta, composition,
// recruitment, ...}). Safe to re-run (upserts). Requires the (key, period)
// schema — run scripts/migrate-add-period.mjs first if the table predates it.
//
// Usage: DATABASE_URL="postgres://..." node scripts/seed-period.mjs 2026-08 aug_demo.json

import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL env var is required'); process.exit(1); }

const period = process.argv[2];
const jsonPath = process.argv[3];
if (!period || !/^\d{4}-\d{2}$/.test(period) || !jsonPath) {
  console.error('usage: node scripts/seed-period.mjs <YYYY-MM> <path-to-snapshot.json>');
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const keys = Object.keys(snapshot);
console.log('Seeding period', period, 'from', jsonPath, '- keys:', keys.join(', '));

const sql = neon(DATABASE_URL);
for (const key of keys) {
  await sql`
    INSERT INTO hr_data (key, period, data, updated_at)
    VALUES (${key}, ${period}, ${JSON.stringify(snapshot[key])}::jsonb, now())
    ON CONFLICT (key, period) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
  console.log('  seeded:', key);
}
const count = await sql`SELECT count(*)::int AS n FROM hr_data WHERE period = ${period}`;
console.log('Done. Rows for period', period + ':', count[0].n);
