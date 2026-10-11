@extends('layouts.app')

@section('conteudo')
<main class="tela">
    <h1 class="logo" aria-label="K.O">K<span>.</span>O</h1>
    <p class="chamada">Luta 1x1 no celular. Chama alguém e bota pra quebrar!</p>

    <form method="post" action="{{ route('entrar') }}" class="cartao">
        @csrf
        @if (is_string(request('sala')))<input type="hidden" name="sala" value="{{ request('sala') }}">@endif
        <label for="apelido">Seu apelido de lutador</label>
        <input id="apelido" name="apelido" value="{{ old('apelido') }}" maxlength="16" minlength="2"
               autocomplete="nickname" autocapitalize="words" required autofocus placeholder="Ex.: Raio da Vovó">
        @error('apelido') <p class="erro" role="alert">{{ $message }}</p> @enderror
        <label for="pin">PIN de 4 dígitos</label>
        <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="current-password" required placeholder="••••" aria-describedby="pin-ajuda">
        @error('pin') <p class="erro" role="alert">{{ $message }}</p> @enderror
        <button class="botao botao-grande">Entrar e jogar</button>
        <p class="dica" id="pin-ajuda">Primeira vez? Escolha um apelido e crie seu PIN. Já joga? Use o mesmo apelido e PIN em qualquer aparelho.</p>
    </form>
</main>
@endsection
