import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='budget' AND period=${PERIOD}`;
if (!rows.length) { console.error('no budget row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Correction to the previous budget update: that one assumed September's
// FACT just mirrored whatever PLAN figure was already sitting in the demo
// data (18.4-20M range) — but that old number was never real, it was a
// leftover fictional company-wide-looking figure. The user has now sent
// the actual "УЧР Бюджет Сентябрь 2026.xlsx" (real September actuals for
// the HR department's OWN operating budget — subscriptions, recruitment
// fees, events, etc., NOT the whole company's payroll) and reconfirmed
// "это факт" / 100% utilization. So both plan and fact for September are
// now replaced with this real, internally-consistent (checksum-verified)
// scope — same category mapping method used for the October plan:
//   ФОТ (УЧР's own payroll) = 656 000 + 789 000 = 1 445 000
//   Подбор и HR-маркетинг = Лалафо 5 000 + HH 28 300 = 33 300
//   Обучение и развитие = МУЦ 17 940 + ПДД 35 000 = 52 940
//   Кадровое администрирование = chatGPT 5 600 + Red Staff 87 500 +
//     непредвиденные 10 000 + СКУД-инвестиция 20 000 = 123 100
//   Корпоративные мероприятия = мотивация 695 000 + Ред Фест 2 715 433 +
//     НГ-бронирование 300 000 + подарок ГД 200 000 + вендинг 100 000
//     = 4 010 433
// Sum = 5 664 773 = "Итого бюджет УЧР" in the source file, exact match.
// The big one-off "Ред Фест" line is what drives September's spend far
// above October's planned run-rate for that category — called out in the
// conclusion rather than hidden.
const sepByCategory = {
  'Фонд оплаты труда': 1445000,
  'Подбор и HR-маркетинг': 33300,
  'Обучение и развитие': 52940,
  'Кадровое администрирование': 123100,
  'Корпоративные мероприятия': 4010433,
};
const byLine = current.byLine.map((l) => {
  const v = sepByCategory[l.line];
  return v == null ? l : { ...l, plan: v, fact: v, note: l.line === 'Корпоративные мероприятия' ? 'Основная сумма — проведение Ред Феста' : '' };
});
const sepTotal = Object.values(sepByCategory).reduce((a, b) => a + b, 0);

const updated = {
  ...current,
  byLine,
  history: [{ month: 'Сен', plan: sepTotal, fact: sepTotal }],
  conclusion: `Освоение бюджета — 100% плана (${sepTotal.toLocaleString('ru-RU')} сом за сентябрь, из них 2 715 433 — разовое проведение Ред Феста); план на октябрь — 3 023 882,5 сом.`,
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='budget' AND period=${PERIOD}
`;
console.log('budget updated (v2, real Sept fact) for', PERIOD, '- total:', sepTotal);
