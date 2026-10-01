import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='recruitment' AND period=${PERIOD}`;
if (!rows.length) { console.error('no recruitment row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: same Google Sheet as the byDept/avgTimeToHire update
// (scripts/update-recruitment-2026-09.mjs) — "Конструктор (база кандидатов)",
// tab "вакансии сентябрь", its active-tracking list (46 rows before the
// "закрытые вакансии" historical archive). This is every row from that list
// EXCEPT status "Пауза" (explicitly on hold, not being searched) and
// "Закрыта" (already filled) — 13 of 43 rows excluded, 30 remain. Position
// names were cross-checked directly against the sheet (not the earlier
// column-truncated table preview) to get full, untruncated titles.
const activeList = [
  { dept: 'СВКА', position: 'внутренний аудитор', count: 1, priority: 'высокий', status: 'оффер принят', recruiter: 'Нуржан' },
  { dept: 'ОРН', position: 'Главный архитектор проекта (ГАП) — с сертификатом ГАП', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Нуржан' },
  { dept: 'ОРН', position: 'Главный инженер проекта (ГИП)', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Нуржан' },
  { dept: 'ОРН', position: 'Ведущий специалист по земельным и имущественным вопросам (на Зама.)', count: 1, priority: 'высокий', status: 'Оффер', recruiter: 'Нуржан' },
  { dept: 'Али Гарант', position: 'Генеральный директор', count: 1, priority: 'высокий', status: 'Открыта', recruiter: 'Нуржан' },
  { dept: 'Ред Маркет', position: 'Заместитель руководителя по развитию retail-сети при АЗС (Red Market)', count: 1, priority: 'высокий', status: 'Оффер', recruiter: 'Нуржан' },
  { dept: 'СКП', position: 'Аналитик по автоматизации и внедрению AI-решений', count: 1, priority: 'высокий', status: 'с внутреннего резерва', recruiter: 'Нуржан' },
  { dept: 'УЧР', position: 'Рекрутер', count: 1, priority: 'высокий', status: 'оффер принят', recruiter: 'Нуржан' },
  { dept: 'КРО', position: 'Ревизор', count: 1, priority: 'высокий', status: 'Оффер', recruiter: 'Нуржан' },
  { dept: 'Маркетинг /КД', position: 'Продакт - Бизнес девелопер', count: 1, priority: 'высокий', status: 'Открыта', recruiter: 'Нуржан' },
  { dept: 'ОКП', position: 'Менеджер по оптовым продажам (Ош)', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Нуржан' },
  { dept: 'ОКП', position: 'Менеджер по оптовым продажам (Ош)', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Нуржан' },
  { dept: 'ОРН', position: 'специалист по недвижимости по югу', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Алима' },
  { dept: 'ТС', position: 'сварщик', count: 1, priority: 'средний', status: 'В подборе', recruiter: 'Алима' },
  { dept: 'ТС', position: 'механик', count: 1, priority: 'средний', status: 'В подборе', recruiter: 'Алима' },
  { dept: 'САУП', position: 'старший бухгалтер по налоговому учету', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Алима' },
  { dept: 'ОМ', position: 'оператор контакт-центра', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Алима' },
  { dept: 'ТС', position: 'Инженер-электронщик Джалал-Абад', count: 1, priority: 'высокий', status: 'оффер принят', recruiter: 'Алима' },
  { dept: 'ДИТ', position: 'IT специалист системный и сетевой администратор', count: 1, priority: 'средний', status: 'оффер принят', recruiter: 'Алима' },
  { dept: 'ОПЗИ', position: 'бухгалтер фин отчету', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Бакдоолот' },
  { dept: 'ТС', position: 'Аналитик', count: 1, priority: 'высокий', status: 'В подборе', recruiter: 'Бакдоолот' },
  { dept: 'САУП', position: 'бухгалтер по лимитам', count: 1, priority: '', status: 'оффер принят', recruiter: 'Бакдоолот' },
  { dept: 'САУП', position: 'бухгалтер НБ ЖА', count: 1, priority: '', status: 'В подборе', recruiter: 'Бакдоолот' },
  { dept: 'СЭТС', position: 'Мастер по ремонту', count: 1, priority: '', status: 'резерв', recruiter: 'Бакдоолот' },
  { dept: 'ОДТ', position: 'мастера цеха', count: 1, priority: '', status: 'Открыта', recruiter: 'Бакдоолот' },
  { dept: 'ОДТ', position: 'контрольный механик', count: 1, priority: '', status: 'резерв', recruiter: 'Бакдоолот' },
  { dept: 'СЭТС', position: 'водитель категории «Е»', count: 6, priority: '', status: 'В подборе', recruiter: 'Бакдоолот' },
  { dept: 'ОКП', position: 'водители-курьеры', count: 20, priority: '', status: 'В подборе', recruiter: 'Бакдоолот' },
  { dept: 'ОДТ', position: 'водители-курьеры', count: 50, priority: '', status: 'в подборе + на резерв', recruiter: 'Венера' },
  { dept: 'ОРП', position: 'операторы АЗС', count: 25, priority: '', status: 'резерв', recruiter: 'Аруужан' },
];

const totalCount = activeList.reduce((a, x) => a + x.count, 0);
if (totalCount !== 127) { console.error('unexpected total:', totalCount); process.exit(1); }

const updated = { ...current, activeList };

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='recruitment' AND period=${PERIOD}
`;
console.log('recruitment.activeList added for', PERIOD, '— rows:', activeList.length, 'headcount:', totalCount);
