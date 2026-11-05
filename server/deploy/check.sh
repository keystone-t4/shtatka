#!/bin/sh
# Проверка сервиса: sh check.sh [адрес]. По умолчанию — локально на сервере.
URL=${1:-http://127.0.0.1:8787/company}
echo "1. Доступ к ЕГРЮЛ:"; curl -s -m 15 -X POST https://egrul.nalog.ru/ -d "query=7810964768" | head -c 200; echo
echo "2. Доступ к реестру МСП:"; curl -s -m 15 -X POST https://rmsp.nalog.ru/search-proc.json -d "mode=quick&page=1&pageSize=10&query=7810964768" | head -c 300; echo
echo "3. Сервис Штатки:"; curl -s -m 30 "$URL?inn=7810964768"; echo
echo "4. Неверный ИНН (ждём bad_inn):"; curl -s -m 10 "$URL?inn=1234567890"; echo
echo "5. Самозанятый (статус НПД):"; curl -s -m 60 "${URL%/company}/npd?inn=027714145906"; echo
echo "6. Вход по ЭЦП (ждём nonce и data):"; curl -s -m 10 "${URL%/company}/auth/challenge?purpose=register"; echo
