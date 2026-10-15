# Entrada e menus — 15/10/2026

Removida a senha compartilhada de acesso: middleware, controller, rota, configuração e modal antigos. A conta continua exigindo apelido e PIN, com os mesmos limites de tentativas, proteção de sessão e permissões de salas. Convites preservam o código ao entrar.

O banner do elenco foi retirado da interface. As artes dos outros personagens continuam preservadas para produção futura. A entrada e o menu usam o retrato existente da Lola, fundo da academia, contraste escuro, faixa vermelha e ação principal dourada.

Arcade, Versus CPU, Versus local e Treino aparecem como opções separadas. Salas online ficam em uma seção expansível, aberta automaticamente para convites e erros de código. O controle consegue navegar e abrir essa seção. Ranking e saída permanecem acessíveis.

Na seleção, a única lutadora disponível já aparece selecionada, com retrato central até escolher o segundo lado. Há um link explícito para voltar ao menu. A janela de configuração dos controles fica acima da seleção.

Responsividade: 320×568, 390×844, 430×932, 568×320, 844×390, 915×412 e 1280×800. Entrada e menus podem rolar verticalmente em telas baixas e com teclado; a seleção mantém a confirmação visível. Os testes verificam limites horizontais, alvos de toque de pelo menos 44 px, navegação, convite, login e saída.

Validação: PHPUnit, 43 testes e 201 asserções; JavaScript, 21 testes de controle/ritmo/direcional; navegador, sete resoluções e luta 3D real com comandos, defesa e recuperação. Capturas nesta pasta. Aprovação visual depende do teste de Filipe.
