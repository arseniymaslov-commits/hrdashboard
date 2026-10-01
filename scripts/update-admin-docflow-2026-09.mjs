import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='admin' AND period=${PERIOD}`;
if (!rows.length) { console.error('no admin row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Real source: Google Drive folder "делопроизводство" (user-shared
// 2026-10-01), 4 sheets:
// - "Входящий электронный журнал" (117 Sept rows) — a SHARED secretariat
//   log across the whole corporate group, not just Альфа Ойл: of 117 rows,
//   only 7 have Компания="ОсОО Альфа Ойл" (105 are "Кыргыз Нафта", the rest
//   split across 3 other group entities). Filtered to those 7.
// - "Исходящий электронный журнал" (45 Sept rows) — same pattern, but ALL
//   45 rows are "Кыргыз Нафта"; zero are Альфа Ойл, so outgoing = 0 (not
//   "no data" — genuinely zero for this entity in this log).
// - "Реестр производственных приказов" (21 rows, all Sept 2026, no
//   multi-company mixing — this register is Альфа-Ойл-specific) -> 21.
// - "Журнал регистрации приказов" (7 rows) — all "Альтранс Логистикс"
//   (a different group entity), not applicable here.
// docsByType below is ONLY these 2 real, non-zero categories — Справки/
// Договоры/Прочее are dropped rather than shown as a misleading "0"
// (there's no register for those at all, real or otherwise, for Альфа
// Ойл). A 4th sheet in the same folder, "Внутренние документы АО"
// (real: заявления о приёме/увольнении/переводе/отпуске, processed by
// Наматова Н. — matches hrEfficiency's "Специалист по КА" roster), is
// confirmed real but its full September row count couldn't be extracted
// this round (only a partial head-sample was retrievable) — intentionally
// left OUT of the numeric chart below rather than guessed at; see
// conclusion text.
const docsByType = [
  { type: 'Приказы (производственные)', count: 21 },
  { type: 'Письма (входящие)', count: 7 },
];

const updated = {
  ...current,
  docsByType,
  conclusion: 'Реальные данные по делопроизводству ОсОО «Альфа Ойл» за сентябрь: 21 производственный приказ и 7 входящих писем (исходящих писем и договоров в этих журналах для Альфа Ойл не зафиксировано — остальной объём в тех же журналах относится к другим юрлицам группы, Кыргыз Нафта и др.). Отдельный реальный журнал заявлений по кадрам (приём/увольнение/перевод/отпуск, ведёт Наматова Н.) подтверждён, но полный подсчёт за месяц из него пока не извлечён. Сроки оформления документов и просрочки по-прежнему демо-данные — дедлайны не отслеживаются ни в Red Staff, ни в этих журналах.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='admin' AND period=${PERIOD}
`;
console.log('admin.docsByType replaced with real Альфа Ойл counts for', PERIOD);
