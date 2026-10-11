<?php

namespace Tests\Feature;

use Tests\TestCase;

class AcessoAmigosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withSession(['acesso_amigos' => null]);
    }

    public function test_visita_mostra_modal_sem_revelar_senha_ou_menu(): void
    {
        $this->get('/')->assertOk()->assertSee('Desbloquear arena')->assertDontSee('Criar sala')->assertDontSee('O.K');
        $this->get('/ranking')->assertForbidden()->assertSee('Desbloquear arena');
        $this->postJson('/entrar')->assertForbidden();
    }

    public function test_senha_exige_maiusculas_ponto_e_nenhum_espaco_extra(): void
    {
        foreach (['o.k', 'OK', 'O.K ', ' O.K', ['O.K']] as $senha) {
            $this->from('/')->post('/desbloquear', ['senha_amigos' => $senha])
                ->assertRedirect('/')->assertSessionHasErrors('senha_amigos');
        }
        $this->get('/')->assertSee('Desbloquear arena');
        $this->post('/desbloquear', ['senha_amigos' => 'O.K'])->assertRedirect('/');
        $this->get('/')->assertOk()->assertSee('Seu apelido')->assertDontSee('Desbloquear arena');
    }

    public function test_preserva_codigo_do_convite_e_trocar_senha_revoga_desbloqueio(): void
    {
        $this->get('/?sala=AB12')->assertOk();
        $this->post('/desbloquear', ['senha_amigos' => 'O.K'])->assertRedirect('/?sala=AB12');
        $this->get('/?sala=AB12')->assertSee('name="sala" value="AB12"', false);
        config(['ko.senha_amigos' => 'Outra']);
        $this->get('/')->assertSee('Desbloquear arena');
    }

    public function test_nao_redireciona_para_site_externo(): void
    {
        $this->withSession(['amigos_destino' => '//example.com']);
        $this->post('/desbloquear', ['senha_amigos' => 'O.K'])->assertRedirect('/');
    }
}
