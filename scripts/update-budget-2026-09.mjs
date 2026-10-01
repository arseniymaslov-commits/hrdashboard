import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='budget' AND period=${PERIOD}`;
if (!rows.length) { console.error('no budget row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// September: user confirmed 100% utilization (fact = plan) for every line,
// so this just mirrors the already-entered September plan into fact.
// October: real plan from "УЧР Бюджет Октябрь 2026.xlsx", tab "УЧР".
// The source file is organized by Постоянные/Переменные расходы, not by
// the dashboard's 5 functional categories — mapped as:
//   ФОТ = ЗП постоянная (676000) + ЗП переменная (809000) = 1 485 000
//   Подбор и HR-маркетинг = услуги по подбору (Лалафо 10000 + HH 111000) = 121 000
//   Обучение и развитие = МУЦ (17940) + ПДД (25000) = 42 940
//   Кадровое администрирование = chatGPT (12442.5) + Red Staff (87500)
//     + трудовые книжки (45000) + непредвиденные (10000) + СКУД-инвестиция
//     (200000) = 354 942.5
//   Корп. мероприятия = мотивация ОДТ/СЭТС/ОРП/офис (620000) + подарок
//     руководителям (300000) + вендинг (100000) = 1 020 000
// Sum = 3 023 882.5 = "Итого бюджет УЧР" in the source — reconciles exactly.
// The "Футбол" tab (separate one-off event budget, 2 730 000) is NOT
// included — it isn't part of the monthly УЧР budget's 5 categories.
const byLine = current.byLine.map((l) => ({ ...l, fact: l.plan, note: '' }));
byLine[0].nextPlan = 1485000; // ФОТ
byLine[1].nextPlan = 121000; // Подбор и HR-маркетинг
byLine[2].nextPlan = 42940; // Обучение и развитие
byLine[3].nextPlan = 354942.5; // Кадровое администрирование
byLine[4].nextPlan = 1020000; // Корпоративные мероприятия

const sepPlanTotal = current.byLine.reduce((a, l) => a + l.plan, 0);
const history = current.history.map((h, i, arr) =>
  i === arr.length - 1 ? { ...h, fact: h.plan } : h
);

const updated = {
  ...current,
  byLine,
  history,
  conclusion: `Освоение бюджета — 100% плана (${sepPlanTotal.toLocaleString('ru-RU')} сом); план на октябрь — 3 023 882,5 сом (пост. 1 395 942,5 + перем. 1 427 940 + инвестиция в ПО СКУД 200 000).`,
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='budget' AND period=${PERIOD}
`;
console.log('budget updated for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
