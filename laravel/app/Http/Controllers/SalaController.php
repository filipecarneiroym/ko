<?php

namespace App\Http\Controllers;

use App\Models\Sala;
use App\Services\Elenco;
use App\Services\PartidaService;
use App\Services\RelayEndereco;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/** Salas por código: criar, entrar, a tela da luta e o resultado. */
class SalaController extends Controller
{
    public function criar(): RedirectResponse
    {
        return redirect()->route('sala.show', Sala::criarPara(Auth::user()));
    }

    public function entrar(Request $request): RedirectResponse
    {
        $request->validate(['codigo' => ['required', 'string', 'regex:/^\s*[A-Za-z0-9]{4}\s*$/']]);
        $codigo = strtoupper(trim($request->input('codigo')));
        $sala = Sala::query()->where('codigo', $codigo)->first();
        if (! $sala) {
            return back()->withInput()->withErrors(['codigo' => 'Não achei essa sala. Confira o código.']);
        }

        $jogador = Auth::user();
        if ($sala->ladoDe($jogador) === null) {
            // Só um convidado por sala: quem chega depois não toma o lugar.
            $ocupou = Sala::query()->whereKey($sala->id)->whereNull('convidado_id')->update(['convidado_id' => $jogador->id]);
            if (! $ocupou) {
                return back()->withInput()->withErrors(['codigo' => 'Essa sala já está cheia.']);
            }
        }

        return redirect()->route('sala.show', $sala);
    }

    public function show(Sala $sala): View
    {
        $lado = $sala->ladoDe(Auth::user());
        abort_if($lado === null, 403, 'Essa sala não é sua. Entre pelo código.');
        $sala->load('host', 'convidado');

        return view('jogo', ['config' => [
            'modo' => 'online',
            'sala' => $sala->codigo,
            'lado' => $lado,
            'eu' => Auth::user()->apelido,
            'host' => $sala->host->apelido,
            'convidado' => $sala->convidado?->apelido,
            'relay' => RelayEndereco::para(request()).'?'.http_build_query(['sala' => $sala->codigo, 'lado' => $lado, 't' => $sala->tokenRelay($lado)]),
            'resultado' => route('sala.resultado', $sala),
            'proxima' => $sala->partidas()->max('numero') + 1,
        ]]);
    }

    public function resultado(Request $request, Sala $sala, PartidaService $partidas): JsonResponse
    {
        $lado = $sala->ladoDe(Auth::user());
        abort_if($lado === null || $sala->convidado_id === null, 403);

        $lutadores = array_keys(Elenco::publicados());
        $dados = $request->validate([
            'numero' => ['required', 'integer', 'min:1', 'max:100000'],
            'lutador_host' => ['required', Rule::in($lutadores)],
            'lutador_convidado' => ['required', Rule::in($lutadores)],
            'cenario' => ['required', Rule::in(config('ko.cenarios'))],
            'vencedor' => ['required', Rule::in(['host', 'convidado'])],
            'rounds_host' => ['required', 'integer', 'between:0,2'],
            'rounds_convidado' => ['required', 'integer', 'between:0,2'],
        ]);
        abort_if(max($dados['rounds_host'], $dados['rounds_convidado']) !== 2, 422, 'Luta sem vencedor.');
        $vencedorCorreto = $dados['rounds_host'] > $dados['rounds_convidado'] ? 'host' : 'convidado';
        abort_if($dados['rounds_host'] === $dados['rounds_convidado'] || $dados['vencedor'] !== $vencedorCorreto, 422, 'Placar incompatível com o vencedor.');

        $partida = $partidas->registrar($sala, $lado, $dados);

        return response()->json(['valeu' => $partida->vencedor_id !== null]);
    }

    /** Treino e luta contra o computador: tudo no próprio celular, nada vai para o ranking. */
    public function local(string $modo): View
    {
        return view('jogo', ['config' => ['modo' => $modo, 'eu' => Auth::user()->apelido]]);
    }
}
