'use strict';

// Таблицы для ввода сотрудников (вариант «надстройка»).
// Над служебными строками каждого листа лежат таблицы, которые заполняют люди.
// Пустая таблица не меняет данные: тогда работают служебные строки.
// Заполненная таблица полностью заменяет свой путь (список) или значение (показатель).
//
// Формат таблицы на листе:
//   строка-маркер: [ТАБЛИЦА, путь, список|значения, название]
//   строка заголовков: для списка — названия колонок; для значений — [Показатель, Путь, Значение]
//   строки данных; таблица заканчивается перед следующим маркером или служебным блоком.

const { setPathValue } = require('./hr-path');


// Раскладка таблиц по блокам. kv — значения по одному пути, list — список объектов.
const LAYOUT = {
  meta: [
    { kind: 'kv', path: 'period', title: 'Период', type: 'str' },
    { kind: 'kv', path: 'company', title: 'Компания', type: 'str' },
    { kind: 'kv', path: 'prevPeriod', title: 'Предыдущий период', type: 'str' },
  ],
  recruitment: [
    { kind: 'kv', path: 'reserve.inReserve', title: 'В резерве, чел', type: 'num' },
    { kind: 'kv', path: 'reserve.readyToAssign', title: 'Готовы к назначению, чел', type: 'num' },
    { kind: 'kv', path: 'reserve.assignedFromReserve', title: 'Назначено из резерва, чел', type: 'num' },
    { kind: 'kv', path: 'reserve.closedFromReservePct', title: 'Закрыто из резерва, %', type: 'num' },
    { kind: 'kv', path: 'adaptation.total', title: 'Адаптация: всего', type: 'num' },
    { kind: 'kv', path: 'adaptation.passed', title: 'Адаптация: успешно', type: 'num' },
    { kind: 'kv', path: 'adaptation.failed', title: 'Адаптация: сорвались', type: 'num' },
    { kind: 'kv', path: 'adaptation.inProgress', title: 'Адаптация: в процессе', type: 'num' },
    { kind: 'kv', path: 'avgTimeToHire.current', title: 'Срок закрытия (текущий), дн', type: 'num' },
    { kind: 'kv', path: 'avgTimeToHire.prev', title: 'Срок закрытия (прошлый), дн', type: 'num' },
    { kind: 'list', path: 'activeList', title: 'Открытые вакансии', columns: [
      { key: 'dept', title: 'Отдел', type: 'str' }, { key: 'count', title: 'Количество', type: 'num' },
      { key: 'status', title: 'Статус', type: 'str' }, { key: 'position', title: 'Должность', type: 'str' },
      { key: 'priority', title: 'Приоритет', type: 'str' }, { key: 'recruiter', title: 'Рекрутер', type: 'str' } ] },
    { kind: 'list', path: 'byDept', title: 'Вакансии по отделам', columns: [
      { key: 'dept', title: 'Отдел', type: 'str' }, { key: 'open', title: 'Открыто', type: 'num' },
      { key: 'avgDays', title: 'Средний срок, дн', type: 'num' }, { key: 'closeDays', title: 'Срок закрытия, дн', type: 'num' } ] },
  ],
  budget: [
    { kind: 'list', path: 'byLine', title: 'Статьи бюджета', columns: [
      { key: 'line', title: 'Статья', type: 'str' }, { key: 'plan', title: 'План', type: 'num' },
      { key: 'fact', title: 'Факт', type: 'num' }, { key: 'nextPlan', title: 'План на след. месяц', type: 'num' },
      { key: 'note', title: 'Комментарий', type: 'str' } ] },
  ],
  admin: [
    { kind: 'list', path: 'byCompany', title: 'Кадровые приказы по компаниям', columns: [
      { key: 'company', title: 'Компания', type: 'str' }, { key: 'men', title: 'Мужчины', type: 'num' },
      { key: 'women', title: 'Женщины', type: 'num' }, { key: 'hires', title: 'Приём', type: 'num' },
      { key: 'fires', title: 'Увольнение', type: 'num' }, { key: 'leave', title: 'Отпуск', type: 'num' },
      { key: 'transfer', title: 'Перевод', type: 'num' }, { key: 'penalty', title: 'Взыскания', type: 'num' } ] },
    { kind: 'list', path: 'headcount', title: 'Численность по месяцам', columns: [
      { key: 'month', title: 'Месяц', type: 'str' }, { key: 'male', title: 'Мужчины', type: 'num' },
      { key: 'female', title: 'Женщины', type: 'num' }, { key: 'total', title: 'Всего', type: 'num' } ] },
  ],
  composition: [
    { kind: 'kv', path: 'gender.male', title: 'Мужчины, чел', type: 'num' },
    { kind: 'kv', path: 'gender.female', title: 'Женщины, чел', type: 'num' },
    { kind: 'kv', path: 'hired', title: 'Принято, чел', type: 'num' },
    { kind: 'kv', path: 'fired', title: 'Уволено, чел', type: 'num' },
    { kind: 'kv', path: 'turnoverRate.current', title: 'Текучесть % (текущий)', type: 'num' },
    { kind: 'kv', path: 'turnoverRate.prev', title: 'Текучесть % (прошлый)', type: 'num' },
    { kind: 'kv', path: 'internalFillRate.current', title: 'Внутреннее закрытие % (текущий)', type: 'num' },
    { kind: 'kv', path: 'internalFillRate.prev', title: 'Внутреннее закрытие % (прошлый)', type: 'num' },
    { kind: 'list', path: 'headcountHistory', title: 'Численность по месяцам', columns: [
      { key: 'month', title: 'Месяц', type: 'str' }, { key: 'count', title: 'Численность', type: 'num' } ] },
    { kind: 'list', path: 'structureByDept', title: 'Структура по подразделениям', columns: [
      { key: 'dept', title: 'Подразделение', type: 'str' }, { key: 'count', title: 'Численность', type: 'num' } ] },
  ],
  discipline: [
    { kind: 'kv', path: 'totalViolations.current', title: 'Нарушений (текущий)', type: 'num' },
    { kind: 'kv', path: 'totalViolations.prev', title: 'Нарушений (прошлый)', type: 'num' },
    { kind: 'list', path: 'byDept', title: 'Нарушения по подразделениям', columns: [
      { key: 'dept', title: 'Подразделение', type: 'str' }, { key: 'count', title: 'Количество', type: 'num' } ] },
    { kind: 'list', path: 'byType', title: 'Нарушения по типам', columns: [
      { key: 'type', title: 'Тип', type: 'str' }, { key: 'count', title: 'Количество', type: 'num' } ] },
    { kind: 'list', path: 'recent', title: 'Последние случаи', columns: [
      { key: 'date', title: 'Дата', type: 'str' }, { key: 'dept', title: 'Подразделение', type: 'str' },
      { key: 'type', title: 'Тип', type: 'str' }, { key: 'status', title: 'Статус', type: 'str' },
      { key: 'employee', title: 'Сотрудник', type: 'str' }, { key: 'severity', title: 'Важность', type: 'str' } ] },
  ],
  departments: [
    { kind: 'list', path: 'rows', title: 'KPI подразделений', columns: [
      { key: 'dept', title: 'Подразделение', type: 'str' }, { key: 'kpi', title: 'KPI, %', type: 'num' },
      { key: 'total', title: 'Итог', type: 'num' }, { key: 'hrWork', title: 'Работа с HR', type: 'num' },
      { key: 'execution', title: 'Исполнение', type: 'num' }, { key: 'components', title: 'Компоненты', type: 'num' },
      { key: 'evaluations', title: 'Оценки', type: 'num' }, { key: 'interaction', title: 'Взаимодействие', type: 'num' } ] },
  ],
  assessment: [
    { kind: 'kv', path: 'avgScore.current', title: 'Средний балл (текущий), %', type: 'num' },
    { kind: 'kv', path: 'avgScore.prev', title: 'Средний балл (прошлый), %', type: 'num' },
    { kind: 'list', path: 'movers', title: 'Самые заметные изменения', columns: [
      { key: 'name', title: 'Сотрудник', type: 'str' }, { key: 'delta', title: 'Изменение', type: 'num' },
      { key: 'position', title: 'Должность', type: 'str' }, { key: 'direction', title: 'Направление (up/down)', type: 'str' } ] },
  ],
  plan: [
    { kind: 'list', path: 'factVsPlan', title: 'Протокольные поручения', columns: [
      { key: 'item', title: 'Пункт', type: 'str' }, { key: 'status', title: 'Статус', type: 'str' },
      { key: 'comment', title: 'Комментарий', type: 'str' } ] },
    { kind: 'list', path: 'currentTasks', title: 'Текущие задачи', columns: [
      { key: 'task', title: 'Задача', type: 'str' }, { key: 'status', title: 'Статус', type: 'str' },
      { key: 'deadline', title: 'Срок', type: 'str' }, { key: 'responsible', title: 'Ответственный', type: 'str' } ] },
    { kind: 'list', path: 'nextPlan', title: 'План на следующий месяц', columns: [
      { key: 'item', title: 'Пункт', type: 'str' }, { key: 'description', title: 'Описание', type: 'str' } ] },
  ],
  hrEfficiency: [
    { kind: 'list', path: 'staff', title: 'Эффективность сотрудников', columns: [
      { key: 'name', title: 'Сотрудник', type: 'str' }, { key: 'position', title: 'Должность', type: 'str' },
      { key: 'functions', title: 'Функции', type: 'str' }, { key: 'kpiPct', title: 'KPI, %', type: 'num' },
      { key: 'violation', title: 'Нарушение', type: 'str' }, { key: 'isBestThisMonth', title: 'Лучший в месяце (да/нет)', type: 'bool' } ] },
  ],
  functionAnalysis: [
    { kind: 'list', path: 'groups', title: 'Функциональный анализ по группам', columns: [
      { key: 'group', title: 'Группа', type: 'str' }, { key: 'units', title: 'Единиц', type: 'num' },
      { key: 'vit', title: 'Жизненно важные', type: 'num' }, { key: 'sup', title: 'Поддерживают систему', type: 'num' },
      { key: 'pot', title: 'Потенциал к сокращению', type: 'num' }, { key: 'uncl', title: 'Требуют уточнения', type: 'num' } ] },
    { kind: 'kv', path: 'totals.units', title: 'Всего единиц', type: 'num' },
    { kind: 'kv', path: 'totals.positions', title: 'Всего должностей', type: 'num' },
    { kind: 'kv', path: 'totals.fullPct', title: 'Заполнено полностью, %', type: 'num' },
    { kind: 'kv', path: 'totals.departments', title: 'Подразделений', type: 'num' },
  ],
  massRecruitment: [
    { kind: 'list', path: 'byDept', title: 'Массовый подбор по подразделениям', columns: [
      { key: 'dept', title: 'Подразделение', type: 'str' }, { key: 'vacancies', title: 'Вакансий', type: 'num' },
      { key: 'responses', title: 'Откликов', type: 'num' }, { key: 'contacted', title: 'Связались', type: 'num' },
      { key: 'documents', title: 'Документы', type: 'num' }, { key: 'sent', title: 'Направлено', type: 'num' },
      { key: 'hired', title: 'Оформлено', type: 'num' } ] },
  ],
  uchrInteraction: [
    { kind: 'kv', path: 'uchr.avg', title: 'Средний балл взаимодействия', type: 'num' },
    { kind: 'kv', path: 'uchr.count', title: 'Оценок', type: 'num' },
    { kind: 'kv', path: 'uchr.total', title: 'Всего', type: 'num' },
    { kind: 'kv', path: 'uchr.delta', title: 'Изменение', type: 'num' },
    { kind: 'kv', path: 'uchr.notEvaluated', title: 'Не оценено', type: 'num' },
    { kind: 'list', path: 'company.violations', title: 'Нарушения сроков и обратной связи', columns: [
      { key: 'type', title: 'Тип', type: 'str' }, { key: 'count', title: 'Количество', type: 'num' } ] },
  ],
  proposals: [
    { kind: 'list', path: 'items', title: 'Предложения', columns: [
      { key: 'proposal', title: 'Предложение', type: 'str' }, { key: 'direction', title: 'Направление', type: 'str' },
      { key: 'status', title: 'Статус', type: 'str' }, { key: 'priority', title: 'Приоритет', type: 'str' },
      { key: 'responsible', title: 'Ответственный', type: 'str' }, { key: 'image', title: 'Изображение', type: 'str' } ] },
  ],
};

