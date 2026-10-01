import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='proposals' AND period=${PERIOD}`;
if (!rows.length) { console.error('no proposals row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: user-provided "КП на 3 страны.docx" (the file actually
// covers 4 destinations, not 3 — flagged to the user). Prices intentionally
// omitted per the user's "без цен" instruction; dates moved to January
// 2027 per the user's explicit instruction (the source doc only gave
// day/month, no year). Photos generated to match (images/trip-*.png,
// committed alongside this script) since no destination photos were in
// the source doc itself.
const tripItems = [
  {
    direction: 'Мотивация',
    proposal: 'Маврикий — Radisson Blu Poste Lafayette 4* (18+) / RIU Turquoise Mauritius 4* / RIU Palace Mauricius 4* (18+), 3–10 января 2027 (8 дней/7 ночей), всё включено, перелёт из Бишкека с пересадкой (10–12 ч)',
    priority: 'medium', status: 'new', responsible: 'А. Маслов',
    image: 'images/mauritius.png',
  },
  {
    direction: 'Мотивация',
    proposal: 'Сейшелы — Canopy by Hilton Seychelles 4*, 4–12 янв 2027 (9д/8н); Savoy Seychelles Resort & Spa 5*, 4–12 янв 2027 (9д/8н, тариф для молодожёнов); Hilton Seychelles Northolme Resort & Spa 5*, 2–9 янв 2027 (8д/7н) — завтраки, перелёт из Алматы',
    priority: 'medium', status: 'new', responsible: 'А. Маслов',
    image: 'images/seychelles.png',
  },
  {
    direction: 'Мотивация',
    proposal: 'Мальдивы — Lagoon View Maldives 4*, 4–10 янв 2027 (7д/6н); Adaaran Club Rannalhi 4*, 4–10 янв 2027 (7д/6н); Villa Park Sun Island 5*, 4–11 янв 2027 (8д/7н) — всё включено, перелёт из Алматы',
    priority: 'medium', status: 'new', responsible: 'А. Маслов',
    image: 'images/maldives.png',
  },
  {
    direction: 'Мотивация',
    proposal: 'Шри-Ланка — Anarva Mount Lavinia 4* / Mandarina Colombo 4* / Cinnamon Lakeside 5*, все варианты 4–11 января 2027 (8 дней/7 ночей) — завтраки, перелёт из Алматы',
    priority: 'medium', status: 'new', responsible: 'А. Маслов',
    image: 'images/srilanka.png',
  },
];

const updated = {
  ...current,
  items: [...current.items, ...tripItems],
  notes: 'Мотивационная поездка для руководителей — реальное коммерческое предложение (цены не показаны здесь по решению УЧР, полная версия с тарифами есть у УЧР). Остальные категории предложений пока демо, ждут протокол УЧР за октябрь.',
  conclusion: 'Предложена мотивационная поездка для руководителей на январь 2027 — КП на 4 направления (Маврикий, Сейшелы, Мальдивы, Шри-Ланка). Приоритеты остальных предложений будут внесены по итогам протокола УЧР за октябрь.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='proposals' AND period=${PERIOD}
`;
console.log('proposals.items: added 4 trip items for', PERIOD);
