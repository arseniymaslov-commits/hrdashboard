#!/usr/bin/env bash
# Записывает один блок отчёта в API.
# Использование: scripts/hr-put.sh <блок> <файл.json> [YYYY-MM]
# Токен читается из .env.local (строка HR_EDIT_TOKEN=...), в вывод не печатается.
# Без периода пишет в текущий (последний) месяц.
set -euo pipefail

cd "$(dirname "$0")/.."

API="https://hrdashboard-lac.vercel.app/api/hr"
KEY="${1:-}"
FILE="${2:-}"
PERIOD="${3:-}"

if [[ -z "$KEY" || -z "$FILE" ]]; then
  echo "Использование: $0 <блок> <файл.json> [YYYY-MM]" >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "Файл не найден: $FILE" >&2
  exit 1
fi
if [[ ! -f .env.local ]]; then
  echo "Нет файла .env.local. Создайте его с строкой HR_EDIT_TOKEN=..." >&2
  exit 1
fi

TOKEN="$(grep -E '^HR_EDIT_TOKEN=' .env.local | head -n1 | cut -d= -f2-)"
if [[ -z "$TOKEN" ]]; then
  echo "В .env.local нет HR_EDIT_TOKEN" >&2
  exit 1
fi

URL="$API/$KEY"
if [[ -n "$PERIOD" ]]; then
  URL="$URL?period=$PERIOD"
fi

python3 -m json.tool "$FILE" >/dev/null || { echo "Некорректный JSON: $FILE" >&2; exit 1; }

RESPONSE="$(mktemp)"
HTTP_CODE="$(curl -s -o "$RESPONSE" -w '%{http_code}' -X PUT "$URL" \
  -H 'Content-Type: application/json' \
  -H "X-Edit-Token: $TOKEN" \
  --data @"$FILE")"
rm -f "$RESPONSE"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "Записано: $KEY${PERIOD:+ за $PERIOD} (HTTP 200)"
else
  echo "Ошибка записи: HTTP $HTTP_CODE" >&2
  exit 1
fi
