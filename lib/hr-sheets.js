'use strict';

// Чтение отчёта из Google-таблицы: каждый лист — один блок отчёта (слайд или направление).
// Формат листа: строка заголовков «Блок | Путь | Тип | Значение», дальше строки показателей.
// Снимок собирается из всех листов, описанных в TAB_TITLES.
//
// Таблица читается по публичной ссылке (gviz CSV export). Таблица должна быть
// доступна «всем, у кого есть ссылка — читатель», иначе сервер её не увидит.

const { snapshotFromTable } = require('./hr-flatten');
const { parseInputRows, applyOverrides, buildInputRows } = require('./hr-inputs');

const HEADER = ['Блок', 'Путь', 'Тип', 'Значение'];

// блок отчёта → название листа в таблице (для людей; код читает листы по gid)
const TAB_TITLES = {
  meta: 'Титул',
  assessment: 'Оценка персонала',
  discipline: 'Дисциплина',
  departments: 'Отделы KPI',
  composition: 'Состав',
  proposals: 'Предложения',
  hrEfficiency: 'Эффективность HR',
  functionAnalysis: 'Функц. анализ',
  massRecruitment: 'Массовый подбор',
  uchrInteraction: 'Взаимодействие УЧР',
  admin: 'Кадровые приказы',
  plan: 'План работы',
  budget: 'Бюджет',
  recruitment: 'Рекрутинг',
};

// Минимальный CSV-парсер (RFC 4180): кавычки, переносы строк внутри ячеек, «""» как кавычка.
function parseCsv(text) {
  const src = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Таблица листа → таблица с гарантированной строкой заголовков.
// gviz может принять первую строку за заголовки и не вывести её, поэтому добавляем сами.
function normalizeTabTable(table) {
  const nonEmpty = table.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!nonEmpty.length) return null;
  if (String(nonEmpty[0][0]).trim() !== HEADER[0]) nonEmpty.unshift(HEADER.slice());
  return nonEmpty;
}

// gid листа — стабилен, даже если лист переименовали. Экспорт CSV по gid отдаёт строки как есть
// (gviz иногда принимает заголовок за данные и теряет его).
const TAB_GIDS = {
  meta: 1002, assessment: 1001, discipline: 1003, departments: 1004, composition: 1005,
  proposals: 1006, hrEfficiency: 1007, functionAnalysis: 1008, massRecruitment: 1009,
  uchrInteraction: 1010, admin: 1011, plan: 1012, budget: 1013, recruitment: 1014,
};

// Листы-списки (не блоки данных): выводы за месяц, риски, решения.
// Таблица: строка заголовков начинается с «№», дальше строки записей. Строки «Пример…» пропускаются.
// columns: префикс заголовка → поле записи. main — поле, без которого строка не считается записью.
const ITEM_TABS = {
  highlights: {
    title: 'Главное', gid: 2001, main: 'title',
    columns: { 'Вывод': 'title', 'Показатель': 'metric', 'Текущий месяц': 'current', 'Прошлый месяц': 'previous',
      'План': 'plan', 'Отклонение': 'delta', 'Что делаем': 'action', 'Ответственный': 'owner', 'Срок': 'due' },
  },
  risks: {
    title: 'Риски', gid: 2003, main: 'text',
    columns: { 'Риск': 'text', 'Вероятность': 'probability', 'Влияние': 'impact', 'Что сделано': 'done',
      'Что нужно': 'need', 'Статус': 'status' },
  },
  decisions: {
    title: 'Решения', gid: 2002, main: 'text',
    columns: { 'Решение': 'text', 'Почему': 'why', 'Срок': 'due', 'Ответственный': 'owner', 'Статус': 'status' },
  },
};

