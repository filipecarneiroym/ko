<?php

namespace App\Http\Controllers;

use App\Models\Jogador;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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
            'pin' => ['required', 'string', 'regex:/^[0-9]{4}$/'],
        ], [
            'apelido.regex' => 'Use só letras, números, espaço, - ou _.',
        ]);
        $apelido = preg_replace('/\s+/u', ' ', trim($dados['apelido']));

        if (mb_strlen($apelido) < 2) {
            return back()->withInput($request->only('apelido', 'sala'))->withErrors(['apelido' => 'Use pelo menos 2 caracteres no apelido.']);
        }

        $jogador = Jogador::query()->where('apelido', $apelido)->first();
        if (! $jogador) {
            // firstOrCreate recupera o dono se dois cadastros disputarem o mesmo apelido.
            $jogador = Jogador::query()->firstOrCreate(['apelido' => $apelido], ['pin_hash' => Hash::make($dados['pin'])]);
        }
        if ($jogador && $jogador->pin_hash === null) {
            return back()->withInput($request->only('apelido', 'sala'))->withErrors(['apelido' => 'Esse jogador ainda não tem PIN. Abra no navegador onde ele foi criado e cadastre o PIN no menu.']);
        }
        if ($jogador && ! Hash::check($dados['pin'], $jogador->pin_hash)) {
            return back()->withInput($request->only('apelido', 'sala'))->withErrors(['pin' => 'Apelido ou PIN incorreto.']);
        }
        Auth::login($jogador, remember: true);
        $request->session()->regenerate();

        // Veio pelo link que o amigo mandou: já cai com o código da sala preenchido.
        $sala = $request->input('sala');

        return redirect()->route('inicio', is_string($sala) && preg_match('/^[A-Z0-9]{4}$/', $sala) ? ['sala' => $sala] : []);
    }

    public function ranking(): View
    {
        return view('ranking', ['jogadores' => Jogador::query()->ranking()->limit(50)->get()]);
    }

    public function cadastrarPin(Request $request): RedirectResponse
    {
        $dados = $request->validate(['pin' => ['required', 'string', 'regex:/^[0-9]{4}$/', 'confirmed']]);
        $alterou = Jogador::query()->whereKey(Auth::id())->whereNull('pin_hash')
            ->update(['pin_hash' => Hash::make($dados['pin']), 'updated_at' => now()]);
        abort_unless($alterou, 409, 'Este jogador já tem PIN cadastrado.');

        return redirect()->route('inicio')->with('status', 'PIN cadastrado! Use seu apelido e PIN para entrar em outro aparelho.');
    }

    public function sair(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('inicio');
    }
}
