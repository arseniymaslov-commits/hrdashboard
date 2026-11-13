'use strict';

// Запись снимка периода в hr_data одной транзакцией. Общая для импорта и синхронизации.
const { BLOCK_KEYS } = require('./hr-validate');

// sql — клиент Neon (neon(DATABASE_URL)). Возвращает список записанных блоков.
async function writeSnapshot(sql, period, snapshot) {
  const keys = Object.keys(snapshot).filter((k) => BLOCK_KEYS.includes(k));
  const queries = keys.map((k) => {
    const json = JSON.stringify(snapshot[k]);
    return sql`
      INSERT INTO hr_data (key, period, data, updated_at)
      VALUES (${k}, ${period}, ${json}::jsonb, now())
      ON CONFLICT (key, period) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `;
  });
  await sql.transaction(queries);
  return keys;
}

module.exports = { writeSnapshot };