// У каждого блока (кроме титула) есть строка «Вывод по слайду».
for (const block of Object.keys(LAYOUT)) {
  if (block === 'meta') continue;
  LAYOUT[block].push({ kind: 'kv', path: 'conclusion', title: 'Вывод по слайду', type: 'str' });
}

function specFor(block, path) {
  return (LAYOUT[block] || []).find((t) => t.path === path) || null;
}

// Формат листа (вариант 1): видимые колонки A–H, путь в скрытой колонке L.
// Маркер таблицы: в колонке A «■ название», в колонке L путь (для «Показатели» — пусто).
// Строки показателей: A — название, B — значение, L — путь.
// Служебный блок начинается со строки «▼ …» и заканчивает область ввода.
const MARK = '■ ';
const SERVICE_MARK = '▼';
const PATH_COL = 11;
const WIDTH = 12;
const KV_SECTION_TITLE = 'Показатели';

function padRow(cells) {
  const r = cells.slice();
  while (r.length < WIDTH) r.push('');
  return r;
}

// Строки таблиц для листа (то, что видят сотрудники).
const EMPTY_LIST_ROWS = 3;
function buildInputRows(block) {
  const specs = LAYOUT[block] || [];
  const rows = [];
  const kvs = specs.filter((t) => t.kind === 'kv');
  if (kvs.length) {
    rows.push(padRow([MARK + KV_SECTION_TITLE]));
    rows.push(padRow(['Показатель', 'Значение']));
    for (const t of kvs) {
      const r = padRow([t.title]);
      r[PATH_COL] = t.path;
      rows.push(r);
    }
  }
  for (const t of specs.filter((x) => x.kind === 'list')) {
    const marker = padRow([MARK + t.title]);
    marker[PATH_COL] = t.path;
    rows.push(marker);
    rows.push(padRow(t.columns.map((c) => c.title)));
    for (let i = 0; i < EMPTY_LIST_ROWS; i++) rows.push(padRow([]));
  }
  rows.push(padRow([SERVICE_MARK + ' Служебные данные — не редактировать']));
  return rows;
}

