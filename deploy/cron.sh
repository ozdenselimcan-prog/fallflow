#!/bin/sh
# Ruft den Mail-Abruf / die Erinnerungen lokal auf (ersetzt Vercel Cron). Läuft per crontab alle 2 Minuten.
. /opt/fallflow/.env
curl -fsS -m 280 -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/follow-ups > /dev/null 2>> /opt/fallflow/cron.log
