<?php

namespace Tests\Feature;

use App\Models\Jogador;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Laboratorio3dTest extends TestCase
{
    use RefreshDatabase;

    public function test_exige_desbloqueio_e_conta(): void
    {
        $this->get('/laboratorio/3d')->assertRedirect();
        $jogador = Jogador::create(['apelido' => 'Bloqueado']);
        $this->actingAs($jogador)->withSession(['acesso_amigos' => null])
            ->get('/laboratorio/3d')->assertForbidden();
    }

    public function test_conta_acessa_previa_identificada_sem_criar_partida(): void
    {
        $jogador = Jogador::create(['apelido' => 'Laboratorio']);
        $response = $this->actingAs($jogador)->get('/laboratorio/3d')->assertOk()
            ->assertSee('modelos de estudo')->assertSee('/js/ko-laboratorio-3d.js');
        $this->assertStringContainsString("img-src 'self' data: blob:", $response->headers->get('Content-Security-Policy'));
        $this->assertStringNotContainsString('blob:', $this->get('/')->headers->get('Content-Security-Policy'));
        $this->assertDatabaseCount('salas', 0);
        $this->assertDatabaseCount('partidas', 0);
    }
}
