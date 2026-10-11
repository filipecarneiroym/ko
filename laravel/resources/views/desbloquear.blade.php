@extends('layouts.app')

@section('conteudo')
<main class="tela entrada-bloqueada" inert aria-hidden="true">
    <h1 class="logo" aria-label="K.O">K<span>.</span>O</h1>
    <p class="chamada">A arena está reservada para a nossa turma.</p>
</main>
<div class="acesso-overlay">
    <section class="acesso-modal" role="dialog" aria-modal="true" aria-labelledby="acesso-titulo" aria-describedby="acesso-descricao" tabindex="-1">
        <p class="acesso-selo">ARENA PRIVADA</p>
        <h2 id="acesso-titulo">Sua turma. Sua luta.</h2>
        <p id="acesso-descricao" class="chamada">Digite a senha dos amigos para desbloquear o jogo.</p>
        <form method="post" action="{{ route('amigos.desbloquear') }}" class="acesso-form">
            @csrf
            <label for="senha-amigos">Senha de acesso</label>
            <input id="senha-amigos" name="senha_amigos" type="password" maxlength="128" autocomplete="current-password" autocapitalize="off" spellcheck="false" required aria-describedby="acesso-erro">
            <p id="acesso-erro" class="erro" role="alert">@error('senha_amigos'){{ $message }}@enderror</p>
            <button class="botao botao-grande" type="submit">Desbloquear arena</button>
        </form>
        <p class="dica">Depois, entre com seu apelido e PIN.</p>
    </section>
</div>
@endsection
