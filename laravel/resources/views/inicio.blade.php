@extends('layouts.app')

@section('conteudo')
@php($eu = auth()->user())
<main class="portal portal-menu">
    <section class="portal-hero" aria-labelledby="marca">
        <p class="sobretitulo">ESCOLHA SEU DESAFIO</p>
        <h1 class="logo" id="marca" aria-label="K.O">K<span>.</span>O</h1>
        <p class="hero-frase">A arena<br>é sua.</p>
        <div class="hero-lola"><img src="/personagens/pipoca-3d-retrato.png" alt="Lola em posição de luta" width="640" height="800"><span>LOLA <small>PRONTA PARA LUTAR</small></span></div>
        <p class="hero-rodape">1 × 1 <span>TOQUE OU CONTROLE</span></p>
    </section>
    <section class="portal-conteudo">
        <header class="menu-cabecalho"><div><p class="sobretitulo">JOGADOR CONECTADO</p><h2>{{ $eu->apelido }}</h2></div><span class="placar">{{ $eu->vitorias }}V · {{ $eu->derrotas }}D</span></header>
        @if (session('status'))<p class="recado" role="status">{{ session('status') }}</p>@endif
        @if ($eu->pin_hash === null)
        <form method="post" action="{{ route('conta.pin') }}" class="cartao">
            @csrf
            <label for="pin">Proteja seu jogador com um PIN de 4 dígitos</label>
            <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required placeholder="Novo PIN">
            <label for="pin_confirmation">Repita o PIN</label>
            <input id="pin_confirmation" name="pin_confirmation" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required placeholder="Repita o PIN">
            @error('pin')<p class="erro" role="alert">{{ $message }}</p>@enderror
            <button class="botao">Salvar PIN</button>
        </form>
        @endif
        <nav class="modos-jogo" aria-label="Modos de jogo">
            <a class="modo modo-principal" href="{{ route('jogar.local', 'arcade') }}"><span class="modo-numero" aria-hidden="true">01</span><span><b>Arcade</b><small>Uma sequência de desafios. Um campeão.</small></span><span aria-hidden="true">↗</span></a>
            <a class="modo" href="{{ route('jogar.local', 'cpu') }}"><span class="modo-numero" aria-hidden="true">02</span><span><b>Versus CPU</b><small>Escolha o nível e enfrente a máquina.</small></span><span aria-hidden="true">↗</span></a>
            <a class="modo" href="{{ route('jogar.local', 'versus') }}"><span class="modo-numero" aria-hidden="true">03</span><span><b>Versus local</b><small>Dois jogadores. Dois controles. Uma tela.</small></span><span aria-hidden="true">↗</span></a>
            <a class="modo" href="{{ route('jogar.local', 'treino') }}"><span class="modo-numero" aria-hidden="true">04</span><span><b>Treino</b><small>Domine os golpes da Lola.</small></span><span aria-hidden="true">↗</span></a>
        </nav>
        <details class="online-opcoes" @if(old('codigo') || request('sala') || $errors->has('codigo')) open @endif>
            <summary>Jogar online <span>CRIAR OU ENTRAR EM SALA</span></summary>
            <div class="online-conteudo">
                <form method="post" action="{{ route('sala.criar') }}">@csrf<button class="botao botao-sec">Criar sala</button></form>
                <form method="post" action="{{ route('sala.entrar') }}" class="entrar-codigo">
                    @csrf
                    <label for="codigo" class="sr">Código da sala</label>
                    <input id="codigo" name="codigo" value="{{ old('codigo', request('sala')) }}" maxlength="4" placeholder="CÓDIGO" autocomplete="off" autocapitalize="characters" spellcheck="false" minlength="4" pattern="[A-Za-z0-9]{4}" required>
                    <button class="botao">Entrar</button>
                </form>
                @error('codigo')<p class="erro" role="alert">{{ $message }}</p>@enderror
            </div>
        </details>
        <footer class="portal-links"><a class="link-discreto" href="{{ route('ranking') }}">Ranking ↗</a>@if($eu->pin_hash !== null)<form method="post" action="{{ route('sair') }}">@csrf<button class="link-discreto">Sair da conta</button></form>@endif</footer>
    </section>
</main>
@endsection