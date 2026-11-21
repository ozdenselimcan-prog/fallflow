#!/bin/bash
# Kopiert Caddys Zertifikat für die Mail-Domain dorthin, wo der Mailserver (fallflow-mail) es lesen darf, und startet ihn
# neu, wenn sich etwas geändert hat. Läuft beim Deploy und täglich per /etc/cron.daily/fallflow-mail-tls (als root).
set -euo pipefail
DOMAIN="${INBOUND_MAIL_DOMAIN:-in.fallflow.eu}"
SRC=$(find /var/lib/caddy -type d -path "*certificates*/$DOMAIN" 2>/dev/null | head -n 1)
DST=/opt/fallflow/mail-tls
[ -n "$SRC" ] && [ -f "$SRC/$DOMAIN.crt" ] || { echo "Noch kein Zertifikat für $DOMAIN (DNS-Eintrag fehlt?)"; exit 0; }
mkdir -p "$DST"
if ! cmp -s "$SRC/$DOMAIN.crt" "$DST/cert.pem" 2>/dev/null; then
  install -m 600 -o fallflow -g fallflow "$SRC/$DOMAIN.crt" "$DST/cert.pem"
  install -m 600 -o fallflow -g fallflow "$SRC/$DOMAIN.key" "$DST/key.pem"
  systemctl restart fallflow-mail 2>/dev/null || true
  echo "Mail-Zertifikat für $DOMAIN aktualisiert"
fi
