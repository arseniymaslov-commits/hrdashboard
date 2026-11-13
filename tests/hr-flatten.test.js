'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { flatten, unflatten } = require('../lib/hr-flatten.js');

const OCT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '2026-10.json'), 'utf8'));

test('снимок октября переживает круг flatten → unflatten без потерь', () => {
  const rows = flatten(OCT);
  const back = unflatten(rows);
  assert.deepEqual(back, OCT);
});

test('строки содержат блок, путь и тип', () => {
  const rows = flatten({ turnoverRate: { current: 6.5, history: [{ month: 'Окт', rate: 6.5 }] } });
  assert.deepEqual(rows, [
    { block: 'turnoverRate', path: 'current', type: 'number', value: 6.5 },
    { block: 'turnoverRate', path: 'history.0.month', type: 'string', value: 'Окт' },
    { block: 'turnoverRate', path: 'history.0.rate', type: 'number', value: 6.5 },
  ]);
});

test('строка «2026-10» остаётся строкой, а «19» из текста становится числом только если тип number', () => {
  const back = unflatten([
    { block: 'meta', path: 'period', type: 'string', value: '2026-10' },
    { block: 'x', path: 'n', type: 'number', value: '19' },
  ]);
  assert.equal(back.meta.period, '2026-10');
  assert.equal(back.x.n, 19);
});

test('пустые массив, объект и null сохраняются', () => {
  const src = { a: { list: [], obj: {}, nothing: null } };
  assert.deepEqual(unflatten(flatten(src)), src);
});

test('битое число — ошибка, а не тихий ноль', () => {
  assert.throws(() => unflatten([{ block: 'x', path: 'n', type: 'number', value: 'abc' }]), /bad_number/);
});

test('таблица в виде строк (как отдаёт Sheets) собирается обратно в снимок октября', () => {
  const { snapshotFromTable } = require('../lib/hr-flatten.js');
  const toText = (v) => (v === null || v === undefined ? '' : String(v));
  const table = [['Блок', 'Путь', 'Тип', 'Значение'], ...flatten(OCT).map((r) => [r.block, r.path, r.type, toText(r.value)])];
  assert.deepEqual(snapshotFromTable(table), OCT);
});

test('таблица с чужими заголовками — ошибка', () => {
  const { snapshotFromTable } = require('../lib/hr-flatten.js');
  assert.throws(() => snapshotFromTable([['A', 'B'], ['x', 'y']]), /table_header_mismatch/);
});
