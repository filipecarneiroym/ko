<?php

namespace Tests\Feature;

use App\Models\Jogador;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Entrar só com o apelido e continuar logado no celular. */
class EntrarTest extends TestCase
{
    use RefreshDatabase;

    public function test_primeira_visita_pede_apelido(): void
    {
        $this->get('/')->assertOk()->assertSee('Seu apelido');
    }

    public function test_entra_com_apelido_e_ve_o_menu(): void
    {
        $this->post('/entrar', ['apelido' => '  Pipoca   Veloz ', 'pin' => '0123'])->assertRedirect('/')
            ->assertCookie(auth()->guard()->getRecallerName());

        $this->assertSame('Pipoca Veloz', Jogador::query()->sole()->apelido);
        $this->assertTrue(Hash::check('0123', Jogador::query()->sole()->pin_hash));
        $this->get('/')->assertOk()->assertSee('Criar sala')->assertSee('Pipoca Veloz');
    }

    public function test_link_do_amigo_leva_o_codigo_da_sala_ate_o_menu(): void
    {
        $this->get('/?sala=AB12')->assertOk()->assertSee('name="sala" value="AB12"', false);
        $this->post('/entrar', ['apelido' => 'Neto', 'pin' => '1234', 'sala' => 'AB12'])->assertRedirect('/?sala=AB12');
        $this->get('/?sala=AB12')->assertSee('value="AB12"', false);
    }

    public function test_apelido_repetido_e_recusado(): void
    {
        Jogador::query()->create(['apelido' => 'Lobo']);

        $this->post('/entrar', ['apelido' => 'Lobo', 'pin' => '1234'])->assertSessionHasErrors('apelido');
        $this->assertGuest();
    }

    public function test_apelido_invalido_e_recusado(): void
    {
        $this->post('/entrar', ['apelido' => 'a'])->assertSessionHasErrors('apelido');
        $this->post('/entrar', ['apelido' => '<script>'])->assertSessionHasErrors('apelido');
        $this->post('/entrar', ['apelido' => str_repeat('x', 17)])->assertSessionHasErrors('apelido');
        $this->assertSame(0, Jogador::query()->count());
    }

    public function test_ranking_ordena_por_vitorias(): void
    {
        Jogador::query()->create(['apelido' => 'Vovó'])->forceFill(['vitorias' => 5, 'derrotas' => 1])->save();
        Jogador::query()->create(['apelido' => 'Neto'])->forceFill(['vitorias' => 7, 'derrotas' => 3])->save();
        Jogador::query()->create(['apelido' => 'Novato']);

        $this->get('/ranking')->assertOk()->assertSeeInOrder(['Neto', 'Vovó'])->assertDontSee('Novato');
    }

    public function test_pin_permite_entrar_na_mesma_conta_sem_zerar_ranking(): void
    {
        $jogador = Jogador::query()->create(['apelido' => 'Volt']);
        $jogador->forceFill(['pin_hash' => Hash::make('0123'), 'vitorias' => 7])->save();
        $this->post('/entrar', ['apelido' => 'Volt', 'pin' => '0123'])->assertRedirect('/');
        $this->assertAuthenticatedAs($jogador);
        $this->assertSame(1, Jogador::query()->count());
        $this->assertSame(7, $jogador->fresh()->vitorias);
    }

    public function test_pin_errado_nao_entra_nem_fica_na_sessao(): void
    {
        $jogador = Jogador::query()->create(['apelido' => 'Volt']);
        $jogador->forceFill(['pin_hash' => Hash::make('0123')])->save();
        $this->post('/entrar', ['apelido' => 'Volt', 'pin' => '9999'])->assertSessionHasErrors('pin');
        $this->assertGuest();
        $this->assertNull(session()->getOldInput('pin'));
    }

    public function test_pin_exige_exatamente_quatro_digitos_e_nao_e_reexibido(): void
    {
        foreach (['123', '12345', 'abcd', '12 3'] as $pin) {
            $this->post('/entrar', ['apelido' => 'Volt', 'pin' => $pin])->assertSessionHasErrors('pin');
            $this->assertNull(session()->getOldInput('pin'));
        }
        $this->assertSame(0, Jogador::query()->count());
    }

    public function test_dono_autenticado_protege_conta_antiga_e_nao_pode_sobrescrever_pin(): void
    {
        $jogador = Jogador::query()->create(['apelido' => 'Volt']);
        $this->actingAs($jogador)->post('/conta/pin', ['pin' => '0123', 'pin_confirmation' => '0123'])->assertRedirect('/');
        $this->assertTrue(Hash::check('0123', $jogador->fresh()->pin_hash));
        $this->post('/conta/pin', ['pin' => '9999', 'pin_confirmation' => '9999'])->assertStatus(409);
        $this->post('/sair')->assertRedirect('/');
        $this->assertGuest();
        $this->post('/entrar', ['apelido' => 'Volt', 'pin' => '0123'])->assertRedirect('/');
        $this->assertAuthenticatedAs($jogador);
    }

    public function test_pin_sem_confirmacao_nao_protege_conta_antiga(): void
    {
        $jogador = Jogador::query()->create(['apelido' => 'Volt']);
        $this->actingAs($jogador)->post('/conta/pin', ['pin' => '0123', 'pin_confirmation' => '4321'])->assertSessionHasErrors('pin');
        $this->assertNull($jogador->fresh()->pin_hash);
    }
}
