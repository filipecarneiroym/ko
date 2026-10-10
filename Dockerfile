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

# ENTRA na pasta laravel e roda a instalação dos pacotes obrigatórios (Corrige o erro de autoload)
RUN cd /var/www/html/laravel && composer install --no-dev --optimize-autoloader

# Cria a pasta do banco de dados, gera o arquivo SQLite em branco e dá as permissões corretas
RUN mkdir -p /var/www/html/laravel/database && \
    touch /var/www/html/laravel/database/database.sqlite && \
    chmod -R 777 /var/www/html/laravel/storage /var/www/html/laravel/database

# Define as variáveis de ambiente direto no servidor
ENV APP_ENV=production
ENV APP_DEBUG=false
ENV APP_KEY=base64:ugvDpxPzT6Slo0kL618M4WvY1KmdmK3f9o8lKjsD8j4=
ENV DB_CONNECTION=sqlite
ENV DB_DATABASE=/var/www/html/laravel/database/database.sqlite

# Expõe a porta padrão de internet
EXPOSE 80
