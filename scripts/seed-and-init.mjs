// One-off/repeatable local script: creates the hr_data table (if missing,
// with the (key, period) schema) and seeds it with the DEMO dataset
// extracted straight from the report HTML, tagged with the CURRENT period
// (parsed from DEMO.meta.period, e.g. "Сентябрь 2026" -> "2026-09"). Safe to
// re-run (upserts). This always writes the *current* period — see
// scripts/seed-period.mjs to seed a specific past period from its own JSON
// snapshot, and scripts/migrate-add-period.mjs for the one-time schema
// migration on a pre-period database.
//
// Usage: DATABASE_URL="postgres://..." node scripts/seed-and-init.mjs <path-to-index.html>

import fs from 'node:fs';
import vm from 'node:vm';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var is required');
  process.exit(1);
}

const srcPath = process.argv[2];
if (!srcPath) {
  console.error('usage: node scripts/seed-and-init.mjs <path-to-index.html>');
  process.exit(1);
}

const html = fs.readFileSync(srcPath, 'utf8');
const marker = 'window.__HR__.DEMO = ';
const start = html.indexOf(marker);
if (start === -1) throw new Error('DEMO marker not found in ' + srcPath);
const objStart = start + marker.length;
const end = html.indexOf('\n};', objStart);
if (end === -1) throw new Error('DEMO closing marker not found');
const literal = html.slice(objStart, end + 2); // include closing "}"

const sandbox = {};
vm.createContext(sandbox);
const DEMO = vm.runInContext('(' + literal + ')', sandbox, { timeout: 2000 });

const RU_MONTHS = { 'январь':'01','февраль':'02','март':'03','апрель':'04','май':'05','июнь':'06','июль':'07','август':'08','сентябрь':'09','октябрь':'10','ноябрь':'11','декабрь':'12' };
function periodKeyFromLabel(label) {
  const m = String(label).trim().toLowerCase().match(/^([а-яё]+)\s+(\d{4})$/i);
  if (!m || !RU_MONTHS[m[1]]) throw new Error('Cannot parse period label: ' + label);
  return m[2] + '-' + RU_MONTHS[m[1]];
}
const period = periodKeyFromLabel(DEMO.meta.period);

const keys = Object.keys(DEMO);
console.log('Parsed DEMO object, period =', period, '(' + DEMO.meta.period + '), keys:', keys.join(', '));

const sql = neon(DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS hr_data (
    key TEXT NOT NULL,
    period TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (key, period)
  )
`;
console.log('Table hr_data ready.');

for (const key of keys) {
  await sql`
    INSERT INTO hr_data (key, period, data, updated_at)
    VALUES (${key}, ${period}, ${JSON.stringify(DEMO[key])}::jsonb, now())
    ON CONFLICT (key, period) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
  console.log('  seeded:', key);
}

const count = await sql`SELECT count(*)::int AS n FROM hr_data WHERE period = ${period}`;
console.log('Done. Rows for period', period + ':', count[0].n);
