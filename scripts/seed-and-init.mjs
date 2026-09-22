// One-off local script: creates hr_data table (if missing) and seeds it with
// the DEMO dataset extracted straight from the original report HTML, so the
// live dashboard opens with today's real report content instead of empty
// blocks. Safe to re-run (upserts).
//
// Usage: DATABASE_URL="postgres://..." node scripts/seed-and-init.mjs <path-to-original-index.html>

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
  console.error('usage: node scripts/seed-and-init.mjs <path-to-original-index.html>');
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

const keys = Object.keys(DEMO);
console.log('Parsed DEMO object, keys:', keys.join(', '));

const sql = neon(DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS hr_data (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
console.log('Table hr_data ready.');

for (const key of keys) {
  await sql`
    INSERT INTO hr_data (key, data, updated_at)
    VALUES (${key}, ${JSON.stringify(DEMO[key])}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
  console.log('  seeded:', key);
}

const count = await sql`SELECT count(*)::int AS n FROM hr_data`;
console.log('Done. Rows in hr_data:', count[0].n);
