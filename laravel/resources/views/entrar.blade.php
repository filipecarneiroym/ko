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
        <button class="botao botao-grande">Lutar!</button>
        <p class="dica">Sem senha: este celular lembra de você.</p>
    </form>
</main>
@endsection
