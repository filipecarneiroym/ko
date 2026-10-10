<?php

namespace Tests\Feature;

use Symfony\Component\Process\Process;
use Tests\TestCase;

/** Relay de verdade: sobe o `ko:relay` e conversa com ele como dois celulares. */
class RelayTest extends TestCase
{
    private Process $relay;

    private int $porta;

    protected function setUp(): void
    {
        parent::setUp();
        $this->porta = random_int(20000, 40000);
        $this->relay = new Process(['php', 'artisan', 'ko:relay', '--porta='.$this->porta], base_path());
        $this->relay->start();
        $limite = microtime(true) + 5;
        while (! @fsockopen('127.0.0.1', $this->porta) && microtime(true) < $limite) {
            usleep(50_000);
        }
    }

    protected function tearDown(): void
    {
        $this->relay->stop(0);
        parent::tearDown();
    }

    /** @return resource|string socket aberto, ou a primeira linha da resposta se recusou */
    private function conectar(string $sala, string $lado, ?string $token = null)
    {
        $token ??= hash_hmac('sha256', $sala.'|'.$lado, config('app.key'));
        $s = fsockopen('127.0.0.1', $this->porta);
        stream_set_timeout($s, 2);
        $chave = base64_encode(random_bytes(16));
        fwrite($s, "GET /ws?sala={$sala}&lado={$lado}&t={$token} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {$chave}\r\nSec-WebSocket-Version: 13\r\n\r\n");
        $resposta = '';
        while (! str_contains($resposta, "\r\n\r\n") && ! feof($s)) {
            $resposta .= fread($s, 1);
        }
        if (! str_starts_with($resposta, 'HTTP/1.1 101')) {
            return strtok($resposta, "\r\n");
        }
        $this->assertStringContainsString(base64_encode(sha1($chave.'258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true)), $resposta);

        return $s;
    }

    private function mandar($s, string $texto): void
    {
        $mascara = random_bytes(4);
        $n = strlen($texto);
        $cabeca = chr(0x81).($n < 126 ? chr(0x80 | $n) : chr(0x80 | 126).pack('n', $n));
        fwrite($s, $cabeca.$mascara.($texto ^ str_repeat($mascara, intdiv($n, 4) + 1)));
    }

    private function receber($s): string
    {
        $cabeca = fread($s, 2);
        $n = ord($cabeca[1]) & 0x7F;
        if ($n === 126) {
            $n = unpack('n', fread($s, 2))[1];
        }

        return $n ? fread($s, $n) : '';
    }

    public function test_repassa_mensagens_so_entre_os_dois_da_sala(): void
    {
        $host = $this->conectar('AB12', 'host');
        $this->assertSame('{"t":"sala","host":true,"convidado":false}', $this->receber($host));

        $convidado = $this->conectar('AB12', 'convidado');
        $this->assertSame('{"t":"sala","host":true,"convidado":true}', $this->receber($convidado));
        $this->assertSame('{"t":"sala","host":true,"convidado":true}', $this->receber($host));

        $outraSala = $this->conectar('ZZ99', 'host');
        $this->receber($outraSala);

        $this->mandar($host, '{"t":"i","f":10,"b":5}');
        $this->assertSame('{"t":"i","f":10,"b":5}', $this->receber($convidado));
        $grande = json_encode(['t' => 'x', 'p' => str_repeat('a', 300)]);
        $this->mandar($convidado, $grande);
        $this->assertSame($grande, $this->receber($host));

        stream_set_timeout($outraSala, 0, 200_000);
        $this->assertSame('', (string) fread($outraSala, 2), 'Mensagem vazou para outra sala');

        fclose($convidado);
        $this->assertSame('{"t":"sala","host":true,"convidado":false}', $this->receber($host));
    }

    public function test_token_errado_ou_de_outro_lado_e_recusado(): void
    {
        $this->assertSame('HTTP/1.1 403 Forbidden', $this->conectar('AB12', 'host', 'falso'));
        $tokenHost = hash_hmac('sha256', 'AB12|host', config('app.key'));
        $this->assertSame('HTTP/1.1 403 Forbidden', $this->conectar('AB12', 'convidado', $tokenHost));
    }

    public function test_reconectar_do_mesmo_lado_troca_a_conexao(): void
    {
        $antiga = $this->conectar('AB12', 'host');
        $this->receber($antiga);
        $convidado = $this->conectar('AB12', 'convidado');
        $this->receber($convidado);
        $this->receber($antiga);

        $nova = $this->conectar('AB12', 'host');
        $this->receber($nova);
        $this->receber($convidado);

        $this->mandar($convidado, 'oi');
        $this->assertSame('oi', $this->receber($nova));
    }
}
