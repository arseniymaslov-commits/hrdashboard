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
  return snap;
}

// Читает все листы по публичной ссылке. Возвращает снимок и список листов.
async function fetchSnapshotFromSheet(sheetId) {
  const tabTables = {};
  for (const block of Object.keys(TAB_TITLES)) {
    const url = exportUrl(sheetId, TAB_GIDS[block]);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('sheet_http_' + res.status + ':' + TAB_TITLES[block]);
    tabTables[block] = parseCsv(await res.text());
  }
  return snapshotFromTabs(tabTables);
}

module.exports = { buildInputRows, TAB_TITLES, TAB_GIDS, HEADER, parseCsv, normalizeTabTable, snapshotFromTabs, fetchSnapshotFromSheet, exportUrl };
