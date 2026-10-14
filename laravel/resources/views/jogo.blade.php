@extends('layouts.app', ['titulo' => isset($config['sala']) ? 'Sala '.$config['sala'].' — K.O' : 'K.O'])

@section('corpo', 'corpo-jogo')

@push('head')
    {{-- JSON_HEX_TAG: nada no conteúdo consegue fechar o <script> antes da hora. --}}
    <script type="application/json" id="ko-config">{!! json_encode($config + [
        'lutadores' => App\Services\Elenco::publicados(),
        'cenarios' => config('ko.cenarios'),
        'inicio' => route('inicio'),
    ], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}</script>
    <script src="/js/ko-sim.js?v={{ filemtime(public_path('js/ko-sim.js')) }}" defer></script>
    <script src="/js/ko-arte.js?v={{ filemtime(public_path('js/ko-arte.js')) }}" defer></script>
    <script src="/js/ko-voz.js?v={{ filemtime(public_path('js/ko-voz.js')) }}" defer></script>
    <script src="/js/ko-audio.js?v={{ filemtime(public_path('js/ko-audio.js')) }}" defer></script>
    <script src="/js/ko-cpu.js?v={{ filemtime(public_path('js/ko-cpu.js')) }}" defer></script>
    {{-- A luta aguarda os gráficos 3D; uma falha oferece nova tentativa. --}}
    <script src="/js/ko-jogo-3d.js?v={{ filemtime(public_path('js/ko-jogo-3d.js')) }}" defer></script>
    <script src="/js/ko.js?v={{ filemtime(public_path('js/ko.js')) }}" defer></script>
@endpush

@section('conteudo')
<div id="jogo" class="jogo">
    <canvas id="tela-3d" aria-hidden="true"></canvas>
    <canvas id="tela" width="384" height="216" aria-label="Arena da luta"></canvas>
    <div id="controles" class="controles" hidden>
        {{-- Direcional em cruz e quatro botões em losango, como nos controles clássicos. --}}
        <div class="direcional" id="direcional" data-dir="">
            <span class="seta seta-c"></span><span class="seta seta-cd"></span><span class="seta seta-d"></span><span class="seta seta-bd"></span><span class="seta seta-b"></span><span class="seta seta-be"></span><span class="seta seta-e"></span><span class="seta seta-ce"></span>
            <span class="analogico" aria-hidden="true"></span>
        </div>
        <div class="botoes">
            <button type="button" data-b="S" class="b b-especial" aria-label="Especial (SP)">SP</button>
            <button type="button" data-b="P" class="b b-soco" aria-label="Soco (P)">P</button>
            <button type="button" data-b="B" class="b b-foco" aria-label="Focus (F)">F</button>
            <button type="button" data-b="K" class="b b-chute" aria-label="Chute (K)">K</button>
        </div>
        <svg class="icone-controle" viewBox="0 0 64 40" aria-hidden="true"><path d="M14 4h36c7 0 12 6 13 14l1 10c1 7-6 11-11 6l-6-6H17l-6 6c-5 5-12 1-11-6l1-10C2 10 7 4 14 4z" fill="#0008" stroke="#ff3b30" stroke-width="3"/><path d="M13 15h4v-4h4v4h4v4h-4v4h-4v-4h-4z" fill="#ff3b30"/><circle cx="44" cy="14" r="2.6" fill="#ff3b30"/><circle cx="50" cy="19" r="2.6" fill="#ff3b30"/><circle cx="38" cy="19" r="2.6" fill="#ff3b30"/><circle cx="44" cy="24" r="2.6" fill="#ff3b30"/></svg>
        <button type="button" class="pausa" id="pausa" aria-label="Menu">❚❚</button>
    </div>
    <div id="painel" class="painel"></div>
</div>
<div class="gire"><div class="gire-celular" aria-hidden="true"></div><p>Gire o celular para lutar</p><a class="botao botao-sec" href="{{ route('inicio') }}">Voltar ao menu</a></div>
@endsection
