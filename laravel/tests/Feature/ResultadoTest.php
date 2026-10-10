<?php

namespace Tests\Feature;

use App\Models\Jogador;
use App\Models\Partida;
use App\Models\Sala;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** O ranking só muda quando os dois celulares contam a mesma luta. */
class ResultadoTest extends TestCase
{
    use RefreshDatabase;

    private Jogador $host;

    private Jogador $amigo;

    private Sala $sala;

    protected function setUp(): void
    {
        parent::setUp();
        $this->host = Jogador::query()->create(['apelido' => 'Host']);
        $this->amigo = Jogador::query()->create(['apelido' => 'Amigo']);
        $this->sala = Sala::criarPara($this->host);
        $this->sala->update(['convidado_id' => $this->amigo->id]);
    }

    private function relato(array $mudar = []): array
    {
        return [...[
            'numero' => 1, 'lutador_host' => 'pipoca', 'lutador_convidado' => 'uivo', 'cenario' => 'praia',
            'vencedor' => 'convidado', 'rounds_host' => 1, 'rounds_convidado' => 2,
        ], ...$mudar];
    }

    private function enviar(Jogador $quem, array $relato)
    {
        return $this->actingAs($quem)->postJson('/sala/'.$this->sala->codigo.'/resultado', $relato);
    }

    public function test_relatos_iguais_contam_no_ranking(): void
    {
        $this->enviar($this->host, $this->relato())->assertOk()->assertJson(['valeu' => false]);
        $this->enviar($this->amigo, $this->relato())->assertOk()->assertJson(['valeu' => true]);

        $this->assertSame([0, 1], [$this->host->fresh()->vitorias, $this->host->fresh()->derrotas]);
        $this->assertSame([1, 0], [$this->amigo->fresh()->vitorias, $this->amigo->fresh()->derrotas]);
        $partida = Partida::query()->sole();
        $this->assertSame([$this->amigo->id, 2, 1], [$partida->vencedor_id, $partida->rounds_vencedor, $partida->rounds_perdedor]);
    }

    public function test_relatos_diferentes_nao_contam(): void
    {
        $this->enviar($this->host, $this->relato(['vencedor' => 'host', 'rounds_host' => 2, 'rounds_convidado' => 0]));
        $this->enviar($this->amigo, $this->relato())->assertJson(['valeu' => false]);

        $this->assertSame(0, Jogador::query()->sum('vitorias'));
    }

    public function test_reenviar_nao_conta_duas_vezes_nem_troca_o_relato(): void
    {
        $this->enviar($this->host, $this->relato());
        $this->enviar($this->amigo, $this->relato());
        $this->enviar($this->amigo, $this->relato());
        $this->enviar($this->host, $this->relato(['vencedor' => 'host', 'rounds_host' => 2, 'rounds_convidado' => 1]));

        $this->assertSame(1, $this->amigo->fresh()->vitorias);
        $this->assertSame('convidado', Partida::query()->sole()->relato_host['vencedor']);
    }

    public function test_revanche_vira_outra_partida(): void
    {
        foreach ([1, 2] as $n) {
            $this->enviar($this->host, $this->relato(['numero' => $n]));
            $this->enviar($this->amigo, $this->relato(['numero' => $n]));
        }

        $this->assertSame(2, $this->amigo->fresh()->vitorias);
        $this->actingAs($this->host)->get('/sala/'.$this->sala->codigo)->assertSee('"proxima":3', false);
    }

    public function test_dados_impossiveis_sao_recusados(): void
    {
        $this->enviar($this->host, $this->relato(['lutador_host' => 'zumbi']))->assertStatus(422); // lutador que não existe
        $this->enviar($this->host, $this->relato(['cenario' => 'lua']))->assertStatus(422);
        $this->enviar($this->host, $this->relato(['rounds_host' => 1, 'rounds_convidado' => 1]))->assertStatus(422);
        $this->assertSame(0, Partida::query()->count());
    }

    public function test_quem_nao_e_da_sala_nao_manda_resultado(): void
    {
        $intruso = Jogador::query()->create(['apelido' => 'Intruso']);
        $this->enviar($intruso, $this->relato())->assertForbidden();
    }
}
