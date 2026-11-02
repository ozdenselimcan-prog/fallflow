#!/bin/bash
# FallFlow auf den Hetzner-Server bringen: aktuellen Git-Stand hochladen, dort bauen, umschalten, neu starten.
# Aufruf: bash deploy/deploy.sh   (SSH-Host "fallflow" muss in ~/.ssh/config stehen)
set -euo pipefail
REL=$(date +%Y%m%d%H%M%S)
echo "Lade Release $REL hoch ..."
git archive --format=tar HEAD | ssh fallflow "mkdir -p /opt/fallflow/releases/$REL && tar -x -C /opt/fallflow/releases/$REL"
ssh fallflow "bash -s" <<REMOTE
set -euo pipefail
cd /opt/fallflow/releases/$REL
cp deploy/fallflow.service /etc/systemd/system/fallflow.service
cp deploy/Caddyfile /etc/caddy/Caddyfile
install -m 755 deploy/cron.sh /opt/fallflow/cron.sh
ln -sf /opt/fallflow/.env .env
chown -R fallflow:fallflow /opt/fallflow/releases/$REL
sudo -u fallflow -H bash -c 'set -a; . /opt/fallflow/.env; set +a; npm ci --no-audit --no-fund --loglevel=error && NODE_OPTIONS=--max-old-space-size=3072 npm run build'
ln -sfn /opt/fallflow/releases/$REL /opt/fallflow/current
systemctl daemon-reload
systemctl enable --now fallflow >/dev/null 2>&1 || true
systemctl restart fallflow
systemctl reload caddy || systemctl restart caddy
( crontab -u fallflow -l 2>/dev/null | grep -v cron.sh; echo "*/2 * * * * /opt/fallflow/cron.sh" ) | crontab -u fallflow -
cd /opt/fallflow/releases && ls -1t | tail -n +4 | xargs -r rm -rf
sleep 6; curl -fsS -o /dev/null -w "Lokal: HTTP %{http_code}\n" http://127.0.0.1:3000/ || echo "Start fehlgeschlagen: journalctl -u fallflow"
REMOTE
