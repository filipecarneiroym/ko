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
        if (! is_string($senha) || ! hash_equals((string) config('ko.senha_amigos'), $senha)) {
            return back()->withErrors(['senha_amigos' => 'Senha incorreta. Confira as maiúsculas e o ponto.']);
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
