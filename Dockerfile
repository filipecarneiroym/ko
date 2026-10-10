# Roda a limpeza completa de cache antes de expor o servidor
RUN cd /var/www/html/laravel && php artisan optimize:clear

# Expõe a porta padrão de internet
EXPOSE 80
