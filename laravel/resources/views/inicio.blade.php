@extends('layouts.app')

@section('conteudo')
@php($eu = auth()->user())
<main class="tela">
    <h1 class="logo logo-pequeno" aria-label="K.O">K<span>.</span>O</h1>
    <p class="ola">E aí, <strong>{{ $eu->apelido }}</strong>! <span class="placar">{{ $eu->vitorias }}V · {{ $eu->derrotas }}D</span></p>

    <div class="menu">
        @if (session('status'))<p class="recado" role="status">{{ session('status') }}</p>@endif
        @if ($eu->pin_hash === null)
        <form method="post" action="{{ route('conta.pin') }}" class="cartao">
            @csrf
            <label for="pin">Proteja seu jogador com um PIN de 4 dígitos</label>
            <p class="dica">Depois você pode usar {{ $eu->apelido }} e o PIN em outro celular ou computador.</p>
            <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required placeholder="Novo PIN">
            <label for="pin_confirmation">Repita o PIN</label>
            <input id="pin_confirmation" name="pin_confirmation" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="new-password" required placeholder="Repita o PIN">
            @error('pin')<p class="erro" role="alert">{{ $message }}</p>@enderror
            <button class="botao">Salvar PIN</button>
        </form>
        @endif
        <form method="post" action="{{ route('sala.criar') }}">
            @csrf
            <button class="botao botao-grande">Criar sala</button>
        </form>

        <form method="post" action="{{ route('sala.entrar') }}" class="entrar-codigo">
            @csrf
            <label for="codigo" class="sr">Código da sala</label>
            <input id="codigo" name="codigo" value="{{ old('codigo', request('sala')) }}" maxlength="4" placeholder="CÓDIGO"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" minlength="4" pattern="[A-Za-z0-9]{4}" required>
            <button class="botao">Entrar</button>
        </form>
        @error('codigo') <p class="erro" role="alert">{{ $message }}</p> @enderror

        <a class="botao" href="{{ route('jogar.local', 'arcade') }}">Arcade (1 jogador)</a>
        <div class="menu-linha">
            <a class="botao botao-sec" href="{{ route('jogar.local', 'cpu') }}">Versus CPU</a>
            <a class="botao botao-sec" href="{{ route('jogar.local', 'versus') }}">Versus 2 jogadores</a>
        </div>
        <a class="botao botao-sec" href="{{ route('jogar.local', 'treino') }}">Treino</a>
        <a class="botao botao-sec" href="{{ route('ranking') }}">Ranking</a>
        @if ($eu->pin_hash !== null)
        <form method="post" action="{{ route('sair') }}">@csrf<button class="botao botao-sec">Sair da conta</button></form>
        @endif
    </div>
</main>
@endsection
