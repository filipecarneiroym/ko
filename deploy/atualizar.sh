#!/bin/bash
# ATUALIZAÇÃO AUTOMÁTICA DO K.O (mesmo molde da YM)
#
# Como usar (depois de subir o zip novo pro servidor, em qualquer pasta):
#   sudo bash deploy/atualizar.sh /caminho/para/o/novo.zip
#
# O que faz:
#  1. Extrai e confere o zip novo (o jogo continua no ar)
#  2. Põe em manutenção e faz backup do .env e do banco (jogadores, partidas, ranking)
#  3. Troca o código e devolve .env e banco no lugar
#  4. Atualiza a estrutura do banco (migrate: só acrescenta, nunca apaga o ranking)
#  5. Limpa cache, ajusta permissões e reinicia o relay da luta
# Se algo falhar depois da troca, código e banco antigos voltam sozinhos.

set -e

ZIP="$1"
if [ -z "$ZIP" ] || [ ! -f "$ZIP" ]; then
    echo "❌ Uso: sudo bash deploy/atualizar.sh /caminho/para/o/novo.zip"
    exit 1
fi

RAIZ="/var/www/ko"
LARAVEL="$RAIZ/laravel"
PUBLIC="$RAIZ/public"
TMP="/root/ko-deploy-tmp"
BACKUP="/root/ko-backups/$(date +%Y%m%d-%H%M%S)"

echo "1) Extraindo e conferindo o projeto novo..."
rm -rf "$TMP"; mkdir -p "$TMP"
unzip -q "$ZIP" -d "$TMP"
if [ ! -f "$TMP/laravel/artisan" ] || [ ! -f "$TMP/public/index.php" ]; then
    echo "❌ O zip precisa ter as pastas laravel/ e public/. Nada foi alterado."
    exit 1
fi

TROCOU=0
SUCESSO=0
finalizar() {
    if [ "$SUCESSO" -ne 1 ] && [ "$TROCOU" -eq 1 ]; then
        echo "❌ Algo falhou — voltando a versão anterior (código e banco)..."
        rm -rf "$LARAVEL" "$PUBLIC"
        mv "$LARAVEL.old" "$LARAVEL"
        mv "$PUBLIC.old" "$PUBLIC"
        systemctl restart ko-relay 2>/dev/null || true
        echo "   Jogo de volta na versão anterior. Backup em: $BACKUP"
    fi
    php "$LARAVEL/artisan" up >/dev/null 2>&1 || true
}
trap finalizar EXIT
trap 'exit 1' HUP INT TERM

echo "2) Manutenção + backup..."
php "$LARAVEL/artisan" down --retry=30
mkdir -p "$BACKUP"
cp "$LARAVEL/.env" "$BACKUP/.env"
# .backup do sqlite3 copia certo mesmo com o banco aberto (modo WAL).
sqlite3 "$LARAVEL/database/database.sqlite" ".backup '$BACKUP/database.sqlite'" 2>/dev/null \
    || cp "$LARAVEL/database/database.sqlite" "$BACKUP/database.sqlite"
ls -1dt /root/ko-backups/[0-9]*-[0-9]*/ 2>/dev/null | tail -n +11 | xargs -r rm -rf

echo "3) Trocando o código..."
rm -rf "$LARAVEL.old" "$PUBLIC.old"
mv "$LARAVEL" "$LARAVEL.old"
mv "$PUBLIC" "$PUBLIC.old"
TROCOU=1
mv "$TMP/laravel" "$LARAVEL"
mv "$TMP/public" "$PUBLIC"
cp "$BACKUP/.env" "$LARAVEL/.env"
cp "$BACKUP/database.sqlite" "$LARAVEL/database/database.sqlite"
mkdir -p "$LARAVEL/storage/framework/cache/data" "$LARAVEL/storage/framework/sessions" "$LARAVEL/storage/framework/views" "$LARAVEL/storage/logs" "$LARAVEL/bootstrap/cache"
cp -a "$LARAVEL.old/storage/framework/down" "$LARAVEL.old/storage/framework/maintenance.php" "$LARAVEL/storage/framework/" 2>/dev/null || true
cp -a "$LARAVEL.old/storage/logs/." "$LARAVEL/storage/logs/" 2>/dev/null || true
# Sessões: sem isso todo mundo teria que digitar o apelido de novo.
cp -a "$LARAVEL.old/storage/framework/sessions/." "$LARAVEL/storage/framework/sessions/" 2>/dev/null || true
[ -d "$LARAVEL/vendor" ] || cp -a "$LARAVEL.old/vendor" "$LARAVEL/vendor"

echo "4) Dependências e banco..."
cd "$LARAVEL"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan optimize:clear
php artisan optimize

SUCESSO=1
if [ -f "$TMP/deploy/atualizar.sh" ]; then
    rm -rf "$RAIZ/deploy.old"; mv "$RAIZ/deploy" "$RAIZ/deploy.old" 2>/dev/null || true
    mv "$TMP/deploy" "$RAIZ/deploy"; rm -rf "$RAIZ/deploy.old"
fi
rm -rf "$LARAVEL.old" "$PUBLIC.old" "$TMP"

# O servidor para de anunciar a versão do PHP (X-Powered-By) em cada resposta.
for INI in /etc/php/*/fpm/conf.d; do printf 'expose_php = Off\n' > "$INI/99-ko.ini"; done
systemctl reload 'php*-fpm' 2>/dev/null || true

echo "5) Permissões e relay..."
chown -R www-data:www-data "$LARAVEL" "$PUBLIC"
find "$LARAVEL" "$PUBLIC" -type d -exec chmod 755 {} +
find "$LARAVEL" "$PUBLIC" -type f -exec chmod 644 {} +
chmod -R ug+rwX "$LARAVEL/storage" "$LARAVEL/bootstrap/cache" "$LARAVEL/database"
chmod 640 "$LARAVEL/.env"
php artisan up
systemctl restart ko-relay 2>/dev/null || true

echo "✅ K.O atualizado! Backup em: $BACKUP"
