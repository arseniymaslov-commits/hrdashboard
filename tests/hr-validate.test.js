'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateSnapshot } = require('../lib/hr-validate.js');

const OCT = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '2026-10.json'), 'utf8'));

test('реальный октябрь проходит без ошибок', () => {
  const r = validateSnapshot(OCT, '2026-10');
  assert.deepEqual(r.errors, []);
  // известные расхождения попадают в предупреждения, а не теряются
  assert.ok(r.warnings.some((w) => w.startsWith('departments_kpi_empty:')));
});

test('неизвестный блок — ошибка', () => {
  const r = validateSnapshot({ ...OCT, bogus: {} }, '2026-10');
  assert.ok(r.errors.includes('unknown_block:bogus'));
});

test('процент вне 0..100 — ошибка', () => {
  const bad = JSON.parse(JSON.stringify(OCT));
  bad.composition.turnoverRate.current = 170;
  const r = validateSnapshot(bad, '2026-10');
  assert.ok(r.errors.includes('out_of_range_0_100:composition.turnoverRate.current'));
});

test('участников теста меньше, чем оценённых — ошибка', () => {
  const bad = JSON.parse(JSON.stringify(OCT));
  bad.assessment.driverTest.oct.participants = 50;
  const r = validateSnapshot(bad, '2026-10');
  assert.ok(r.errors.some((e) => e.startsWith('driverTest_oct_judged_')));
});

test('дисциплина: по отделам больше, чем по типам — ошибка', () => {
  const bad = JSON.parse(JSON.stringify(OCT));
  bad.discipline.byType = [{ type: 'Опоздания', count: 10 }];
  const r = validateSnapshot(bad, '2026-10');
  assert.ok(r.errors.some((e) => e.startsWith('discipline_bydept_')));
});

test('неверный формат периода — ошибка', () => {
  const r = validateSnapshot(OCT, '2026-13');
  assert.ok(r.errors.includes('period_format_YYYY-MM'));
});

test('без meta.period — ошибка', () => {
  const bad = JSON.parse(JSON.stringify(OCT));
  delete bad.meta.period;
  const r = validateSnapshot(bad, '2026-10');
  assert.ok(r.errors.includes('meta.period_required'));
});
