<?php

namespace Tests;

use App\Http\Middleware\AcessoAmigos;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Teste nunca chama API de verdade (Mercado Pago, Melhor Envio...): quem precisa usa Http::fake().
        Http::preventStrayRequests();
        // Os testes de jogo começam após o desbloqueio; AcessoAmigosTest cobre a barreira.
        $this->withSession(['acesso_amigos' => AcessoAmigos::chave()]);
    }
}
