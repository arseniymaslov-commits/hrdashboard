'use strict';

// Установка значения по пути вида «a.b.0.c». Создаёт вложенные объекты и массивы
// (если следующий сегмент — число).
function setPathValue(root, dotted, value) {
  const parts = String(dotted).split('.');
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    if (node[p] === undefined || node[p] === null) node[p] = nextIsIndex ? [] : {};
    node = node[p];
  }
  node[parts[parts.length - 1]] = value;
  return root;
}

function getPathValue(root, dotted) {
  return String(dotted).split('.').reduce((n, p) => (n === undefined || n === null ? undefined : n[p]), root);
}

module.exports = { setPathValue, getPathValue };
