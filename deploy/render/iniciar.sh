#!/bin/sh
set -eu
cd /var/www/ko/laravel
: "${APP_KEY:?Configure a APP_KEY existente no painel do Render antes de iniciar}"
# Uma porta pública atende HTTP e WebSocket; o relay fica apenas na rede interna.
sed -i 's/^Listen 80$/Listen 10000/' /etc/apache2/ports.conf
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache database
if [ -n "${DB_DATABASE:-}" ] && [ "$DB_DATABASE" != ':memory:' ]; then
    mkdir -p "$(dirname "$DB_DATABASE")"
    chown www-data:www-data "$(dirname "$DB_DATABASE")"
fi
php artisan config:clear
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/ko.conf
