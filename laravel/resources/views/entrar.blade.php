@extends('layouts.app')

@section('conteudo')
<main class="portal portal-entrada">
    <section class="portal-hero" aria-labelledby="marca">
        <p class="sobretitulo">ENTRE NA ARENA</p>
        <h1 class="logo" id="marca" aria-label="K.O">K<span>.</span>O</h1>
        <p class="hero-frase">Toda luta começa<br>com uma escolha.</p>
        <div class="hero-lola"><img src="/personagens/pipoca-3d-retrato.png" alt="Lola, de luvas vermelhas em posição de luta" width="640" height="800"><span>LOLA <small>PRONTA PARA LUTAR</small></span></div>
        <p class="hero-rodape">1 × 1 <span>TOQUE OU CONTROLE</span></p>
    </section>
    <section class="portal-conteudo">
        <p class="sobretitulo">SEU LUGAR NO RINGUE</p>
        <h2>Hora de lutar.</h2>
        <p class="texto-apoio">Entre com seu apelido ou crie um jogador agora.</p>
        <form method="post" action="{{ route('entrar') }}" class="cartao formulario-entrada">
            @csrf
            @if (is_string(request('sala')))<input type="hidden" name="sala" value="{{ request('sala') }}">@endif
            <label for="apelido">Seu apelido de lutador</label>
            <input id="apelido" name="apelido" value="{{ old('apelido') }}" maxlength="16" minlength="2" autocomplete="nickname" autocapitalize="words" required placeholder="Seu nome na arena">
            @error('apelido')<p class="erro" role="alert">{{ $message }}</p>@enderror
            <label for="pin">PIN de 4 dígitos</label>
            <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="current-password" required placeholder="••••" aria-describedby="pin-ajuda">
            @error('pin')<p class="erro" role="alert">{{ $message }}</p>@enderror
            <p class="dica" id="pin-ajuda">Primeira vez? Escolha um apelido e crie seu PIN. Já joga? Use seu apelido e PIN de sempre.</p>
            <button class="botao botao-grande">Entrar e jogar <span aria-hidden="true">→</span></button>
        </form>
        <a class="link-discreto" href="{{ route('ranking') }}">Ver ranking <span aria-hidden="true">↗</span></a>
    </section>
</main>
@endsection