import { neon } from '@neondatabase/serverless';
const DATABASE_URL = process.env.DATABASE_URL;
const sql = neon(DATABASE_URL);
const PERIOD = '2026-09';
const rows = await sql`SELECT data FROM hr_data WHERE key='budget' AND period=${PERIOD}`;
const current = rows[0].data;
const updated = {
  ...current,
  byLine: current.byLine.map((l) => l.line === 'Подбор и HR-маркетинг' ? { ...l, line: 'Подбор и УЧР-маркетинг' } : l),
};
await sql`UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now() WHERE key='budget' AND period=${PERIOD}`;
console.log('budget line renamed HR-маркетинг -> УЧР-маркетинг');
