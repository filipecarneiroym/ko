<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EntradaPublicaTest extends TestCase
{
    use RefreshDatabase;

    public function test_entrada_e_ranking_nao_exigem_senha_compartilhada(): void
    {
        $this->get('/')->assertOk()->assertSee('Seu apelido de lutador')->assertSee('Lola,')
            ->assertDontSee('Desbloquear arena')->assertDontSee('elenco-poster');
        $this->get('/ranking')->assertOk();
        $this->post('/desbloquear', ['senha_amigos' => 'ko'])->assertNotFound();
    }

    public function test_convite_login_logout_funcionam_sem_desbloqueio(): void
    {
        $this->get('/?sala=AB12')->assertSee('name="sala" value="AB12"', false);
        $this->post('/entrar', ['apelido' => 'Filipe', 'pin' => '0123', 'sala' => 'AB12'])
            ->assertRedirect('/?sala=AB12');
        $this->assertAuthenticated();
        $this->get('/')->assertSee('Versus CPU')->assertSee('Treino');
        $this->post('/sair')->assertRedirect('/');
        $this->assertGuest();
        $this->get('/')->assertSee('Seu apelido de lutador')->assertDontSee('Desbloquear arena');
    }

    public function test_conta_e_pin_continuam_obrigatorios(): void
    {
        $this->get('/jogar/cpu')->assertRedirect('/');
        $this->post('/entrar', ['apelido' => 'Filipe'])->assertSessionHasErrors('pin');
        $this->assertGuest();
    }
}
