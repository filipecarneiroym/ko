# Atualização para GitHub e Render

## Conteúdo desta versão

Entrada privada com senha `O.K`, apelido e PIN de quatro dígitos; controles por toque e dois gamepads locais; CPU fácil/médio/difícil; ajustes de salas e reconexão; fundo com as 18 artes atuais; primeira melhoria dos impactos de golpes e defesa. O motor ainda tem 16 lutadores jogáveis: Forja e Bórun são conceitos visuais. Esta versão não contém os modelos e animações 3D planejados para a etapa premium.

## Enviar pelo terminal na raiz

Se alterar arquivos em `src/3d/`, preparar e conferir o bundle antes do Git. O bundle já gerado acompanha o projeto; o Render não precisa de Node/npm:

```powershell
npm ci
npm run build:3d
npm run verificar:build-3d
npm run verificar:3d
```

O último comando confere referências e tempos, mas informa que a produção dos modelos finais ainda está pendente. O laboratório autenticado `/laboratorio/3d` é técnico e separado do jogo principal. Não confundir os manequins ou as folhas de referência com lutadores 3D prontos.

```powershell
git add .
git diff --cached --stat
git commit -m "Melhorias de acesso, salas, controles e visual do K.O"
git push origin main
```

O push pode iniciar deploy automático. `.gitignore` exclui `.env`, bancos SQLite, sessões, dependências e arquivos locais de teste. Não adicionar arquivos ignorados à força.

## Render

O serviço precisa executar o relay junto com o site e encaminhar `/ws`. Os arquivos em `deploy/render/` e o Dockerfile da raiz fazem essa configuração. Se o serviço atual não usa esse Dockerfile, apenas enviar ao GitHub não configura o relay. Consulte `deploy/render/README.md`.

Preservar APP_KEY. Configurar APP_URL para o endereço publicado, APP_DEBUG=false, SESSION_SECURE_COOKIE=true e KO_RELAY_URL=wss://ko-rat6.onrender.com/ws. A senha compartilhada pode ser configurada por KO_SENHA_AMIGOS=O.K.

Esta versão acrescenta `pin_hash` ao banco. Após disponibilizar o código novo no serviço e antes de liberar o jogo, executar no terminal **do Render**, na pasta Laravel:

```sh
cd /var/www/ko/laravel
php artisan migrate --force
php artisan optimize:clear
php artisan view:cache
php artisan ko:verificar-publicacao
```

Esse caminho corresponde ao Dockerfile fornecido. Não executar `migrate:fresh`, pois apagaria também as contas. O script Docker não cria nem migra bancos automaticamente. DB_DATABASE deve apontar para o banco usado pelo serviço. Sem disco persistente, atualizações podem perder dados; o usuário autorizou zerar o ranking de teste, não perder contas silenciosamente.

## Conferência após publicar

Abrir em dois aparelhos com apelidos diferentes, desbloquear com O.K, criar sala, entrar pelo código, escolher lutadores, completar partida e testar revanche. Confirmar `/up` e conexão WebSocket `/ws` com resposta 101 no navegador. Validar em Safari/iPhone, Chrome/Android e no aparelho ligado à TV com dois controles.

## Limites atuais

A revisão de luta está registrada em `art/premium/REVISAO-COMBATE.md`: timbres próprios de especiais/Super, impactos, tela de vitória com artes atuais e primeiro cenário ilustrado na academia. `ko:verificar-publicacao` é diagnóstico sem alterações no banco; ele não substitui testar a conexão pública `/ws`.

Testes locais de navegador não comprovam desempenho em aparelhos reais. O balanceamento ainda está em revisão: 2160 partidas automatizadas apontaram diferenças entre estilos. Docker não foi executado neste Windows. Não declarar equivalência gráfica a Street Fighter IV nem ausência total de bugs com base nesta versão.
