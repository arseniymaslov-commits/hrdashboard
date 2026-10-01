import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='plan' AND period=${PERIOD}`;
if (!rows.length) { console.error('no plan row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Source: "Протокол УЧР от 02.09.2026г. результаты.docx" — 8 real agenda
// items (numbered 1-7,9 in the source; no item 8) from the 02.09.2026
// HR report/planning meeting, each with its own September outcome.
const factVsPlan = [
  { item: 'Командообразование в СП (тимбилдинги)', status: 'inProgress', comment: '17 СП провели, остальным срок до 30.10' },
  { item: 'Табелирование операторов — интеграция Альфа АЗС/1С', status: 'postponed', comment: 'Отложено до доработок RedStaff (6–12 мес.)' },
  { item: 'КПЭ «Кадровая работа» для руководителей СП', status: 'done', comment: 'Внесено в КПЭ руководителей' },
  { item: 'Ревизия вакантных штатных единиц', status: 'done', comment: 'Закрыты 48 штатных единиц (в основном офис)' },
  { item: 'Проверка кадрового администрирования (СВКА)', status: 'done', comment: 'По итогам снижен КПЭ 3 спец. КА — 90%' },
  { item: 'ИПР руководителям с контрольными сроками', status: 'done', comment: 'Контрольная точка 30.10 состоялась' },
  { item: 'Перевод сотрудников на трудовые отношения (САУП/ПЭО)', status: 'inProgress', comment: 'Проведено 2 встречи, нужна консолидация данных' },
  { item: 'КПЭ-критерии САУП-бухгалтерии и Ред Маркет для ГД', status: 'done', comment: 'Письмо от 03.09.2026' },
];

const currentTasks = [
  { task: 'Завершить тимбилдинги в оставшихся СП', status: 'inProgress', deadline: '30.10', responsible: 'А. Маслов' },
  { task: 'Перевод сотрудников на трудовые отношения — выбрать вариант', status: 'inProgress', deadline: 'уточняется', responsible: 'САУП / ПЭО' },
  { task: 'Интеграция Альфа АЗС — 1С (табелирование)', status: 'postponed', deadline: '6–12 мес. (RedStaff)', responsible: 'УЧР / ДИТ' },
];

const protocolStatus = { done: 5, notDone: 0, postponed: 1, inProgress: 2 };

const updated = {
  ...current,
  factVsPlan,
  currentTasks,
  protocolStatus,
  protocolHistory: [{ month: 'Сен', ...protocolStatus }],
  conclusion: '5 из 8 протокольных поручений исполнено в срок, 2 в процессе, 1 отложено (интеграция Альфа АЗС—1С до доработок RedStaff).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='plan' AND period=${PERIOD}
`;
console.log('plan updated for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
