'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ITEM_TABS, itemsFromTable, itemBlock } = require('../lib/hr-sheets');

const HL = ITEM_TABS.highlights;
const RS = ITEM_TABS.risks;
const DC = ITEM_TABS.decisions;

test('выводы: пример пропускается, пустые строки не попадают', () => {
  const table = [
    ['Главное за месяц — заполняет УЧР', '', ''],
    ['3–5 выводов', '', ''],
    ['№', 'Вывод (заголовок слайда)', 'Показатель', 'Текущий месяц', 'Прошлый месяц', 'План / норма', 'Отклонение', 'Что делаем', 'Ответственный', 'Срок'],
    ['Пример 1 (удалить)', 'Текучесть снизилась', 'Текучесть, %', '3,1', '3,8', '4,0', '-0,9', 'Разобрать', 'Ф И', '30.11.2026'],
    ['1', 'Принято 14 человек, это выше плана', 'Принято, чел', '14', '11', '12', '+2', 'Закрепить', 'Иванов', '30.11.2026'],
    ['2', '', '', '', '', '', '', '', '', ''],
  ];
  const items = itemsFromTable(table, HL);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].title, 'Принято 14 человек, это выше плана');
  assert.strictEqual(items[0].current, '14');
  assert.strictEqual(items[0].owner, 'Иванов');
  const block = itemBlock('highlights', items);
  assert.strictEqual(block.conclusion, 'Принято 14 человек, это выше плана');
});

test('риски: вероятность, влияние и статус, сводка по открытым', () => {
  const table = [
    ['Риски'],
    ['№', 'Риск', 'Вероятность', 'Влияние', 'Что сделано', 'Что нужно от руководства', 'Статус'],
    ['1', 'Дефицит операторов', 'Высокая', 'Высокое', 'Идут собеседования', 'Премия агентству', 'Открыт'],
    ['2', 'Старое дело', 'Низкая', 'Низкое', 'Закрыто', '', 'Закрыт'],
  ];
  const items = itemsFromTable(table, RS);
  assert.strictEqual(items.length, 2);
  const block = itemBlock('risks', items);
  assert.strictEqual(block.conclusion, 'Открытых рисков: 1, из них высоких: 1');
});

test('решения: сводка по ожидающим решения', () => {
  const table = [
    ['№', 'Решение / просьба к руководству', 'Почему нужно', 'Срок', 'Ответственный', 'Статус'],
    ['1', 'Согласовать премию', 'Закрыть вакансии', '20.11.2026', 'Ф И', 'Ждёт решения'],
    ['2', 'Утвердить бюджет', 'Старт работ', '01.12.2026', 'Ф И', 'Согласовано'],
  ];
  const items = itemsFromTable(table, DC);
  assert.strictEqual(itemBlock('decisions', items).conclusion, 'Ждут решения руководства: 1');
});

test('пустые списки дают понятные сводки', () => {
  assert.strictEqual(itemBlock('highlights', []).conclusion, 'Выводы за месяц не заполнены');
  assert.strictEqual(itemBlock('decisions', []).conclusion, 'Решений за месяц не заполнено');
});

test('нет строки заголовков — ошибка', () => {
  assert.throws(() => itemsFromTable([['x', 'y']], HL), /items_header_missing/);
});
