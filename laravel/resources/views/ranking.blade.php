@extends('layouts.app', ['titulo' => 'Ranking — K.O'])

@section('conteudo')
<main class="tela">
    <h1 class="titulo">Ranking</h1>
    @if ($jogadores->isEmpty())
        <p class="chamada">Ninguém lutou ainda. Seja o primeiro!</p>
    @else
        <ol class="ranking">
            @foreach ($jogadores as $j)
                <li @class(['eu' => auth()->id() === $j->id])>
                    <span class="pos">{{ $loop->iteration }}</span>
                    <span class="nome">{{ $j->apelido }}</span>
                    <span class="placar">{{ $j->vitorias }}V · {{ $j->derrotas }}D</span>
                </li>
            @endforeach
        </ol>
    @endif
    <a class="botao botao-sec" href="{{ route('inicio') }}">Voltar</a>
</main>
@endsection
