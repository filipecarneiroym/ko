<?php

namespace App\Services;

use Illuminate\Http\Request;

class RelayEndereco
{
    public static function para(Request $request): string
    {
        $configurado = config('ko.relay_url');
        if (is_string($configurado) && $configurado !== '') {
            return $configurado;
        }

        // localhost no celular aponta para o próprio celular, não para o servidor do jogo.
        if ($request->secure()) {
            return 'wss://'.$request->getHttpHost().'/ws';
        }

        $host = $request->getHost();
        if (str_contains($host, ':') && ! str_starts_with($host, '[')) {
            $host = '['.$host.']';
        }

        return 'ws://'.$host.':'.config('ko.relay_porta');
    }
}
