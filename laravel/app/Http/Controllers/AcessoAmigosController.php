<?php

namespace App\Http\Controllers;

use App\Http\Middleware\AcessoAmigos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AcessoAmigosController extends Controller
{
    public function desbloquear(Request $request): RedirectResponse
    {
        $senha = $request->input('senha_amigos');
        // Sem diferença de maiúsculas nem espaços nas pontas: o teclado do celular
        // costuma pôr a primeira letra em maiúscula ("Ko").
        $normalizar = fn (string $texto) => mb_strtolower(trim($texto));
        if (! is_string($senha) || ! hash_equals($normalizar((string) config('ko.senha_amigos')), $normalizar($senha))) {
            return back()->withErrors(['senha_amigos' => 'Senha incorreta.']);
        }
        $request->session()->regenerate();
        $request->session()->put('acesso_amigos', AcessoAmigos::chave());
        $destino = $request->session()->pull('amigos_destino', '/');
        if (! is_string($destino) || ! str_starts_with($destino, '/') || str_starts_with($destino, '//')) {
            $destino = '/';
        }

        return redirect($destino)->withHeaders(['Cache-Control' => 'no-store, private']);
    }
}
