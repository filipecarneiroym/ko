<?php

return [
    'senha_amigos' => env('KO_SENHA_AMIGOS', 'ko'),
    // Endereço que o navegador usa para falar com o relay da luta (ws:// no PC, wss://…/ws no ar).
    'relay_url' => env('KO_RELAY_URL'),
    // Porta local onde o `php artisan ko:relay` escuta (o Nginx encaminha /ws para ela).
    'relay_porta' => (int) env('KO_RELAY_PORTA', 6001),
    // Só o próprio servidor (Nginx) fala com o relay. Para testar com celulares na mesma Wi-Fi sem Nginx: 0.0.0.0
    'relay_host' => env('KO_RELAY_HOST', '127.0.0.1'),

    // Só entram na escolha os personagens com `pronto` => true e os dois modelos 3D.
    // Ao finalizar o próximo personagem, cadastre `modelos3d` [lado 0, lado 1] e habilite `pronto`.
    // Artes e regras dos demais ficam preservadas para a produção de cada modelo.
    'lutadores' => [
        'pipoca' => [
            'nome' => 'Lola', 'pronto' => true, 'arte' => 'pipoca-v1.webp',
            'modelos3d' => ['/modelos/estudos/pipoca-v5-azul.glb', '/modelos/estudos/pipoca-v5-vermelha.glb'],
        ],
        'uivo' => ['nome' => 'Uivo', 'pronto' => false, 'arte' => 'uivo-v1.webp'],
        'maromba' => ['nome' => 'Maromba', 'pronto' => false, 'arte' => 'maromba-v3.webp'],
        'ginga' => ['nome' => 'Ginga', 'pronto' => false, 'arte' => 'ginga-v1.webp'],
        'vo-nena' => ['nome' => 'Vó Nena', 'pronto' => false, 'arte' => 'vo-nena-v1.webp'],
        'vo-tiao' => ['nome' => 'Vô Tião', 'pronto' => false, 'arte' => 'vo-tiao-v1.webp'],
        'kira' => ['nome' => 'Kira', 'pronto' => false, 'arte' => 'kira-v1.webp'],
        'toco' => ['nome' => 'Toco', 'pronto' => false, 'arte' => 'toco-v2.webp'],
        'nix' => ['nome' => 'Nix', 'pronto' => false, 'arte' => 'nix-v1.webp'],
        'eco' => ['nome' => 'Eco', 'pronto' => false, 'arte' => 'eco-v2.webp'],
        'volt' => ['nome' => 'Volt', 'pronto' => false, 'arte' => 'volt-v2.webp'],
        'kilo' => ['nome' => 'Kilo', 'pronto' => false, 'arte' => 'kilo-v3.webp'],
        'brasa' => ['nome' => 'Brasa', 'pronto' => false, 'arte' => 'brasa-v1.webp'],
        'mare' => ['nome' => 'Maré', 'pronto' => false, 'arte' => 'mare-v2.webp'],
        'truque' => ['nome' => 'Truque', 'pronto' => false, 'arte' => 'truque-v2.webp'],
        'fossil' => ['nome' => 'Fóssil', 'pronto' => false, 'arte' => 'fossil-v3.webp'],
    ],

    // Cada luta acontece num lugar diferente (o dono da sala sorteia).
    'cenarios' => ['praia', 'telhado', 'floresta', 'feira', 'academia', 'neve'],
];
