# HR-панель Ред Петролеум

Ежемесячный HR-отчёт. Статическая страница (`index.html`) + Vercel Functions
(`api/hr/`) поверх Neon Postgres — данные сохраняются на сервере и видны
всем, кто открывает отчёт.

- Прод: см. Vercel-проект `hrdashboard` (org `arseny-s-projects6`).
- Чтение (`GET /api/hr`) — открытое.
- Запись (`PUT /api/hr/:key`) — требует заголовок `X-Edit-Token`, значение
  задано в переменной окружения `EDIT_TOKEN` в Vercel.
- `scripts/seed-and-init.mjs` — разово создаёт таблицу `hr_data` и засевает
  её демо-данными; повторный запуск безопасен (upsert).

Деплой: `npx vercel --prod --yes` из этой папки (нужен `vercel link` один раз).
