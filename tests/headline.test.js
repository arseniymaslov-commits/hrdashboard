'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHeadline, buildCardTitle, periodCompareLabel, _internal } = require('../headline.js');

// Октябрь 2026, значения из API /api/hr/composition?period=2026-10
const OCT = {
  headcountHistory: [
    { month: 'Июль', count: 2799 }, { month: 'Август', count: 2833 },
    { month: 'Сентябрь', count: 2834 }, { month: 'Октябрь', count: 2818 },
  ],
  turnoverRate: { prev: 7.1, current: 6.5, history: [] },
  internalFillRate: { prev: 14, current: 19 },
  hrRatio: 0.7,
  structureByDept: [
    { dept: 'ОРП', count: 1399 }, { dept: 'Securi Force', count: 287 }, { dept: 'СЭТС', count: 212 },
  ],
  departmentTurnover: [
    { dept: 'ОРП', history: [
      { month: 'Апр', rate: 10.2 }, { month: 'Май', rate: 4.5 }, { month: 'Июн', rate: 7.7 },
      { month: 'Июл', rate: 9.2 }, { month: 'Авг', rate: 7.3 }, { month: 'Сен', rate: 9.2 }, { month: 'Окт', rate: 8.8 } ] },
    { dept: 'ОДТ-МАЗС', history: [
      { month: 'Апр', rate: 5.8 }, { month: 'Май', rate: 5.5 }, { month: 'Июн', rate: 8.3 },
      { month: 'Июл', rate: 7.2 }, { month: 'Авг', rate: 5.7 }, { month: 'Сен', rate: 9.9 }, { month: 'Окт', rate: 4.8 } ] },
    { dept: 'СЭТС', history: [
      { month: 'Апр', rate: 5.5 }, { month: 'Май', rate: 4.2 }, { month: 'Июн', rate: 4.3 },
      { month: 'Июл', rate: 6.3 }, { month: 'Авг', rate: 4.3 }, { month: 'Сен', rate: 7.1 }, { month: 'Окт', rate: 7.8 } ] },
  ],
};

// Копия OCT с другими значениями: рост штата, рост текучести, рост внутреннего закрытия.
function withChanges(overrides) {
  return Object.assign({}, OCT, overrides);
}

test('октябрь 2026: штат сократился, текучесть снизилась', () => {
  assert.equal(buildHeadline('composition', OCT), 'Штат сократился на 16 человек, текучесть снизилась до 6,5%');
});

test('рост штата и текучести: «вырос» и «выросла»', () => {
  const d = withChanges({
    headcountHistory: [{ month: 'Сентябрь', count: 2800 }, { month: 'Октябрь', count: 2830 }],
    turnoverRate: { prev: 6.0, current: 6.8, history: [] },
  });
  assert.equal(buildHeadline('composition', d), 'Штат вырос на 30 человек, текучесть выросла до 6,8%');
});

test('ниже порога: без существенных изменений', () => {
  const d = withChanges({
    headcountHistory: [{ month: 'Сентябрь', count: 2830 }, { month: 'Октябрь', count: 2834 }],
    turnoverRate: { prev: 6.8, current: 6.9, history: [] },
    internalFillRate: { prev: 15, current: 15.2 },
  });
  assert.equal(buildHeadline('composition', d), 'Состав компании без существенных изменений');
});

test('нет прошлого месяца: возвращается название раздела', () => {
  const d = withChanges({ headcountHistory: [{ month: 'Октябрь', count: 2818 }], turnoverRate: { current: 6.5 }, internalFillRate: { current: 19 } });
  assert.equal(buildHeadline('composition', d), 'Состав компании');
  assert.equal(buildHeadline('composition', null), 'Состав компании');
  assert.equal(buildHeadline('unknown', OCT), '');
});

test('склонение «человек» по числу', () => {
  const plural = _internal.plural;
  assert.equal(plural(1, 'человека', 'человека', 'человек'), 'человека');
  assert.equal(plural(3, 'человека', 'человека', 'человек'), 'человека');
  assert.equal(plural(5, 'человека', 'человека', 'человек'), 'человек');
  assert.equal(plural(12, 'человека', 'человека', 'человек'), 'человек');
  assert.equal(plural(21, 'человека', 'человека', 'человек'), 'человека');
});

test('длина заголовка не больше 70 знаков', () => {
  const d = withChanges({
    headcountHistory: [{ month: 'Сентябрь', count: 2834 }, { month: 'Октябрь', count: 2000 }],
    turnoverRate: { prev: 7.1, current: 12.5, history: [] },
  });
  const h = buildHeadline('composition', d);
  assert.ok(h.length <= 70, h);
  assert.equal(h, 'Штат сократился на 834 человека, текучесть выросла до 12,5%');
});

test('карточка подразделений: «Половина штата — ОРП»', () => {
  assert.equal(buildCardTitle('composition', 'structure', OCT), 'Половина штата — ОРП');
});

test('карточка подразделений: 30–45% и меньше 30%', () => {
  const d30 = withChanges({ structureByDept: [{ dept: 'ОДТ', count: 900 }] });
  assert.equal(buildCardTitle('composition', 'structure', d30), 'ОДТ — 32% штата');
  const dLow = withChanges({ structureByDept: [{ dept: 'ОДТ', count: 500 }] });
  assert.equal(buildCardTitle('composition', 'structure', dLow), 'Структура по подразделениям');
});

test('карточка текучести: «Текучесть в СЭТС растёт второй месяц подряд»', () => {
  assert.equal(buildCardTitle('composition', 'turnover', OCT), 'Текучесть в СЭТС растёт второй месяц подряд');
});

test('карточка текучести: три роста подряд — «третий месяц»; без роста — общий заголовок', () => {
  const three = withChanges({
    departmentTurnover: [{ dept: 'ОДТ', history: [
      { month: 'Авг', rate: 5 }, { month: 'Сен', rate: 6 }, { month: 'Окт', rate: 7 }, { month: 'Ноя', rate: 8 } ] }],
  });
  assert.equal(buildCardTitle('composition', 'turnover', three), 'Текучесть в ОДТ растёт третий месяц подряд');
  const none = withChanges({
    departmentTurnover: [{ dept: 'ОДТ', history: [{ month: 'Сен', rate: 6 }, { month: 'Окт', rate: 5 }] }],
  });
  assert.equal(buildCardTitle('composition', 'turnover', none), 'Текучесть по подразделениям');
});

test('подпись периода: «Октябрь 2026 · к сентябрю»', () => {
  assert.equal(periodCompareLabel({ period: 'Октябрь 2026', prevPeriod: 'Сентябрь 2026' }), 'Октябрь 2026 · к сентябрю');
  assert.equal(periodCompareLabel({ period: 'Октябрь 2026' }), 'Октябрь 2026');
  assert.equal(periodCompareLabel(null), '');
});
