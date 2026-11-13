'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { flatten } = require('../lib/hr-flatten.js');
const { TAB_TITLES, parseCsv, snapshotFromTabs, exportUrl } = require('../lib/hr-sheets.js');

const OCT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '2026-10.json'), 'utf8'));
const q = (v) => { const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// Имитация листов: по одному CSV на блок, как отдаёт gviz (заголовок — первая строка)
function tabsAsCsv(snap, { withHeader = true } = {}) {
  const rows = flatten(snap);
  const out = {};
  for (const block of Object.keys(TAB_TITLES)) {
    const lines = withHeader ? ['Блок,Путь,Тип,Значение'] : [];
    for (const r of rows.filter((x) => x.block === block)) lines.push([r.block, r.path, r.type, r.value].map(q).join(','));
    out[block] = lines.join('\n');
  }
  return out;
}

test('парсер CSV: кавычки, запятые и переносы внутри ячеек', () => {
  const rows = parseCsv('a,"б, ""в""",г\n1,"строка\nвторая",3\n');
  assert.deepEqual(rows, [['a', 'б, "в"', 'г'], ['1', 'строка\nвторая', '3']]);
});

test('листы по блокам собираются в снимок октября без потерь', () => {
  const tabs = tabsAsCsv(OCT);
  const parsed = Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, parseCsv(v)]));
  assert.deepEqual(snapshotFromTabs(parsed), OCT);
});

test('если gviz не вывел строку заголовков, она восстанавливается', () => {
  const tabs = tabsAsCsv(OCT, { withHeader: false });
  const parsed = Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, parseCsv(v)]));
  assert.deepEqual(snapshotFromTabs(parsed), OCT);
});

test('нет одного листа — ошибка tabs_missing с названием листа', () => {
  const tabs = tabsAsCsv(OCT);
  const parsed = Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, parseCsv(v)]));
  delete parsed.budget;
  assert.throws(() => snapshotFromTabs(parsed), (e) => e.code === 'tabs_missing' && /Бюджет/.test(e.message));
});

test('ссылка экспорта содержит id таблицы и gid листа', () => {
  assert.equal(exportUrl('ABC123', 1005), 'https://docs.google.com/spreadsheets/d/ABC123/export?format=csv&gid=1005');
});
