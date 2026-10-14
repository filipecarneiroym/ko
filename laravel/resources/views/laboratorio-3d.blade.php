@extends('layouts.app')
@section('corpo', 'corpo-jogo')
@push('head')
    <link rel="stylesheet" href="/css/ko-laboratorio.css?v={{ filemtime(public_path('css/ko-laboratorio.css')) }}">
    <script src="/js/ko-sim.js?v={{ filemtime(public_path('js/ko-sim.js')) }}" defer></script>
    <script src="/js/ko-cpu.js?v={{ filemtime(public_path('js/ko-cpu.js')) }}" defer></script>
    <script src="/js/ko-laboratorio-3d.js?v={{ filemtime(public_path('js/ko-laboratorio-3d.js')) }}" defer></script>
@endpush
@section('conteudo')
<main class="laboratorio">
    <header><a href="{{ route('inicio') }}">Voltar ao menu</a><h1>Laboratório 3D</h1></header>
    <p>Prévia técnica de renderização e movimentos. Os manequins e modelos de estudo não são a arte final de Lola e Uivo.</p>
    <canvas id="arena-3d" aria-label="Prévia técnica da arena tridimensional"></canvas>
    <p id="estado-3d" role="status">Preparando renderizador…</p>
    <nav aria-label="Comandos do laboratório">
        <button type="button" data-comando="L" aria-label="Andar para a esquerda">←</button>
        <button type="button" data-comando="R" aria-label="Andar para a direita">→</button>
        <button type="button" data-comando="D">Agachar</button>
        <button type="button" data-comando="P">Soco</button>
        <button type="button" data-comando="K">Chute</button>
        <button type="button" data-comando="U">Pular</button>
        <button type="button" data-comando="D_">Defender</button>
        <button type="button" data-comando="S">Especial</button>
        <button type="button" id="reiniciar-3d">Reiniciar</button>
    </nav>
    <fieldset class="luta-3d">
        <legend>Luta 3D: Lola azul × Lola vermelha</legend>
        <label>Modo
            <select id="modo-luta">
                <option value="cpu">Contra a máquina</option>
                <option value="versus">2 jogadores</option>
            </select>
        </label>
        <label>Máquina
            <select id="nivel-maquina">
                <option value="facil">Fácil</option>
                <option value="medio" selected>Médio</option>
                <option value="dificil">Difícil</option>
            </select>
        </label>
        <label>Arena
            <select id="arena">
                <option value="academia">Academia</option>
                <option value="praia">Praia</option>
                <option value="telhado">Telhado</option>
                <option value="floresta">Floresta</option>
                <option value="feira">Feira</option>
                <option value="neve">Neve</option>
            </select>
        </label>
        <button type="button" id="iniciar-luta" aria-describedby="estado-modelos">Começar luta</button>
    </fieldset>
    <label><input id="exibir-caixas" type="checkbox"> Mostrar alcance real de corpos e golpes</label>
    <details class="importar-modelo">
        <summary>Testes técnicos com modelos provisórios</summary>
        <p id="aviso-blockouts" class="aviso-blockouts">Modelos provisórios reprovados visualmente. Use somente para revisar articulação e carregamento; o visual será substituído antes de entrar nas partidas.</p>
        <button type="button" id="testar-blockouts" aria-describedby="aviso-blockouts estado-modelos" aria-busy="false">Teste técnico de articulação</button>
        <button type="button" id="testar-guarda-pipoca" aria-describedby="aviso-blockouts estado-modelos" aria-busy="false">Ver movimentos da Lola</button>
        <p>Escolha GLB completo com esqueleto e animações. O arquivo é lido no aparelho e não é enviado ao servidor. Importar um modelo não o aprova como arte final.</p>
        <label>Lola <input type="file" accept=".glb" data-modelo="0"></label>
        <label>Uivo <input type="file" accept=".glb" data-modelo="1"></label>
        </details>
    <p id="estado-modelos" role="status" aria-live="polite">Escolha o modo e comece a luta. Lola refinada em teste; ainda não aprovada como arte final.</p>
    <p>Teclado: A/D para andar; W para pular; S para agachar; J/K para golpes; L para carregar o Focus; I para especial; E para EX; O para Super; H para Ultra. Frente + especial: Shoryuken; trás + especial: furacão. Para defender, segure para trás. No modo 2 jogadores: setas, N (soco), M (chute), vírgula (Focus) e ponto (especial). Especial + soco/chute/Focus: EX/Super/Ultra. Esta prévia não altera salas nem ranking.</p>
</main>
@endsection
