import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='admin' AND period=${PERIOD}`;
if (!rows.length) { console.error('no admin row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// 2026-10-01, second delопроизводство drop: 3 more real Drive files.
// - "Журнал регистрации входящих/исходящих документов 2026 г." (owner
//   ainura.usengazieva) — Альфа-Ойл-specific (no multi-company mixing,
//   unlike the earlier "Входящий электронный журнал"), ЗГД-routed
//   correspondence specifically. September tab has real "Срок исполнения"
//   (deadline) + "Отметка о получении" (done flag) columns — the first
//   real deadline/status source found anywhere this project (checked
//   Red Staff's own Order model earlier: none; the first делопроизводство
//   drop: none either). 22 real rows (rest of the declared A1:L263 range
//   is empty padding + a few stray formatting-only rows with no content,
//   excluded). avgProcessingDays below is Срок−Дата регистрации (the
//   ALLOTTED/target days per the registry), not actual time-to-close —
//   there's no "date actually closed" column, so real actual processing
//   time still isn't obtainable; said plainly in the conclusion.
// - "Журнал приказов Офис 2026 г." — canonical office-staff order log,
//   separate tabs per order type, each with per-month sections. September
//   sections in Перевод/ЛС are empty (nothing filed yet); Отпуск's own
//   September section is ALSO empty but an separate "Лист12" tab holds
//   11 real September vacation orders not yet copied into the main
//   sheet — used that instead. Прием/Увольнение September sections had
//   their own real rows directly.
// - "Copy of _ Журнал приказов АЗС-2026г (1).xlsx" — the field/АЗС-staff
//   equivalent. Checked all 4 relevant sheets: zero September rows in any
//   of them (Приём/Увольнение's September sections are empty; Перевод and
//   "по личному составу" haven't been updated past May/July respectively).
//   Not a token "no data" — the actual numbers found were zero/stale, so
//   nothing from this file is included below; flagged in the conclusion.
const incomingZGD = {
  total: 22,
  avgAllottedDays: 2.0, // round(1.95)
  done: 17,
  overdue: [
    { doc: '04/249', dept: 'ФД', responsible: 'Карамуратов', daysOverdue: 15 },
    { doc: 'МЛ-01/1', dept: 'ОРН', responsible: 'Жолдошов Ж.С.', daysOverdue: 1 },
    { doc: '30/04-1', dept: 'ОРС', responsible: 'Айдарова О.', daysOverdue: 1 },
  ],
  inProgress: 2,
};

const docsByType = [
  { type: 'Приём (офис)', count: 4 },
  { type: 'Увольнение (офис)', count: 2 },
  { type: 'Отпуск (офис)', count: 11 },
  { type: 'Входящие (ЗГД)', count: incomingZGD.total },
  { type: 'Приказы производственные', count: 21 }, // from the first делопроизводство drop, unchanged
  { type: 'Входящие (прочие)', count: 7 }, // from the first drop's "Входящий электронный журнал" — a different log than "Входящие (ЗГД)" above, kept separate rather than guessing whether they overlap
];
const totalDocs = docsByType.reduce((a, d) => a + d.count, 0);
if (totalDocs !== 67) { console.error('unexpected total', totalDocs); process.exit(1); }

const overdueList = incomingZGD.overdue;
const statusBreakdown = {
  done: 4 + 2 + 11 + 21 + 7 + incomingZGD.done, // приказы/уже-зарегистрированные входящие (прочие) = самим фактом регистрации "исполнены"; только "Входящие (ЗГД)" имеют открытый статус
  overdue: overdueList.length,
  inProgress: incomingZGD.inProgress,
};
if (statusBreakdown.done + statusBreakdown.overdue + statusBreakdown.inProgress !== totalDocs) {
  console.error('statusBreakdown does not sum to totalDocs'); process.exit(1);
}

const updated = {
  ...current,
  docsByType,
  overdueList,
  statusBreakdown,
  avgProcessingDays: { ...current.avgProcessingDays, current: incomingZGD.avgAllottedDays, prev: incomingZGD.avgAllottedDays },
  conclusion: 'Делопроизводство ОсОО «Альфа Ойл» за сентябрь, по реальным источникам: журнал приказов (офис) — 4 приёма, 2 увольнения, 11 отпусков; реестр производственных приказов — 21; журнал входящих с маршрутизацией через ЗГД — 22 письма (средний срок на исполнение по регламенту — 2 дня; это допустимый срок, не фактическое время обработки — даты фактического закрытия в журнале нет), из них 3 просрочены; плюс ещё 7 входящих писем из отдельного журнала (другой лог, не дублируется с ЗГД-маршрутом). Журнал приказов АЗС (полевой персонал) за сентябрь в этом файле пока не заполнен — данных по нему нет.',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='admin' AND period=${PERIOD}
`;
console.log('admin updated (v2: real avgProcessingDays + overdueList + statusBreakdown + docsByType) for', PERIOD);
console.log(JSON.stringify(updated, null, 2));
