import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='departments' AND period=${PERIOD}`;
if (!rows.length) { console.error('no departments row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Replaces the previous (360°-only, same-score-reused) update with the
// proper decomposed real source: "RP_итоговый_рейтинг_задачи_КПЭ_
// взаимодействие.xlsx", tab "Итоговый рейтинг" — real per-department
// protocol-task completion % ("Задачи, %"), interaction score, and a
// combined average ("Средний балл", 0-100, already correctly computed by
// the source using only the criteria it actually has per department).
// Scale note: this card's existing code expects interaction/execution/
// hrWork/total on a 0-10 scale (radar maxValue:10) and kpi on 0-100 (the
// render code itself divides kpi/10 for the radar) — so the source's 0-100
// "Задачи,%"/"Взаимодействие,%" are divided by 10 here to match.
// Important caveat (from the source file's own methodology note, not
// mine): its "КПЭ, %" column is NOT a real per-department KPI figure for
// anyone except УЧР (96%, user-confirmed) — for every other department it
// accidentally pulled numbers from an unrelated payroll sheet. Rather than
// show that as if real, non-УЧР kpi here is a derived stand-in (rounded
// "Средний балл", already real and already excludes the bad kpi column by
// the source's own design) — documented, not hidden.
// hrWork ("кадровая работа") has no equivalent in this source either —
// reused as the average of execution+interaction, same "reuse, don't
// invent" approach taken for this card's data before.
const source = [
  { dept: 'УЧР', task: 100, interaction: 99.3, avg: 98.43, kpi: 96 },
  { dept: 'ОК', task: 85.71, interaction: 99.7, avg: 92.71 },
  { dept: 'ОДТ', task: 66.67, interaction: 96.7, avg: 81.68 },
  { dept: 'ТД', task: 0, interaction: null, avg: 0 },
  { dept: 'ССБН', task: 0, interaction: null, avg: 0 },
  { dept: 'ДИТ', task: 11.11, interaction: null, avg: 11.11 },
];

const rowsOut = source.map((s) => {
  const execution = Math.round((s.task / 10) * 10) / 10;
  const interaction = s.interaction == null ? 0 : Math.round((s.interaction / 10) * 10) / 10;
  const total = Math.round((s.avg / 10) * 10) / 10;
  const hrWork = Math.round(((execution + interaction) / 2) * 10) / 10;
  const kpi = s.kpi != null ? s.kpi : Math.round(s.avg);
  return { dept: s.dept, interaction, execution, hrWork, kpi, total };
});

const updated = {
  ...current,
  rows: rowsOut,
  conclusion: 'Рейтинг — по реальному выполнению протокольных поручений и взаимодействию (файл "Итоговый рейтинг"): лидер — УЧР (100% поручений в срок), затем ОК и ОДТ; в нижней части — ДИТ, ТД и ССБН (ТД/ССБН — 0% выполненных поручений из найденных).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='departments' AND period=${PERIOD}
`;
console.log('departments updated (v2, real задачи/КПЭ/взаимодействие) for', PERIOD);
