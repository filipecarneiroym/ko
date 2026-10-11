# Hospedagem do K.O

Mesmo caminho da YM: um servidor Linux (Ubuntu) com Nginx + PHP-FPM, Cloudflare na frente e SQLite.
A única peça a mais é o **relay da luta** (`php artisan ko:relay`), um serviço que fica sempre ligado.

## 1. Primeira instalação

```
sudo apt install nginx php8.3-fpm php8.3-cli php8.3-sqlite3 php8.3-mbstring php8.3-xml php8.3-curl unzip sqlite3 composer
sudo mkdir -p /var/www/ko && cd /var/www/ko
# suba o zip do projeto (pastas deploy/, laravel/, public/) e extraia aqui
cd laravel
composer install --no-dev --optimize-autoloader
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate --force
```

No `.env` do servidor:

```
APP_ENV=production
APP_DEBUG=false
LOG_LEVEL=warning
SESSION_SECURE_COOKIE=true
APP_URL=https://SEUDOMINIO
KO_RELAY_URL=wss://SEUDOMINIO/ws
KO_RELAY_PORTA=6001
```

Permissões (o site roda como www-data; o banco precisa da pasta com escrita por causa do modo WAL):

```
sudo chown -R www-data:www-data /var/www/ko/laravel /var/www/ko/public
sudo chmod -R ug+rwX /var/www/ko/laravel/storage /var/www/ko/laravel/bootstrap/cache /var/www/ko/laravel/database
sudo chmod 640 /var/www/ko/laravel/.env
```

## 2. Nginx

```
sudo cp /var/www/ko/deploy/nginx-ko.conf /etc/nginx/sites-available/ko
sudo nano /etc/nginx/sites-available/ko        # troque SEUDOMINIO (e a versão do php-fpm, se não for 8.3)
sudo ln -s /etc/nginx/sites-available/ko /etc/nginx/sites-enabled/ko
sudo nginx -t && sudo systemctl reload nginx
```

O bloco `location /ws` é o que liga o navegador ao relay. Sem ele, criar sala funciona mas a luta online não começa.

HTTPS na origem (igual à YM): `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d SEUDOMINIO`
(ou o certificado de origem da Cloudflare). Na Cloudflare, SSL/TLS em **Full (strict)**.

## 3. Relay da luta (serviço)

```
sudo cp /var/www/ko/deploy/ko-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ko-relay
sudo systemctl status ko-relay                  # deve mostrar "Relay do K.O ouvindo na porta 6001"
```

O relay escuta só em `127.0.0.1:6001` (só o Nginx fala com ele); não abra essa porta no firewall.

Se a sala ficar em “Conectando”, confira o serviço acima e o bloco `/ws` do Nginx.
`KO_RELAY_URL=` vazio usa automaticamente `wss://DOMINIO-DO-SITE/ws` em HTTPS
ou `ws://IP-DO-SERVIDOR:6001` em HTTP. Um `.env` antigo com `ws://localhost:6001`
precisa ser atualizado: no celular, localhost é o próprio aparelho. Depois de alterar,
rode `php artisan config:clear` (ou `php artisan optimize` em produção).
Para testes por Wi-Fi sem Nginx, use `KO_RELAY_HOST=0.0.0.0`, execute o relay e
abra o site pelo IP do computador nos dois celulares.

## Antes de abrir para todo mundo (checklist)

- [ ] `.env` com `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `KO_RELAY_URL=wss://SEUDOMINIO/ws`
- [ ] `php artisan optimize` rodou sem erro (o `atualizar.sh` já faz)
- [ ] `https://SEUDOMINIO/up` responde 200
- [ ] `systemctl status ko-relay` ativo e o Nginx com o bloco `/ws`
- [ ] Criar sala num celular, entrar pelo código no outro e lutar até o fim (o ranking conta)
- [ ] Instalar na tela inicial (o navegador oferece "Adicionar à tela inicial") e abrir deitado
- [ ] Backup externo: `sudo bash /var/www/ko/deploy/backup-offsite.sh` funciona

## Rodar no PC e jogar com os celulares da casa (sem servidor)

No `.env`: `KO_RELAY_HOST=0.0.0.0` e `KO_RELAY_URL=ws://IP-DO-PC:6001`. Depois:
`php artisan serve --host=0.0.0.0` e `php artisan ko:relay`. Nos celulares (mesma Wi-Fi): `http://IP-DO-PC:8000`.
Sem HTTPS o app não instala na tela inicial, mas dá para jogar pelo navegador.

## 4. HTTPS e Cloudflare

- HTTPS é obrigatório para instalar o app (PWA) e para o `wss://`.
- Na Cloudflare: **Network → WebSockets: ligado** (vem ligado por padrão).
- Igual à YM, o Laravel confia no proxy (`trustProxies('*')`): deixe o firewall aceitando HTTP/HTTPS só da Cloudflare.

## 5. Atualizar

```
sudo bash /var/www/ko/deploy/atualizar.sh /caminho/do/novo.zip
```

Põe em manutenção, faz backup do `.env` e do banco em `/root/ko-backups/`, troca o código, roda as migrations
(só acrescentam), reinicia o relay e, se algo der errado, volta tudo para a versão anterior sozinho.

## 6. Backup externo (de hora em hora)

```
sudo apt install rclone && rclone config        # crie um remote chamado "kobackup" (Backblaze B2, Cloudflare R2...)
sudo cp /var/www/ko/deploy/ko-backup.service /var/www/ko/deploy/ko-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ko-backup.timer
```

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Sala fica em "Conectando…" | relay parado (`systemctl status ko-relay`) ou falta o `location /ws` no Nginx |
| "Esperando o outro celular…" toda hora | internet fraca de um dos dois; o atraso se ajusta pelo ping a cada luta |
| App não pede para instalar | site sem HTTPS |
| Erro 500 ao entrar | permissão de escrita em `storage/` ou `database/` |
