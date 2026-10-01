import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='hrEfficiency' AND period=${PERIOD}`;
if (!rows.length) { console.error('no hrEfficiency row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Source: "Копия Система КПЭ УЧР" Google Sheet, tab "Расчеты" (sheet 1) —
// real September per-employee KPI% for the whole УЧР (HR) department
// itself (15 people). Cross-checked against the 02.09.2026 protocol's
// item 5 ("СВКА... снижен КПЭ 3 кадровым специалистам – 90%") — matches
// exactly (Наматова, Тилибаева, Тажибай уулу). Кадыралиева's 90% is a
// separate, unrelated reduction (missed deadlines).
const staff = [
  { name: 'А. Маслов', position: 'Руководитель УЧР', functions: 'Управление отделом', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'З. Акматова', position: 'Зам. рук. УЧР', functions: 'Управление отделом', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'У. Абилов', position: 'Зам. рук. УЧР Юг', functions: 'Управление отделом (регион)', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'Н. Наматова', position: 'Ст. специалист АКО', functions: 'Кадровое администрирование', kpiPct: 90, violation: 'По результатам аудита СВКА', isBestThisMonth: false },
  { name: 'З. Тилибаева', position: 'Специалист по КА', functions: 'Кадровое администрирование', kpiPct: 90, violation: 'По результатам аудита СВКА', isBestThisMonth: false },
  { name: 'Х. Тохтаева', position: 'Специалист по КА', functions: 'Кадровое администрирование', kpiPct: 100, violation: null, isBestThisMonth: true },
  { name: 'У. Тажибай уулу', position: 'Специалист по КА', functions: 'Кадровое администрирование', kpiPct: 90, violation: 'По результатам аудита СВКА', isBestThisMonth: false },
  { name: 'А. Усенгазиева', position: 'Специалист по Д-А', functions: 'Делопроизводство/архив', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'Ю. Калугина', position: 'Специалист по Д-А', functions: 'Делопроизводство/архив', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'В. Абдылдаева', position: 'Специалист по оценке', functions: 'Оценка персонала', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'М. Кадыралиева', position: 'Специалист по обучению', functions: 'Обучение и развитие', kpiPct: 90, violation: 'Невыполнение сроков', isBestThisMonth: false },
  { name: 'А. Нурлан кызы', position: 'HR по дисциплине', functions: 'Дисциплина труда', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'Н. Сыпабекова', position: 'Ст. специалист ОПАП', functions: 'Подбор и адаптация', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'Б. Асылбеков', position: 'Специалист ОПАП', functions: 'Подбор и адаптация', kpiPct: 100, violation: null, isBestThisMonth: false },
  { name: 'А. Мамбетакунова', position: 'Специалист ОПАП', functions: 'Подбор и адаптация', kpiPct: 100, violation: null, isBestThisMonth: false },
];

const updated = {
  ...current,
  staff,
  pastBest: [{ name: 'Х. Тохтаева', month: 'Сентябрь' }],
  conclusion: 'Лучший сотрудник месяца — Х. Тохтаева (100% КПЭ, за отсутствие ошибок); по результатам аудита СВКА снижен КПЭ до 90% трём специалистам КА (Наматова, Тилибаева, Тажибай уулу), ещё один случай снижения (М. Кадыралиева) — за невыполнение сроков.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='hrEfficiency' AND period=${PERIOD}
`;
console.log('hrEfficiency updated for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
