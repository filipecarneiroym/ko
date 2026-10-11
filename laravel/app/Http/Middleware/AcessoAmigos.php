<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AcessoAmigos
{
    public static function chave(): string
    {
        return hash_hmac('sha256', (string) config('ko.senha_amigos'), (string) config('app.key'));
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (hash_equals(self::chave(), (string) $request->session()->get('acesso_amigos', ''))) {
            $response = $next($request);
        } elseif ($request->expectsJson()) {
            $response = response()->json(['message' => 'Desbloqueie o jogo para continuar.'], 403);
        } elseif ($request->isMethod('GET')) {
            $request->session()->put('amigos_destino', $request->getRequestUri());
            $response = response()->view('desbloquear', [], $request->path() === '/' ? 200 : 403);
        } else {
            $response = redirect()->route('inicio')->withErrors(['senha_amigos' => 'Desbloqueie o jogo para continuar.']);
        }
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
