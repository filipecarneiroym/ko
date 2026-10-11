<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class VerificarPublicacaoTest extends TestCase
{
    use RefreshDatabase;

    private function configurar(): void
    {
        config(['app.debug' => false, 'app.url' => 'https://ko.example', 'ko.relay_url' => null]);
    }

    public function test_configuracao_valida_sem_alterar_dados(): void
    {
        $this->configurar();
        $this->artisan('ko:verificar-publicacao')->assertSuccessful();
        $this->assertDatabaseCount('jogadores', 0);
    }

    public function test_rejeita_relay_local_no_site_publicado(): void
    {
        $this->configurar();
        config(['ko.relay_url' => 'ws://localhost:6001']);
        $this->artisan('ko:verificar-publicacao')->expectsOutputToContain('localhost')->assertFailed();
    }

    public function test_detecta_migracao_do_pin_ausente(): void
    {
        $this->configurar();
        Schema::table('jogadores', fn ($table) => $table->dropColumn('pin_hash'));
        $this->artisan('ko:verificar-publicacao')->expectsOutputToContain('migração do PIN')->assertFailed();
    }
}
