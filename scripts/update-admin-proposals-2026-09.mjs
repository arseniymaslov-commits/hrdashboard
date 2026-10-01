import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

// admin.overdueList named 4 fictional "overdue documents" against REAL
// people's names (Т. Ибраева, Н. Сыпабекова, Б. Асылбеков, А. Мамбетакунова
// — all real УЧР staff per hrEfficiency) — an invented claim attached to
// an identifiable real person, not just generic demo filler. No real
// per-document overdue-tracking exists in the shared Delo logs (raw
// in/outgoing counts only, no status/deadline column), so cleared rather
// than guessed. statusBreakdown.overdue follows suit; docsByType and
// avgProcessingDays are left as-is (aggregate numbers, not attributed to
// anyone) pending a real source.
const adminRows = await sql`SELECT data FROM hr_data WHERE key='admin' AND period=${PERIOD}`;
if (adminRows.length) {
  const a = adminRows[0].data;
  const updatedAdmin = {
    ...a,
    overdueList: [],
    statusBreakdown: { ...a.statusBreakdown, overdue: 0, inProgress: a.statusBreakdown.inProgress + a.statusBreakdown.overdue },
    conclusion: 'Данные по срокам исполнения документов и ответственным по ним — демо, реального источника (статусы/дедлайны по приказам) в переданных материалах нет. Количество документов по типам и среднее время оформления ниже — тоже пока не из реальных данных.',
  };
  await sql`UPDATE hr_data SET data=${JSON.stringify(updatedAdmin)}::jsonb, updated_at=now() WHERE key='admin' AND period=${PERIOD}`;
  console.log('admin: cleared overdueList (was attributing fake violations to real people)');
}

// proposals.items attributed invented October recommendations to named
// people (some real, e.g. Н. Сыпабекова/А. Маслов; some not verifiably
// real) with no source document — HR's own forward-looking priorities for
// October, which only HR can actually state. Cleared rather than guessed.
const propRows = await sql`SELECT data FROM hr_data WHERE key='proposals' AND period=${PERIOD}`;
if (propRows.length) {
  const p = propRows[0].data;
  const updatedProposals = {
    ...p,
    items: [],
    notes: 'Предложения на октябрь — демо-данные, реального источника (протокол/план УЧР на октябрь) пока не было передано.',
    conclusion: 'Приоритеты следующего месяца будут внесены по итогам протокола УЧР за октябрь.',
  };
  await sql`UPDATE hr_data SET data=${JSON.stringify(updatedProposals)}::jsonb, updated_at=now() WHERE key='proposals' AND period=${PERIOD}`;
  console.log('proposals: cleared items (was attributing invented October priorities to named people)');
}
