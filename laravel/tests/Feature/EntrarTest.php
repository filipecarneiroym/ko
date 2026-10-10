<?php

namespace Tests\Feature;

use App\Models\Jogador;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        $this->post('/entrar', ['apelido' => '  Pipoca   Veloz '])->assertRedirect('/')
            ->assertCookie(auth()->guard()->getRecallerName());

        $this->assertSame('Pipoca Veloz', Jogador::query()->sole()->apelido);
        $this->get('/')->assertOk()->assertSee('Criar sala')->assertSee('Pipoca Veloz');
    }

    public function test_link_do_amigo_leva_o_codigo_da_sala_ate_o_menu(): void
    {
        $this->get('/?sala=AB12')->assertOk()->assertSee('name="sala" value="AB12"', false);
        $this->post('/entrar', ['apelido' => 'Neto', 'sala' => 'AB12'])->assertRedirect('/?sala=AB12');
        $this->get('/?sala=AB12')->assertSee('value="AB12"', false);
    }

    public function test_apelido_repetido_e_recusado(): void
    {
        Jogador::query()->create(['apelido' => 'Lobo']);

        $this->post('/entrar', ['apelido' => 'Lobo'])->assertSessionHasErrors('apelido');
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
}
