'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { flatten } = require('../lib/hr-flatten.js');
const { LAYOUT, buildInputRows, parseInputRows } = require('../lib/hr-inputs.js');
const { getPathValue } = require('../lib/hr-path.js');
const { TAB_TITLES, HEADER, parseCsv, snapshotFromTabs } = require('../lib/hr-sheets.js');

const OCT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '2026-10.json'), 'utf8'));
// пустая строка и null в таблице означают одно и то же «нет значения»
const norm = (x) => JSON.parse(JSON.stringify(x, (k, v) => (v === null ? '' : v)));
const toText = (v) => (v === null || v === undefined ? '' : String(v));

// Заполняет таблицы ввода значениями из снимка — как если бы сотрудники вписали свои данные
function filledInputRows(block, snap) {
  const rows = [];
  const data = snap[block] || {};
  for (const t of LAYOUT[block] || []) {
    const v = getPathValue(data, t.path);
    if (t.kind === 'kv') {
      rows.push(['ТАБЛИЦА', t.path, 'значения', t.title]);
      rows.push(['Показатель', 'Путь', 'Значение']);
      rows.push([t.title, t.path, toText(v)]);
    } else {
      rows.push(['ТАБЛИЦА', t.path, 'список', t.title]);
      rows.push(t.columns.map((c) => c.title));
      const list = Array.isArray(v) ? v : [];
      for (const item of list) rows.push(t.columns.map((c) => toText(item[c.key] === true ? 'да' : item[c.key] === false ? 'нет' : item[c.key])));
      for (let i = 0; i < 2; i++) rows.push(t.columns.map(() => ''));
    }
  }
  return rows;
}

// Листы в виде строк: [строки ввода] + служебная строка + заголовок + служебные данные
function sheetRows(block, inputRows, snap) {
  const machine = flatten({ [block]: snap[block] }).map((r) => [r.block, r.path, r.type, toText(r.value)]);
  return [...inputRows, ['▼ Служебные данные — не редактировать'], HEADER.slice(), ...machine];
}

function assembleAll(inputsFor) {
  const tabs = {};
  for (const block of Object.keys(TAB_TITLES)) {
    tabs[block] = sheetRows(block, inputsFor(block), OCT);
  }
  return snapshotFromTabs(tabs);
}

test('buildInputRows: каждый блок имеет таблицы, и у каждого есть вывод', () => {
  for (const block of Object.keys(TAB_TITLES)) {
    const rows = buildInputRows(block);
    assert.ok(rows.length > 0, block);
    if (block !== 'meta') assert.ok(rows.some((r) => r[1] === 'conclusion'), 'conclusion in ' + block);
  }
});

test('пустые таблицы ввода: отчёт совпадает с октябрём (работают служебные строки)', () => {
  const emptyInputs = (block) => buildInputRows(block);
  assert.deepEqual(norm(assembleAll(emptyInputs)), norm(OCT));
});

test('таблицы, заполненные теми же значениями: отчёт совпадает с октябрём', () => {
  assert.deepEqual(norm(assembleAll((block) => filledInputRows(block, OCT))), norm(OCT));
});

test('изменённый показатель в таблице перекрывает служебную строку', () => {
  const snap = assembleAll((block) => {
    const rows = filledInputRows(block, OCT);
    if (block === 'composition') {
      const r = rows.find((x) => x[0] !== 'ТАБЛИЦА' && x[1] === 'turnoverRate.current');
      r[2] = '6,9';
    }
    return rows;
  });
  assert.equal(snap.composition.turnoverRate.current, 6.9);
  assert.equal(snap.composition.turnoverRate.prev, OCT.composition.turnoverRate.prev);
});

test('список в таблице заменяет список целиком', () => {
  const snap = assembleAll((block) => {
    const rows = filledInputRows(block, OCT);
    if (block === 'recruitment') {
      // оставляем одну вакансию
      const start = rows.findIndex((x) => x[1] === 'activeList') + 2;
      const end = rows.findIndex((x, i) => i > start && x[0] === 'ТАБЛИЦА');
      const first = rows[start];
      rows.splice(start, end - start, first, ['', '', '', '', '', '']);
    }
    return rows;
  });
  assert.equal(snap.recruitment.activeList.length, 1);
});

test('нечисловое значение в таблице — ошибка с адресом ячейки', () => {
  const rows = filledInputRows('composition', OCT);
  const r = rows.find((x) => x[0] !== 'ТАБЛИЦА' && x[1] === 'gender.male');
  r[2] = 'много';
  assert.throws(() => parseInputRows(rows, 'composition'), (e) => e.code === 'input_bad_number' && /gender\.male/.test(e.message));
});

test('неизвестный путь таблицы — ошибка', () => {
  const rows = [['ТАБЛИЦА', 'nope', 'список', 'x'], ['a'], ['']];
  assert.throws(() => parseInputRows(rows, 'composition'), (e) => e.code === 'input_unknown_table');
});

test('CSV листа с таблицами ввода разбирается тем же путём', () => {
  const rows = [...filledInputRows('budget', OCT), ['▼ служебные'], HEADER.slice(), ...flatten({ budget: OCT.budget }).map((r) => [r.block, r.path, r.type, toText(r.value)])];
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(',')).join('\n');
  const parsed = parseCsv(csv);
  const tabs = Object.fromEntries(Object.keys(TAB_TITLES).map((b) => [b, b === 'budget' ? parsed : sheetRows(b, filledInputRows(b, OCT), OCT)]));
  assert.deepEqual(norm(snapshotFromTabs(tabs).budget), norm(OCT.budget));
});
