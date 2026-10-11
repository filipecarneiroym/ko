# Publicar o K.O no Render

O site publicado foi verificado: a CSP autorizava `ws://localhost:6001` e `/ws`
respondia 404 ao upgrade WebSocket. Ambos impedem as salas online.

Este Dockerfile inicia Apache e o relay com supervisão. Apache atende na porta
10000 e encaminha `/ws` ao relay interno 6001. Use uma única instância: as salas
ativas do relay ficam em memória. O Render aceita HTTP e WebSocket na mesma
porta pública: https://render.com/docs/websocket.

## Atualizar o serviço existente

1. Faça backup consistente do SQLite atual (`sqlite3 banco.sqlite ".backup backup.sqlite"`)
   e preserve a APP_KEY atual. Não substitua o banco por um vazio.
2. Inclua os arquivos atualizados no repositório conectado ao Render.
3. Use Docker com contexto na raiz e Dockerfile `./Dockerfile`.
   Deixe Docker Command vazio para usar o CMD fornecido.
4. Configure as variáveis abaixo. Remova o valor antigo de KO_RELAY_URL ou
   substitua-o pelo endereço WSS correto. Preserve APP_KEY e o banco existentes.
5. No banco existente, execute `php artisan migrate --force` para acrescentar
   `pin_hash`. Faça isso antes de liberar o novo código. Não use migrate:fresh.
   Em banco novo, crie o arquivo SQLite antes de rodar as migrations.
6. Publique. Confira os logs: Apache e `Relay do K.O ouvindo em 127.0.0.1:6001`.
7. Abra dois navegadores com jogadores diferentes. Crie sala, entre pelo código,
   confirme os lutadores, jogue e aceite uma revanche. No navegador, `/ws?...`
   deve responder 101 Switching Protocols, nunca 404. Sem token válido, o relay
   responde 403 — isso é esperado em testes manuais sem autenticação.

| Variável | Valor |
|---|---|
| APP_KEY | a chave atual do jogo, preservada |
| APP_URL | https://ko-rat6.onrender.com |
| APP_ENV | production |
| APP_DEBUG | false |
| PORT | 10000 |
| KO_RELAY_URL | wss://ko-rat6.onrender.com/ws |
| KO_RELAY_HOST | 127.0.0.1 |
| SESSION_SECURE_COOKIE | true |
| DB_CONNECTION | sqlite |
| DB_DATABASE | caminho absoluto do SQLite existente em armazenamento persistente |

Os arquivos do Render são efêmeros sem disco persistente. Para manter jogadores
e ranking, use um disco persistente e aponte DB_DATABASE para ele (por exemplo,
`/var/data/database.sqlite`, somente após copiar o banco atual). Discos exigem
serviço pago: https://render.com/docs/disks. Se você já usa outro banco, preserve
a configuração existente e adapte as extensões PHP da imagem antes de publicar.
O script de início não cria nem migra o banco automaticamente, para não trocar
silenciosamente o ranking atual por um banco vazio.

## Jogadores existentes

No navegador original, abra o menu e cadastre um PIN de exatamente 4 dígitos.
Depois use apelido e PIN no outro aparelho. O PIN antigo nunca é revelado.
Sem acesso ao navegador original, é necessária recuperação pelo administrador;
digitar o apelido sozinho não concede acesso à conta.
