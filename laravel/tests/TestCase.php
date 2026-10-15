<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Teste nunca chama API de verdade (Mercado Pago, Melhor Envio...): quem precisa usa Http::fake().
        Http::preventStrayRequests();
    }
}
