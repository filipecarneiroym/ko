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
        $this->get('/')->assertOk()->assertSee('Desbloquear arena')->assertDontSee('Criar sala')->assertDontSee('value="ko"', false);
        $this->get('/ranking')->assertForbidden()->assertSee('Desbloquear arena');
        $this->postJson('/entrar')->assertForbidden();
    }

    public function test_senha_ko_sem_diferenca_de_maiusculas_nem_espacos_nas_pontas(): void
    {
        foreach (['k o', 'ok', 'O.K', 'kko', ['ko']] as $senha) {
            $this->from('/')->post('/desbloquear', ['senha_amigos' => $senha])
                ->assertRedirect('/')->assertSessionHasErrors('senha_amigos');
        }
        $this->get('/')->assertSee('Desbloquear arena');
        $this->post('/desbloquear', ['senha_amigos' => 'ko'])->assertRedirect('/');
        $this->get('/')->assertOk()->assertSee('Seu apelido')->assertDontSee('Desbloquear arena');
    }

    public function test_preserva_codigo_do_convite_e_trocar_senha_revoga_desbloqueio(): void
    {
        $this->get('/?sala=AB12')->assertOk();
        $this->post('/desbloquear', ['senha_amigos' => 'ko'])->assertRedirect('/?sala=AB12');
        $this->get('/?sala=AB12')->assertSee('name="sala" value="AB12"', false);
        config(['ko.senha_amigos' => 'Outra']);
        $this->get('/')->assertSee('Desbloquear arena');
    }

    public function test_nao_redireciona_para_site_externo(): void
    {
        $this->withSession(['amigos_destino' => '//example.com']);
        $this->post('/desbloquear', ['senha_amigos' => 'ko'])->assertRedirect('/');
    }

    public function test_aceita_ko_com_maiuscula_do_teclado_e_espacos(): void
    {
        $this->post('/desbloquear', ['senha_amigos' => ' Ko '])->assertRedirect('/');
        $this->get('/')->assertOk()->assertDontSee('Desbloquear arena');
    }
}
