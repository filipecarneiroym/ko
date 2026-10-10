<?php

return [
    // Endereço que o navegador usa para falar com o relay da luta (ws:// no PC, wss://…/ws no ar).
    'relay_url' => env('KO_RELAY_URL', 'ws://localhost:6001'),
    // Porta local onde o `php artisan ko:relay` escuta (o Nginx encaminha /ws para ela).
    'relay_porta' => (int) env('KO_RELAY_PORTA', 6001),
    // Só o próprio servidor (Nginx) fala com o relay. Para testar com celulares na mesma Wi-Fi sem Nginx: 0.0.0.0
    'relay_host' => env('KO_RELAY_HOST', '127.0.0.1'),

    // Elenco na ordem da tela de escolha. Quem tem `pronto` => false aparece como "em breve".
    // O jeito de lutar de cada um mora em public/js/ko-sim.js; aqui fica só o que o servidor confere.
    'lutadores' => [
        'pipoca' => ['nome' => 'Pipoca', 'pronto' => true],
        'uivo' => ['nome' => 'Uivo', 'pronto' => true],
        'maromba' => ['nome' => 'Maromba', 'pronto' => true],
        'ginga' => ['nome' => 'Ginga', 'pronto' => true],
        'vo-nena' => ['nome' => 'Vó Nena', 'pronto' => true],
        'vo-tiao' => ['nome' => 'Vô Tião', 'pronto' => true],
        'kira' => ['nome' => 'Kira', 'pronto' => true],
        'toco' => ['nome' => 'Toco', 'pronto' => true],
        'nix' => ['nome' => 'Nix', 'pronto' => true],
        'eco' => ['nome' => 'Eco', 'pronto' => true],
        'volt' => ['nome' => 'Volt', 'pronto' => true],
        'kilo' => ['nome' => 'Kilo', 'pronto' => true],
        'brasa' => ['nome' => 'Brasa', 'pronto' => true],
        'mare' => ['nome' => 'Maré', 'pronto' => true],
        'truque' => ['nome' => 'Truque', 'pronto' => true],
        'fossil' => ['nome' => 'Fóssil', 'pronto' => true],
    ],

    // Cada luta acontece num lugar diferente (o dono da sala sorteia).
    'cenarios' => ['praia', 'telhado', 'floresta', 'feira', 'academia', 'neve'],
];
