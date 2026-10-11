FROM php:8.2-apache

RUN apt-get update && apt-get install -y --no-install-recommends \
    libonig-dev libsqlite3-dev libzip-dev unzip supervisor sqlite3 \
    && docker-php-ext-install pdo_sqlite mbstring zip \
    && a2enmod rewrite proxy proxy_http proxy_wstunnel headers \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/ko
COPY laravel/ laravel/
COPY public/ public/
RUN cd laravel && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
COPY deploy/render/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/render/supervisord.conf /etc/supervisor/conf.d/ko.conf
COPY deploy/render/iniciar.sh /usr/local/bin/ko-iniciar
RUN sed -i 's/\r$//' /usr/local/bin/ko-iniciar && chmod +x /usr/local/bin/ko-iniciar
ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr DB_CONNECTION=sqlite \
    SESSION_DRIVER=file CACHE_STORE=file KO_RELAY_HOST=127.0.0.1 KO_RELAY_PORTA=6001
EXPOSE 10000
CMD ["/usr/local/bin/ko-iniciar"]
