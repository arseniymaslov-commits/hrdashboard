import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='budget' AND period=${PERIOD}`;
if (!rows.length) { console.error('no budget row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// User correction (2026-10-01, direct knowledge, not from a file): the
// "Непредвиденные затраты" (contingency) line was NOT actually spent in
// September — the source xlsx's "Сентябрь факт" column for this one line
// was wrong/a placeholder (10 000, same as plan). `plan` stays 10 000
// (that's genuinely what was allotted); only `fact` drops to 0 — this is
// the first line all month where plan != fact, which is real and fine
// (an unused contingency reserve, not an error).
const byLine = current.byLine.map((l) =>
  l.line === 'Непредвиденные затраты' ? { ...l, fact: 0, note: 'Резерв не использован в сентябре' } : l
);

const totalFact = byLine.reduce((a, l) => a + l.fact, 0);
const totalPlan = byLine.reduce((a, l) => a + l.plan, 0);
const totalNextPlan = byLine.reduce((a, l) => a + l.nextPlan, 0);
if (totalFact !== 5654773) { console.error('unexpected totalFact', totalFact); process.exit(1); }
if (totalPlan !== 5664773) { console.error('unexpected totalPlan', totalPlan); process.exit(1); }

const pctOfPlan = Math.round((totalFact / totalPlan) * 1000) / 10; // 99.8
const pctNextVsFact = Math.round((totalNextPlan / totalFact) * 1000) / 10; // ~53.5
const pctDrop = Math.round((100 - pctNextVsFact) * 10) / 10; // ~46.5

const history = current.history.map((h) => (h.month === 'Сен' ? { ...h, fact: totalFact } : h));

const updated = {
  ...current,
  byLine,
  history,
  conclusion: `Освоение бюджета — ${fmt(pctOfPlan)}% плана (${fmtMoney(totalFact)} сом факт при плане ${fmtMoney(totalPlan)} — резерв на непредвиденные затраты, 10 000 сом, в сентябре не использован). План на октябрь ниже на ${fmt(pctDrop)}% (${fmtMoney(totalNextPlan)} сом) — расходы на мероприятия не заложены (−3 015 433), зато вырос бюджет на подбор персонала (33 300 → 121 000, HH и Lalafo) и на инвестиции в ПО для СКУД (20 000 → 200 000).`,
};

function fmt(n) { return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); }
function fmtMoney(n) { return n.toLocaleString('ru-RU'); }

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='budget' AND period=${PERIOD}
`;
console.log('budget contingency fact fixed for', PERIOD);
console.log('totalFact:', totalFact, 'pctOfPlan:', pctOfPlan, 'pctNextVsFact:', pctNextVsFact);
console.log(updated.conclusion);