function itemsFromTable(table, tab) {
  const at = table.findIndex((r) => String((r || [])[0] || '').trim() === '№');
  if (at < 0) throw new Error('items_header_missing:' + tab.title);
  const header = table[at].map((h) => String(h || '').trim());
  const idx = {};
  for (const [prefix, field] of Object.entries(tab.columns)) {
    const i = header.findIndex((h) => h.startsWith(prefix));
    if (i < 0) throw new Error('items_column_missing:' + tab.title + ':' + prefix);
    idx[field] = i;
  }
  const items = [];
  for (const row of table.slice(at + 1)) {
    const cells = row || [];
    if (String(cells[0] || '').trim().startsWith('Пример')) continue;
    const item = {};
    for (const field of Object.keys(idx)) {
      const v = cells[idx[field]];
      item[field] = v === undefined || v === null ? '' : String(v).trim();
    }
    if (item[tab.main]) items.push(item);
  }
  return items;
}

// Блок из списка: записи и короткий вывод для слайда (заполняется по данным листа).
function itemBlock(key, items) {
  if (key === 'highlights') {
    return { items, conclusion: items.length ? items[0].title : 'Выводы за месяц не заполнены' };
  }
  if (key === 'risks') {
    const open = items.filter((x) => x.status !== 'Закрыт');
    const high = open.filter((x) => x.probability === 'Высокая' || x.impact === 'Высокое');
    return { items, conclusion: open.length ? 'Открытых рисков: ' + open.length + ', из них высоких: ' + high.length : 'Открытых рисков нет' };
  }
  const waiting = items.filter((x) => x.status === 'Ждёт решения').length;
  return { items, conclusion: waiting ? 'Ждут решения руководства: ' + waiting : items.length ? 'Все решения приняты' : 'Решений за месяц не заполнено' };
}

function exportUrl(sheetId, gid) {
  return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/export?format=csv&gid=' + encodeURIComponent(gid);
}

// Собирает снимок из уже прочитанных листов: { [блок]: таблица }.
// Пропущенный лист — ошибка: без него отчёт неполный.
function snapshotFromTabs(tabTables) {
  const snap = {};
  const missing = [];
  for (const block of Object.keys(TAB_TITLES)) {
    const table = tabTables[block];
    if (!table) { missing.push(TAB_TITLES[block]); continue; }
    // строки выше служебного заголовка «Блок» — таблицы для ввода, ниже — служебные данные
    const at = table.findIndex((r) => String((r || [])[0] || "").trim() === HEADER[0]);
    const inputRows = at < 0 ? [] : table.slice(0, at);
    const machineRows = at < 0 ? table : table.slice(at);
    const part = snapshotFromTable(normalizeTabTable(machineRows));
    Object.assign(snap, part);
    applyOverrides(snap, block, parseInputRows(inputRows, block));
  }
  if (missing.length) {
    const err = new Error('tabs_missing:' + missing.join(', '));
    err.code = 'tabs_missing';
    throw err;
  }
  // списки (Главное, Риски, Решения): если листа нет в наборе — блок не пишем
  for (const key of Object.keys(ITEM_TABS)) {
    if (!tabTables[key]) continue;
    snap[key] = itemBlock(key, itemsFromTable(tabTables[key], ITEM_TABS[key]));
  }
  return snap;
}

// Читает все листы по публичной ссылке. Возвращает снимок и список листов.
async function fetchSnapshotFromSheet(sheetId) {
  const tabTables = {};
  const jobs = [
    ...Object.keys(TAB_TITLES).map((block) => [block, TAB_GIDS[block], TAB_TITLES[block]]),
    ...Object.keys(ITEM_TABS).map((key) => [key, ITEM_TABS[key].gid, ITEM_TABS[key].title]),
  ];
  for (const [key, gid, title] of jobs) {
    const res = await fetch(exportUrl(sheetId, gid), { cache: 'no-store' });
    if (!res.ok) throw new Error('sheet_http_' + res.status + ':' + title);
    tabTables[key] = parseCsv(await res.text());
  }
  return snapshotFromTabs(tabTables);
}

module.exports = { buildInputRows, TAB_TITLES, TAB_GIDS, HEADER, ITEM_TABS, parseCsv, normalizeTabTable, itemsFromTable, itemBlock, snapshotFromTabs, fetchSnapshotFromSheet, exportUrl };
