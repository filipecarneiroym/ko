<?php

namespace Tests\Feature;

use App\Services\RelayEndereco;
use Illuminate\Http\Request;
use Tests\TestCase;

class RelayEnderecoTest extends TestCase
{
    public function test_http_usa_o_servidor_acessado_pelo_celular(): void
    {
        config(['ko.relay_url' => null, 'ko.relay_porta' => 6001]);
        $this->assertSame('ws://192.168.1.10:6001', RelayEndereco::para(Request::create('http://192.168.1.10:8000/sala/ABCD')));
    }

    public function test_https_usa_o_proxy_websocket_do_site(): void
    {
        config(['ko.relay_url' => null]);
        $this->assertSame('wss://jogo.example/ws', RelayEndereco::para(Request::create('https://jogo.example/sala/ABCD')));
    }

    public function test_endereco_explicito_e_preservado(): void
    {
        config(['ko.relay_url' => 'wss://relay.example/ws']);
        $this->assertSame('wss://relay.example/ws', RelayEndereco::para(Request::create('https://jogo.example')));
    }
}
