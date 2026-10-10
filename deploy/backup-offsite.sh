#!/bin/bash
# BACKUP EXTERNO DO K.O — empacota .env + banco e envia para fora do servidor (rclone).
# Roda sozinho pelo ko-backup.timer; manual: sudo bash deploy/backup-offsite.sh
# Pré-requisito: `rclone config` com um remote chamado como RCLONE_REMOTE (ver 2-HOSPEDAGEM.md).

set -e

LARAVEL="/var/www/ko/laravel"
RCLONE_REMOTE="kobackup"
RCLONE_BUCKET="ko-backups-offsite"
DIAS_RETENCAO_LOCAL=3
DIAS_RETENCAO_REMOTO=30

CARIMBO=$(date +%Y%m%d-%H%M%S)
PASTA="/root/ko-backups/offsite/$CARIMBO"
ARQUIVO="/root/ko-backups/offsite/backup-$CARIMBO.tar.gz"

mkdir -p "$PASTA"
cp "$LARAVEL/.env" "$PASTA/.env"
sqlite3 "$LARAVEL/database/database.sqlite" ".backup '$PASTA/database.sqlite'"
tar -czf "$ARQUIVO" -C "$PASTA" .
rm -rf "$PASTA"

rclone copy "$ARQUIVO" "$RCLONE_REMOTE:$RCLONE_BUCKET/"
find /root/ko-backups/offsite -name "backup-*.tar.gz" -mtime +$DIAS_RETENCAO_LOCAL -delete
rclone delete "$RCLONE_REMOTE:$RCLONE_BUCKET/" --min-age "${DIAS_RETENCAO_REMOTO}d" 2>/dev/null || true

echo "✅ Backup externo concluído: $ARQUIVO"
