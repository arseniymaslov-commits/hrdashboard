'use strict';

// Превращает снимок отчёта в плоские строки для таблицы и обратно.
// Строка: { block, path, type, value }
//   block — верхний ключ блока (composition, budget, ...)
//   path  — путь внутри блока через точку, индексы массивов числом: history.0.rate
//   type  — number | string | boolean | null | emptyArray | emptyObject
//   value — значение в виде текста (для таблицы), тип хранится отдельно
// Тип нужен, чтобы при чтении из таблицы «2026-10» не стало числом, а «19» — строкой.

function leafType(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return 'string';
  throw new Error('unsupported_leaf:' + typeof v);
}

function walk(value, path, out, block) {
  if (Array.isArray(value)) {
    if (value.length === 0) { out.push({ block, path, type: 'emptyArray', value: '' }); return; }
    value.forEach((item, i) => walk(item, path ? path + '.' + i : String(i), out, block));
    return;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) { out.push({ block, path, type: 'emptyObject', value: '' }); return; }
    keys.forEach((k) => walk(value[k], path ? path + '.' + k : k, out, block));
    return;
  }
  out.push({ block, path, type: leafType(value), value: value === null || value === undefined ? '' : value });
}

function flatten(snapshot) {
  const out = [];
  for (const block of Object.keys(snapshot)) {
    const v = snapshot[block];
    if (v === undefined) continue;
    // блок целиком пустой или не объект — записываем как одно значение без пути
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      walk(v, '', out, block);
    } else {
      walk(v, '', out, block);
    }
  }
  return out;
}

function setPath(root, parts, leaf) {
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (node[p] === undefined) node[p] = nextIsIndex ? [] : {};
    node = node[p];
  }
  const last = parts[parts.length - 1];
  node[last] = leaf;
}

function coerce(row) {
  switch (row.type) {
    case 'number': {
      const n = typeof row.value === 'number' ? row.value : Number(String(row.value).replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(n)) throw new Error('bad_number:' + row.block + '.' + row.path + '=' + row.value);
      return n;
    }
    case 'boolean':
      return row.value === true || String(row.value).toLowerCase() === 'true';
    case 'null': return null;
    case 'emptyArray': return [];
    case 'emptyObject': return {};
    case 'string': return row.value === undefined || row.value === null ? '' : String(row.value);
    default: throw new Error('unknown_type:' + row.type);
  }
}

// Собирает снимок обратно из строк. Порядок строк не важен; путь определяет место.
function unflatten(rows) {
  const snapshot = {};
  for (const row of rows) {
    if (!row || !row.block) continue;
    if (!snapshot[row.block]) snapshot[row.block] = {};
    const value = coerce(row);
    if (!row.path) {
      // значение на верхнем уровне блока (редко: пустой блок или массив)
      snapshot[row.block] = value;
      continue;
    }
    setPath(snapshot[row.block], row.path.split('.'), value);
  }
  return snapshot;
}

module.exports = { flatten, unflatten };

// Таблица из Google Sheets (двумерный массив, первая строка — заголовки
// «Блок, Путь, Тип, Значение») → снимок. Значения могут прийти строками
// (например, «424»), поэтому приведение идёт по столбцу «Тип».
function snapshotFromTable(values) {
  if (!Array.isArray(values) || values.length < 2) throw new Error('table_empty');
  const header = values[0].map((h) => String(h).trim());
  const idx = { block: header.indexOf('Блок'), path: header.indexOf('Путь'), type: header.indexOf('Тип'), value: header.indexOf('Значение') };
  if (Object.values(idx).some((i) => i < 0)) throw new Error('table_header_mismatch:' + header.join('|'));
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const line = values[r] || [];
    const block = String(line[idx.block] || '').trim();
    if (!block) continue; // пустые строки внизу таблицы
    rows.push({
      block,
      path: String(line[idx.path] || '').trim(),
      type: String(line[idx.type] || '').trim(),
      value: line[idx.value] === undefined ? '' : line[idx.value],
    });
  }
  return unflatten(rows);
}

module.exports.snapshotFromTable = snapshotFromTable;
