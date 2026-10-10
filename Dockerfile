FROM php:8.2-apache

# Instala dependências do sistema e utilitários
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    zip \
    unzip \
    git \
    && docker-php-ext-install pdo_mysql pdo_sqlite

# Instala o Composer de forma oficial dentro do contêiner
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Ativa o módulo de reescrita do Apache
RUN a2enmod rewrite

# Define a pasta pública do projeto como a raiz do servidor web
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf

# Copia todos os arquivos do seu projeto para dentro do servidor
COPY . /var/www/html

# ENTRA na pasta laravel e roda a instalação dos pacotes obrigatórios
RUN cd /var/www/html/laravel && composer install --no-dev --optimize-autoloader

# Cria a pasta do banco de dados, gera o arquivo SQLite em branco e dá as permissões corretas de escrita
RUN mkdir -p /var/www/html/laravel/database && \
    touch /var/www/html/laravel/database/database.sqlite && \
    chmod -R 777 /var/www/html/laravel/storage /var/www/html/laravel/database && \
    chown -R www-data:www-data /var/www/html/laravel

# Roda a limpeza completa de cache antes de expor o servidor
RUN cd /var/www/html/laravel && php artisan optimize:clear

# Expõe a porta padrão de internet
EXPOSE 80
