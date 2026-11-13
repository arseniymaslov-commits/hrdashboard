'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { flatten } = require('../lib/hr-flatten.js');
const { LAYOUT, MARK, PATH_COL, WIDTH, buildInputRows, parseInputRows } = require('../lib/hr-inputs.js');
const { getPathValue } = require('../lib/hr-path.js');
const { TAB_TITLES, HEADER, parseCsv, snapshotFromTabs } = require('../lib/hr-sheets.js');

const OCT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '2026-10.json'), 'utf8'));
const toText = (v) => (v === null || v === undefined ? '' : String(v));
// пустая строка и null означают одно и то же «нет значения»
const norm = (x) => JSON.parse(JSON.stringify(x, (k, v) => (v === null ? '' : v)));
const pad = (cells) => { const r = cells.slice(); while (r.length < WIDTH) r.push(''); return r; };

// Таблицы ввода, заполненные значениями из снимка — как если бы сотрудники вписали свои данные
function filledInputRows(block, snap) {
  const rows = [];
  const data = snap[block] || {};
  const specs = LAYOUT[block] || [];
  const kvs = specs.filter((t) => t.kind === 'kv');
  if (kvs.length) {
    rows.push(pad([MARK + 'Показатели']));
    rows.push(pad(['Показатель', 'Значение']));
    for (const t of kvs) {
      const r = pad([t.title, toText(getPathValue(data, t.path))]);
      r[PATH_COL] = t.path;
      rows.push(r);
    }
  }
  for (const t of specs.filter((x) => x.kind === 'list')) {
    const m = pad([MARK + t.title]); m[PATH_COL] = t.path; rows.push(m);
    rows.push(pad(t.columns.map((c) => c.title)));
    const list = Array.isArray(getPathValue(data, t.path)) ? getPathValue(data, t.path) : [];
    for (const item of list) rows.push(pad(t.columns.map((c) => toText(item[c.key] === true ? 'да' : item[c.key] === false ? 'нет' : item[c.key]))));
    rows.push(pad([]));
  }
  return rows;
}

// Лист: [область ввода] + служебная строка + заголовок + служебные данные
function sheetRows(block, inputRows, snap) {
  const machine = flatten({ [block]: snap[block] }).map((r) => [r.block, r.path, r.type, toText(r.value)]);
  return [...inputRows, HEADER.slice(), ...machine];
}

function assembleAll(inputsFor) {
  const tabs = {};
  for (const block of Object.keys(TAB_TITLES)) tabs[block] = sheetRows(block, inputsFor(block), OCT);
  return snapshotFromTabs(tabs);
}

test('buildInputRows: каждый блок имеет показатели, и у каждого есть вывод', () => {
  for (const block of Object.keys(TAB_TITLES)) {
    const rows = buildInputRows(block);
    assert.ok(rows.every((r) => r.length === WIDTH), block + ' width');
    if (block !== 'meta') assert.ok(rows.some((r) => r[PATH_COL] === 'conclusion'), 'conclusion in ' + block);
  }
});

test('пустые таблицы ввода: отчёт совпадает с октябрём', () => {
  assert.deepEqual(norm(assembleAll((block) => buildInputRows(block))), norm(OCT));
});

test('таблицы, заполненные теми же значениями: отчёт совпадает с октябрём', () => {
  assert.deepEqual(norm(assembleAll((block) => filledInputRows(block, OCT))), norm(OCT));
});

test('изменённый показатель перекрывает служебную строку', () => {
  const snap = assembleAll((block) => {
    const rows = filledInputRows(block, OCT);
    if (block === 'composition') {
      const r = rows.find((x) => x[PATH_COL] === 'turnoverRate.current');
      r[1] = '6,9';
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
      const start = rows.findIndex((x) => x[PATH_COL] === 'activeList') + 2;
      const end = rows.findIndex((x, i) => i > start && String(x[0]).startsWith(MARK));
      rows.splice(start, end - start, pad(['Алматы', '1', 'Открыта', 'Механик', 'высокий', 'Н. Наматова']));
    }
    return rows;
  });
  assert.equal(snap.recruitment.activeList.length, 1);
  assert.equal(snap.recruitment.activeList[0].dept, 'Алматы');
});

test('нечисловое значение — ошибка с адресом ячейки', () => {
  const rows = filledInputRows('composition', OCT);
  const r = rows.find((x) => x[PATH_COL] === 'gender.male');
  r[1] = 'много';
  assert.throws(() => parseInputRows(rows, 'composition'), (e) => e.code === 'input_bad_number' && /gender\.male/.test(e.message));
});

test('неизвестный путь таблицы — ошибка', () => {
  const m = pad([MARK + 'x']); m[PATH_COL] = 'nope';
  assert.throws(() => parseInputRows([m, pad(['a']), pad([])], 'composition'), (e) => e.code === 'input_unknown_table');
});

test('служебная строка «▼» не попадает в список как данные', () => {
  const rows = filledInputRows('discipline', OCT);
  rows.push(pad(['▼ Служебные данные — не редактировать']));
  const parsed = parseInputRows(rows, 'discipline');
  assert.deepEqual(norm(parsed.find((p) => p.path === 'recent').value), norm(OCT.discipline.recent));
});

test('CSV листа с областью ввода разбирается тем же путём', () => {
  const rows = [...filledInputRows('budget', OCT), HEADER.slice(), ...flatten({ budget: OCT.budget }).map((r) => [r.block, r.path, r.type, toText(r.value)])];
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(',')).join('\n');
  const parsed = parseCsv(csv);
  const tabs = Object.fromEntries(Object.keys(TAB_TITLES).map((b) => [b, b === 'budget' ? parsed : sheetRows(b, filledInputRows(b, OCT), OCT)]));
  assert.deepEqual(norm(snapshotFromTabs(tabs).budget), norm(OCT.budget));
});
