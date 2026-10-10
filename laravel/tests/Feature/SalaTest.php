<?php

namespace Tests\Feature;

use App\Models\Jogador;
use App\Models\Sala;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Criar sala, entrar pelo código, só dois por sala. */
class SalaTest extends TestCase
{
    use RefreshDatabase;

    private Jogador $host;

    private Jogador $amigo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->host = Jogador::query()->create(['apelido' => 'Host']);
        $this->amigo = Jogador::query()->create(['apelido' => 'Amigo']);
    }

    public function test_cria_sala_com_codigo_facil_de_digitar(): void
    {
        $this->actingAs($this->host)->post('/salas');

        $sala = Sala::query()->sole();
        $this->assertMatchesRegularExpression('/^[A-HJ-NP-Z2-9]{4}$/', $sala->codigo);
        $this->get('/sala/'.$sala->codigo)->assertOk()->assertSee($sala->codigo);
    }

    public function test_amigo_entra_pelo_codigo_mesmo_em_minusculas(): void
    {
        $sala = Sala::criarPara($this->host);

        $this->actingAs($this->amigo)->post('/salas/entrar', ['codigo' => ' '.strtolower($sala->codigo)])
            ->assertRedirect('/sala/'.$sala->codigo);
        $this->assertSame($this->amigo->id, $sala->fresh()->convidado_id);
        $this->get('/sala/'.$sala->codigo)->assertOk()->assertSee('"lado":"convidado"', false);
    }

    public function test_terceiro_nao_entra_nem_ve_a_sala(): void
    {
        $sala = Sala::criarPara($this->host);
        $sala->update(['convidado_id' => $this->amigo->id]);
        $intruso = Jogador::query()->create(['apelido' => 'Intruso']);

        $this->actingAs($intruso)->post('/salas/entrar', ['codigo' => $sala->codigo])->assertSessionHasErrors('codigo');
        $this->get('/sala/'.$sala->codigo)->assertForbidden();
        $this->assertSame($this->amigo->id, $sala->fresh()->convidado_id);
    }

    public function test_codigo_errado_avisa(): void
    {
        $this->actingAs($this->amigo)->post('/salas/entrar', ['codigo' => 'ZZZZ'])->assertSessionHasErrors('codigo');
    }

    public function test_sem_apelido_volta_para_o_inicio(): void
    {
        $sala = Sala::criarPara($this->host);
        $this->get('/sala/'.$sala->codigo)->assertRedirect('/');
        $this->post('/salas')->assertRedirect('/');
    }

    public function test_cada_lado_recebe_um_token_diferente_para_o_relay(): void
    {
        $sala = Sala::criarPara($this->host);
        $this->assertNotSame($sala->tokenRelay('host'), $sala->tokenRelay('convidado'));
        $this->actingAs($this->host)->get('/sala/'.$sala->codigo)->assertSee($sala->tokenRelay('host'))->assertDontSee($sala->tokenRelay('convidado'));
    }

    public function test_treino_e_cpu_abrem_sem_sala(): void
    {
        $this->actingAs($this->host)->get('/jogar/cpu')->assertOk()->assertSee('"modo":"cpu"', false);
        $this->get('/jogar/treino')->assertOk();
        $this->get('/jogar/outro')->assertNotFound();
    }
}
