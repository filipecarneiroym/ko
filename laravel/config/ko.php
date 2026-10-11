<?php

return [
    'senha_amigos' => env('KO_SENHA_AMIGOS', 'O.K'),
    // Endereço que o navegador usa para falar com o relay da luta (ws:// no PC, wss://…/ws no ar).
    'relay_url' => env('KO_RELAY_URL'),
    // Porta local onde o `php artisan ko:relay` escuta (o Nginx encaminha /ws para ela).
    'relay_porta' => (int) env('KO_RELAY_PORTA', 6001),
    // Só o próprio servidor (Nginx) fala com o relay. Para testar com celulares na mesma Wi-Fi sem Nginx: 0.0.0.0
    'relay_host' => env('KO_RELAY_HOST', '127.0.0.1'),

    // Elenco na ordem da tela de escolha. Quem tem `pronto` => false aparece como "em breve".
    // O jeito de lutar de cada um mora em public/js/ko-sim.js; aqui fica só o que o servidor confere.
    'lutadores' => [
        'pipoca' => ['nome' => 'Pipoca', 'pronto' => true, 'arte' => 'pipoca-v1.webp'],
        'uivo' => ['nome' => 'Uivo', 'pronto' => true, 'arte' => 'uivo-v1.webp'],
        'maromba' => ['nome' => 'Maromba', 'pronto' => true, 'arte' => 'maromba-v3.webp'],
        'ginga' => ['nome' => 'Ginga', 'pronto' => true, 'arte' => 'ginga-v1.webp'],
        'vo-nena' => ['nome' => 'Vó Nena', 'pronto' => true, 'arte' => 'vo-nena-v1.webp'],
        'vo-tiao' => ['nome' => 'Vô Tião', 'pronto' => true, 'arte' => 'vo-tiao-v1.webp'],
        'kira' => ['nome' => 'Kira', 'pronto' => true, 'arte' => 'kira-v1.webp'],
        'toco' => ['nome' => 'Toco', 'pronto' => true, 'arte' => 'toco-v2.webp'],
        'nix' => ['nome' => 'Nix', 'pronto' => true, 'arte' => 'nix-v1.webp'],
        'eco' => ['nome' => 'Eco', 'pronto' => true, 'arte' => 'eco-v2.webp'],
        'volt' => ['nome' => 'Volt', 'pronto' => true, 'arte' => 'volt-v2.webp'],
        'kilo' => ['nome' => 'Kilo', 'pronto' => true, 'arte' => 'kilo-v3.webp'],
        'brasa' => ['nome' => 'Brasa', 'pronto' => true, 'arte' => 'brasa-v1.webp'],
        'mare' => ['nome' => 'Maré', 'pronto' => true, 'arte' => 'mare-v2.webp'],
        'truque' => ['nome' => 'Truque', 'pronto' => true, 'arte' => 'truque-v2.webp'],
        'fossil' => ['nome' => 'Fóssil', 'pronto' => true, 'arte' => 'fossil-v3.webp'],
    ],

    // Cada luta acontece num lugar diferente (o dono da sala sorteia).
    'cenarios' => ['praia', 'telhado', 'floresta', 'feira', 'academia', 'neve'],
];
