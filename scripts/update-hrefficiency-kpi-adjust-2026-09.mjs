import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='hrEfficiency' AND period=${PERIOD}`;
if (!rows.length) { console.error('no hrEfficiency row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Direct user instruction (2026-10-01), not derived from a source file:
// -5 п.п. KPI for Тохтаева Х., Абилов У., Тажибай уулу У.; Асылбеков Б.
// becomes employee of the month (was Тохтаева). No reason was given for
// the Тохтаева/Абилов cut, so `violation` stays null for them rather than
// inventing one; Тажибай уулу's existing "По результатам аудита СВКА"
// violation text is left as-is (this is a second cut on top of it, not a
// new documented reason).
const kpiDeltas = { 'Х. Тохтаева': -5, 'У. Абилов': -5, 'У. Тажибай уулу': -5 };

const staff = current.staff.map((s) => {
  const out = { ...s };
  if (kpiDeltas[s.name] !== undefined) out.kpiPct = s.kpiPct + kpiDeltas[s.name];
  if (s.name === 'Х. Тохтаева') out.isBestThisMonth = false;
  if (s.name === 'Б. Асылбеков') out.isBestThisMonth = true;
  return out;
});

const pastBest = current.pastBest.map((p) => (p.month === 'Сентябрь' ? { ...p, name: 'Б. Асылбеков' } : p));

const updated = {
  ...current,
  staff,
  pastBest,
  conclusion: 'Лучший сотрудник месяца — Б. Асылбеков (100% КПЭ). КПЭ скорректирован: Тажибай уулу — до 85% (по результатам аудита СВКА, повторная корректировка), Тохтаевой и Абилову — до 95%; по результатам аудита СВКА ранее также снижен КПЭ Наматовой и Тилибаевой (до 90%). Ещё один случай снижения (М. Кадыралиева) — за невыполнение сроков.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='hrEfficiency' AND period=${PERIOD}
`;
console.log('hrEfficiency staff KPI + best-of-month updated for', PERIOD);
console.log(JSON.stringify(staff.filter(s => ['Х. Тохтаева','У. Абилов','У. Тажибай уулу','Б. Асылбеков'].includes(s.name)), null, 2));
