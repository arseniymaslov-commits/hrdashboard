import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
const PERIOD = '2026-09';
const sql = neon(DATABASE_URL);

const rows = await sql`SELECT data FROM hr_data WHERE key='departments' AND period=${PERIOD}`;
if (!rows.length) { console.error('no departments row for', PERIOD); process.exit(1); }
const current = rows[0].data;

// Second user-clarified grouping (2026-10-01, after ДИТ=ОЦП+ОКИ+ОИБ): "ТД"
// is also an umbrella covering ОКС+ТС+ОМТС+СЭТС. Same source/method as the
// ДИТ regroup — raw per-dept rows from "Результативность задач" (task
// counts) + "Итоговый рейтинг" (interaction %), re-verified against the
// cached xlsx dump (scratchpad/dept-rating-recheck/out.json) rather than
// retyped from memory:
//   Поручений: ТД 6 + ОКС 74 + ТС 27 + ОМТС 20 + СЭТС 26 = 153
//   Выполнено: ТД 0 + ОКС 0 + ТС 3 + ОМТС 1 + СЭТС 6 = 10
//   -> Задачи % = 10/153 = 6.54%
//   Взаимодействие %: ТД has none ("нет оценки взаимодействия"); ОКС 97,
//   ТС 100, ОМТС 97.2, СЭТС 97.3 -> average of the 4 available = 97.875%
//   Средний балл = average of {Задачи%, Взаимод.%} (КПЭ% excluded — bogus
//   for everyone but УЧР, same rule as every other dept here)
const raw = [
  { dept: 'ТД', tasks: 6, done: 0 },
  { dept: 'ОКС', tasks: 74, done: 0, interaction: 97 },
  { dept: 'ТС', tasks: 27, done: 3, interaction: 100 },
  { dept: 'ОМТС', tasks: 20, done: 1, interaction: 97.2 },
  { dept: 'СЭТС', tasks: 26, done: 6, interaction: 97.3 },
];
const totalTasks = raw.reduce((a, r) => a + r.tasks, 0);
const totalDone = raw.reduce((a, r) => a + r.done, 0);
const taskPct = (totalDone / totalTasks) * 100;
const interactionVals = raw.filter((r) => r.interaction != null).map((r) => r.interaction);
const interactionPct = interactionVals.reduce((a, v) => a + v, 0) / interactionVals.length;
const avgScore = (taskPct + interactionPct) / 2;

if (totalTasks !== 153 || totalDone !== 10) { console.error('unexpected raw totals', totalTasks, totalDone); process.exit(1); }

const round1 = (n) => Math.round(n * 10) / 10;
const execution = round1(taskPct / 10);
const interaction = round1(interactionPct / 10);
const tdCombined = {
  dept: 'ТД (ОКС+ТС+ОМТС+СЭТС)',
  execution,
  interaction,
  hrWork: round1((execution + interaction) / 2),
  kpi: Math.round(avgScore),
  total: round1(avgScore / 10),
};

const updatedRows = current.rows.map((r) => (r.dept === 'ТД' ? tdCombined : r));

const updated = {
  ...current,
  rows: updatedRows,
  conclusion: 'Рейтинг — по реальному выполнению протокольных поручений и взаимодействию (файл "Итоговый рейтинг"): лидер — УЧР (100% поручений в срок), затем ОК и ОДТ. "ДИТ" и "ТД" пересчитаны как объединения (ДИТ+ОЦП+ОКИ+ОИБ и ТД+ОКС+ТС+ОМТС+СЭТС соответственно) — у обоих средняя результативность около середины рейтинга за счёт высокого взаимодействия при низком проценте задач в срок; в самом низу — АХО (бывш. ССБН, 0% выполненных поручений из найденных).',
};

await sql`
  UPDATE hr_data SET data=${JSON.stringify(updated)}::jsonb, updated_at=now()
  WHERE key='departments' AND period=${PERIOD}
`;
console.log('ТД regrouped (ОКС+ТС+ОМТС+СЭТС) for', PERIOD, '- taskPct:', taskPct.toFixed(2), 'interactionPct:', interactionPct.toFixed(2), 'avgScore:', avgScore.toFixed(2));
console.log(JSON.stringify(tdCombined, null, 2));
console.log(JSON.stringify(updatedRows, null, 2));