function parseNum(raw, where) {
  const s = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) {
    const err = new Error('input_bad_number:' + where + '=' + raw);
    err.code = 'input_bad_number';
    throw err;
  }
  return n;
}

function parseBool(raw) {
  const s = String(raw).trim().toLowerCase();
  return s === 'да' || s === 'true' || s === '1';
}

function isBlank(row) {
  return !row || row.every((c) => String(c === undefined ? '' : c).trim() === '');
}

function cell(row, i) {
  return row && row[i] !== undefined ? row[i] : '';
}

function isMarker(row) {
  return String(cell(row, 0)).trim().startsWith(MARK.trim());
}

function isServiceStart(row) {
  return String(cell(row, 0)).trim().startsWith(SERVICE_MARK);
}

// Разбирает строки над служебным блоком одного листа в список переопределений:
// [{ path, kind:'list'|'kv', value }]. Пустые таблицы не возвращаются.
function parseInputRows(rows, block) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    if (isServiceStart(row)) break;
    if (!isMarker(row)) { i++; continue; }
    const isKvSection = String(cell(row, PATH_COL)).trim() === '';
    // тело таблицы: до следующего маркера или служебного блока
    let j = i + 2;
    const body = [];
    while (j < rows.length && !isMarker(rows[j]) && !isServiceStart(rows[j])) { body.push({ row: rows[j] || [], idx: j + 1 }); j++; }

    if (isKvSection) {
      for (const { row: r, idx } of body) {
        if (isBlank(r)) continue;
        const path = String(cell(r, PATH_COL)).trim();
        if (!path) continue;
        const spec = specFor(block, path);
        if (!spec || spec.kind !== 'kv') {
          const err = new Error('input_unknown_table:' + block + '.' + path);
          err.code = 'input_unknown_table';
          throw err;
        }
        const val = cell(r, 1);
        if (String(val).trim() === '') continue;
        out.push({ path, kind: 'kv', type: spec.type, value: spec.type === 'num' ? parseNum(val, block + '.' + path + '@' + idx) : String(val).trim() });
      }
    } else {
      const path = String(cell(row, PATH_COL)).trim();
      const spec = specFor(block, path);
      if (!spec || spec.kind !== 'list') {
        const err = new Error('input_unknown_table:' + block + '.' + path);
        err.code = 'input_unknown_table';
        throw err;
      }
      const items = [];
      for (const { row: r, idx } of body) {
        if (isBlank(r)) continue;
        const obj = {};
        spec.columns.forEach((c, ci) => {
          const raw = cell(r, ci);
          const where = block + '.' + spec.path + '@' + idx;
          if (String(raw).trim() === '') { obj[c.key] = c.type === 'num' ? null : c.type === 'bool' ? false : ''; return; }
          obj[c.key] = c.type === 'num' ? parseNum(raw, where) : c.type === 'bool' ? parseBool(raw) : String(raw).trim();
        });
        items.push(obj);
      }
      if (items.length) out.push({ path: spec.path, kind: 'list', value: items });
    }
    i = j;
  }
  return out;
}

// Накладывает переопределения на снимок блока (не трогая остальные пути).
function applyOverrides(snapshot, block, overrides) {
  if (!overrides.length) return snapshot;
  const target = snapshot[block] || {};
  for (const o of overrides) setPathValue(target, o.path, o.value);
  snapshot[block] = target;
  return snapshot;
}

module.exports = { LAYOUT, MARK, PATH_COL, WIDTH, buildInputRows, parseInputRows, applyOverrides, specFor };
