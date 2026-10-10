@extends('layouts.app')

@section('conteudo')
@php($eu = auth()->user())
<main class="tela">
    <h1 class="logo logo-pequeno" aria-label="K.O">K<span>.</span>O</h1>
    <p class="ola">E aí, <strong>{{ $eu->apelido }}</strong>! <span class="placar">{{ $eu->vitorias }}V · {{ $eu->derrotas }}D</span></p>

    <div class="menu">
        <form method="post" action="{{ route('sala.criar') }}">
            @csrf
            <button class="botao botao-grande">Criar sala</button>
        </form>

        <form method="post" action="{{ route('sala.entrar') }}" class="entrar-codigo">
            @csrf
            <label for="codigo" class="sr">Código da sala</label>
            <input id="codigo" name="codigo" value="{{ old('codigo', request('sala')) }}" maxlength="4" placeholder="CÓDIGO"
                   autocomplete="off" autocapitalize="characters" spellcheck="false" required>
            <button class="botao">Entrar</button>
        </form>
        @error('codigo') <p class="erro" role="alert">{{ $message }}</p> @enderror

        <div class="menu-linha">
            <a class="botao botao-sec" href="{{ route('jogar.local', 'cpu') }}">Contra o computador</a>
            <a class="botao botao-sec" href="{{ route('jogar.local', 'treino') }}">Treino</a>
        </div>
        <a class="botao botao-sec" href="{{ route('ranking') }}">Ranking</a>
    </div>
</main>
@endsection
