import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='hrEfficiency' AND period=${PERIOD}`;
if (!rows.length) { console.error('no hrEfficiency row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Source: "План работы УЧР" Google Sheet (last edited 30.09.2026 — the
// "на август 2026" text in each tab's own title is a stale template
// label, not the actual data's freshness; same pattern seen before in
// the "Дашборд УЧР" sheet). Two sub-team tabs: АКО (Административно-
// кадровый отдел) and СУЭП (Сектор управления эффективностью персонала).
// Long source comments (esp. the ИПР survey one) summarised, not
// truncated blindly, to keep the actual numbers/dates.
const teamPlans = [
  {
    team: 'АКО (Административно-кадровый отдел)',
    progress: '0/11',
    tasks: [
      { task: 'Положение АКО', responsible: 'Н. Наматова', status: 'В работе', comment: 'В разработке, на согласование до 30.07' },
      { task: 'ДИ старшего специалиста АКО', responsible: 'Н. Наматова', status: 'В работе', comment: 'В разработке, на согласование до 30.07' },
      { task: 'Доработки по В2В совместно с ОЦП', responsible: 'А. Усенгазиева, Ю. Калугина', status: 'Исполнено', comment: 'Тестируется автоотправка документа на подпись после согласования' },
      { task: 'Сверка приказов Google Sheets ↔ B2B', responsible: 'Ю. Калугина', status: 'В работе', comment: 'Выполнено ~30%, трудоёмкая задача' },
      { task: 'Перенос реестра производственных приказов в B2B', responsible: 'А. Усенгазиева, Ю. Калугина', status: 'В работе', comment: 'Тестовый модуль — 29.09, финальный запуск ориентировочно на этой неделе' },
      { task: 'Результаты водителей СЭТС', responsible: 'Х. Тохтаева', status: 'постоянная задача', comment: 'Ежемесячное обновление данных' },
      { task: 'Согласовать ШР и орг. структуру компании', responsible: 'Н. Наматова, З. Тилибаева', status: 'новая задача', comment: 'Подготовка ШР и орг. структуры за 3-й квартал' },
      { task: 'Аудит кадрового учёта (проверка СВКА, поручение ГД)', responsible: 'Н. Наматова, З. Тилибаева, Х. Тохтаева, У. Тажибай уулу', status: 'В работе', comment: '' },
      { task: 'Оформить сокращение штатных единиц после утверждения ГД', responsible: 'Н. Наматова', status: 'новая задача', comment: '' },
      { task: 'Переподписать КПЭ всем руководителям', responsible: 'Н. Наматова, З. Тилибаева', status: 'новая задача', comment: 'После согласования соответствующего ВНД' },
      { task: 'Ежемесячный отчёт по кадровому администрированию по СП', responsible: 'Н. Наматова', status: 'постоянная задача', comment: '' },
    ],
  },
  {
    team: 'СУЭП (Сектор управления эффективностью персонала)',
    progress: '0/10',
    tasks: [
      { task: '360° самооценка по СП — повысить охват', responsible: 'В. Абдылдаева', status: 'В работе', comment: '' },
      { task: 'Методология оценки результативности по группам должностей/СП', responsible: 'В. Абдылдаева', status: 'В работе', comment: 'Протокольное поручение' },
      { task: 'Оценка среза знаний на кейсовых задачах', responsible: 'В. Абдылдаева', status: 'В работе', comment: '' },
      { task: 'План обучения новыми тренерами (УНБХ, КРО)', responsible: 'М. Кадыралиева', status: 'В работе', comment: '' },
      { task: 'Единая база оценок (срезы/аттестация/360°)', responsible: 'В. Абдылдаева', status: 'В работе', comment: 'По сотрудникам готово, по руководителям уже есть' },
      { task: 'Единая база статусов ИПР', responsible: 'М. Кадыралиева', status: 'новая задача', comment: '' },
      { task: 'Обновление базы внутреннего резерва по ИПР', responsible: 'Н. Сыпабекова', status: 'Ожидание', comment: 'Ждёт результатов ИПР' },
      { task: 'Сводная база отчётности по всем СП и секторам УЧР', responsible: 'Ж. Нурбаев', status: 'В работе', comment: '' },
      { task: 'ИПР для сотрудников по результатам оценок', responsible: 'М. Кадыралиева', status: 'новая задача', comment: 'Опрос прошли 59 чел.: нужна прокачка проф. навыков — 95%, знаний ВНД — 73%, упр. навыков — 37%, дисциплины — 15%, коммуникаций — 14%' },
      { task: 'Тестовый опросник по компетенциям ИПР для руководителей', responsible: 'М. Кадыралиева', status: 'новая задача', comment: 'Вопросы составлены и проверены, разосланы через Google Forms' },
    ],
  },
];

const updated = { ...current, teamPlans };

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='hrEfficiency' AND period=${PERIOD}
`;
console.log('hrEfficiency.teamPlans updated for', PERIOD);
