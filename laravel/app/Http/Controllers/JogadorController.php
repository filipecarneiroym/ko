<?php

namespace App\Http\Controllers;

use App\Models\Jogador;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class JogadorController extends Controller
{
    /** Tela inicial: pede o apelido na primeira vez; depois mostra o menu. */
    public function inicio(): View
    {
        return Auth::check() ? view('inicio') : view('entrar');
    }

    public function entrar(Request $request): RedirectResponse
    {
        $dados = $request->validate([
            'apelido' => ['required', 'string', 'min:2', 'max:16', 'regex:/^[\pL\pN _-]+$/u'],
        ], [
            'apelido.regex' => 'Use só letras, números, espaço, - ou _.',
        ]);
        $apelido = preg_replace('/\s+/u', ' ', trim($dados['apelido']));

        // ponytail: sem senha, um apelido já usado fica com quem chegou primeiro. Contas com senha
        // entram se alguém perder o celular e quiser o placar de volta.
        if (Jogador::query()->where('apelido', $apelido)->exists()) {
            return back()->withInput()->withErrors(['apelido' => 'Esse apelido já tem dono. Escolha outro.']);
        }

        Auth::login(Jogador::query()->create(['apelido' => $apelido]), remember: true);
        $request->session()->regenerate();

        // Veio pelo link que o amigo mandou: já cai com o código da sala preenchido.
        $sala = $request->input('sala');

        return redirect()->route('inicio', is_string($sala) && preg_match('/^[A-Z0-9]{4}$/', $sala) ? ['sala' => $sala] : []);
    }

    public function ranking(): View
    {
        return view('ranking', ['jogadores' => Jogador::query()->ranking()->limit(50)->get()]);
    }
}
