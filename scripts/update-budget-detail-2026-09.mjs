import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='budget' AND period=${PERIOD}`;
if (!rows.length) { console.error('no budget row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: "План_бюджета_УЧР_Октябрь_2026.xlsx" (user-provided local file,
// sheet "План Октябрь"). Replaces the previous 5-bucket byLine with the
// file's real 12 leaf line items (its 2 category subtotal rows "Постоянные
// расходы"/"Переменные расходы" and the "ИТОГО" grand-total row are dropped
// here since render_budget() derives its own totals/subtotals by summing
// byLine — keeping those would double-count). Both totals reconcile exactly
// against the previous data: fact sums to 5 664 773 (Sept, unchanged) and
// nextPlan sums to 3 023 882.5 (Oct, unchanged) — this is a more granular
// breakdown of the same totals, not a revision of them. `plan` is set equal
// to `fact` per line (the source's own "Освоение сентября" column is 100%
// for every line, matching this project's existing fact=plan convention).
const byLine = [
  { line: 'Заработная плата (постоянная)', fact: 656000, plan: 656000, nextPlan: 676000, note: 'Рост на 20 000 сом' },
  { line: 'Услуги: ChatGPT + Red Staff', fact: 93100, plan: 93100, nextPlan: 99942.5, note: 'Рост стоимости ChatGPT' },
  { line: 'Мотивационные программы', fact: 695000, plan: 695000, nextPlan: 620000, note: 'Снижение на 75 000 сом' },
  { line: 'Заработная плата (переменная)', fact: 789000, plan: 789000, nextPlan: 809000, note: 'Рост на 20 000 сом' },
  { line: 'Обучение', fact: 52940, plan: 52940, nextPlan: 42940, note: 'Снижение расходов на ПДД' },
  { line: 'Подбор персонала', fact: 33300, plan: 33300, nextPlan: 121000, note: 'Рост бюджета на HH и Lalafo' },
  { line: 'Подарок от ГД для руководителей', fact: 200000, plan: 200000, nextPlan: 300000, note: 'Рост на 100 000 сом' },
  { line: 'Мероприятия', fact: 3015433, plan: 3015433, nextPlan: 0, note: 'В октябре расходы не заложены' },
  { line: 'Непредвиденные затраты', fact: 10000, plan: 10000, nextPlan: 10000, note: 'Без изменений' },
  { line: 'Трудовые книжки / командировочные', fact: 0, plan: 0, nextPlan: 45000, note: 'В октябре заложены трудовые книжки' },
  { line: 'Товары для вендингового аппарата', fact: 100000, plan: 100000, nextPlan: 100000, note: 'Без изменений' },
  { line: 'Инвестиции — ПО для СКУД', fact: 20000, plan: 20000, nextPlan: 200000, note: 'Увеличение инвестиций' },
];

const factSum = byLine.reduce((a, l) => a + l.fact, 0);
const nextPlanSum = byLine.reduce((a, l) => a + l.nextPlan, 0);
if (Math.round(factSum) !== 5664773) { console.error('fact sum mismatch:', factSum); process.exit(1); }
if (Math.abs(nextPlanSum - 3023882.5) > 0.01) { console.error('nextPlan sum mismatch:', nextPlanSum); process.exit(1); }

const updated = {
  ...current,
  byLine,
  conclusion: 'Освоение бюджета — 100% плана (5 664 773 сом за сентябрь). План на октябрь ниже на 46,6% (3 023 882,5 сом) — расходы на мероприятия не заложены (−3 015 433), зато вырос бюджет на подбор персонала (33 300 → 121 000, HH и Lalafo) и на инвестиции в ПО для СКУД (20 000 → 200 000).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='budget' AND period=${PERIOD}
`;
console.log('budget byLine replaced with 12 real line items for', PERIOD);
console.log('fact sum:', factSum, 'nextPlan sum:', nextPlanSum);
