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

# Cria a pasta do banco de dados e gera o arquivo SQLite em branco
RUN mkdir -p /var/www/html/laravel/database && touch /var/www/html/laravel/database/database.sqlite

# Garante as permissões corretas de escrita nas pastas do Laravel
RUN chmod -R 775 /var/www/html/laravel/storage /var/www/html/laravel/bootstrap/cache /var/www/html/laravel/database

# Define o usuário do Apache (www-data) como dono dos arquivos
RUN chown -R www-data:www-data /var/www/html/laravel


# Garante que o usuário do Apache (www-data) seja o dono de todos os arquivos
RUN chown -R www-data:www-data /var/www/html/laravel


# Roda as tabelas do banco de dados e limpa os arquivos de cache de bootstrap
RUN cd /var/www/html/laravel && php artisan migrate --force && (php artisan optimize:clear || true)

# Expõe a porta padrão de internet
EXPOSE 80

# Expõe a porta padrão de internet
EXPOSE 80

# Altera as permissões ao ligar o container e inicia o Apache
CMD chown -R www-data:www-data /var/www/html/laravel/storage /var/www/html/laravel/bootstrap/cache && apache2-foreground

