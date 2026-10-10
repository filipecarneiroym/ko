<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Relay da luta: um servidor WebSocket mínimo que só repassa as mensagens de um celular para o
 * outro da mesma sala. A luta roda nos dois aparelhos; aqui passam só os botões apertados.
 *
 * Não usa banco: quem entra prova que é da sala com o token assinado pela APP_KEY (Sala::tokenRelay).
 * ponytail: processo único com stream_select, folgado para centenas de salas. Se um dia passar
 * disso, trocar por Laravel Reverb (o protocolo das mensagens do jogo continua o mesmo).
 */
class Relay extends Command
{
    protected $signature = 'ko:relay {--porta= : Porta local (padrão: KO_RELAY_PORTA ou 6001)}';

    protected $description = 'Servidor WebSocket que liga os dois celulares de cada sala';

    private const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    private const MAX_MENSAGEM = 16384;

    private const SILENCIO_MAXIMO = 60; // segundos; o jogo manda "ping" a cada segundo

    private const ESPERA_APERTO_DE_MAO = 10; // quem conecta e não se identifica sai logo

    private const MAX_CONEXOES = 2000; // trava contra quem abre conexões aos montes

    /** @var array<int, array{s: resource, entrada: string, saida: string, aberto: bool, sala: ?string, lado: ?string, visto: int}> */
    private array $conexoes = [];

    /** @var array<string, array<string, int>> codigo => [lado => id da conexão] */
    private array $salas = [];

    public function handle(): int
    {
        $porta = (int) ($this->option('porta') ?: config('ko.relay_porta'));
        $host = config('ko.relay_host');
        $servidor = @stream_socket_server("tcp://{$host}:{$porta}", $erro, $mensagem);
        if (! $servidor) {
            $this->error("Não consegui abrir a porta {$porta}: {$mensagem}");

            return self::FAILURE;
        }
        stream_set_blocking($servidor, false);
        $this->info("Relay do K.O ouvindo em {$host}:{$porta}");

        while (true) {
            $leitura = [$servidor];
            $escrita = [];
            foreach ($this->conexoes as $c) {
                $leitura[] = $c['s'];
                if ($c['saida'] !== '') {
                    $escrita[] = $c['s'];
                }
            }
            $nada = null;
            if (@stream_select($leitura, $escrita, $nada, 5) === false) {
                continue;
            }

            foreach ($leitura as $s) {
                if ($s === $servidor) {
                    $this->aceitar($servidor);
                } else {
                    $this->ler((int) $s);
                }
            }
            foreach ($escrita as $s) {
                $this->escrever((int) $s);
            }
            $this->derrubarSilenciosos();
        }
    }

    private function aceitar($servidor): void
    {
        $s = @stream_socket_accept($servidor, 0);
        if (! $s) {
            return;
        }
        if (count($this->conexoes) >= self::MAX_CONEXOES) {
            @fclose($s);

            return;
        }
        stream_set_blocking($s, false);
        $this->conexoes[(int) $s] = ['s' => $s, 'entrada' => '', 'saida' => '', 'aberto' => false, 'sala' => null, 'lado' => null, 'visto' => time()];
    }

    private function ler(int $id): void
    {
        $dados = @fread($this->conexoes[$id]['s'], 8192);
        if ($dados === '' || $dados === false) {
            if (feof($this->conexoes[$id]['s'])) {
                $this->fechar($id);
            }

            return;
        }
        $c = &$this->conexoes[$id];
        $c['entrada'] .= $dados;
        $c['visto'] = time();

        if (! $c['aberto']) {
            $fim = strpos($c['entrada'], "\r\n\r\n");
            if ($fim === false) {
                if (strlen($c['entrada']) > 8192) {
                    $this->fechar($id);
                }

                return;
            }
            $cabecalho = substr($c['entrada'], 0, $fim);
            $c['entrada'] = substr($c['entrada'], $fim + 4);
            unset($c);
            if (! $this->apertoDeMao($id, $cabecalho)) {
                return;
            }
        } else {
            unset($c);
        }

        while (isset($this->conexoes[$id]) && ($quadro = $this->proximoQuadro($id)) !== null) {
            [$opcode, $conteudo] = $quadro;
            match ($opcode) {
                0x1 => $this->repassar($id, $conteudo),
                0x8 => $this->fechar($id),
                0x9 => $this->enviar($id, $conteudo, 0xA),
                default => null, // pong e binário: nada a fazer
            };
        }
    }

    /** Valida o token (codigo|lado assinado pela APP_KEY) e responde o handshake do WebSocket. */
    private function apertoDeMao(int $id, string $cabecalho): bool
    {
        $linhas = explode("\r\n", $cabecalho);
        $chave = null;
        foreach ($linhas as $linha) {
            if (stripos($linha, 'Sec-WebSocket-Key:') === 0) {
                $chave = trim(substr($linha, 18));
            }
        }
        parse_str((string) parse_url(explode(' ', $linhas[0])[1] ?? '', PHP_URL_QUERY), $q);
        $sala = is_string($q['sala'] ?? null) ? $q['sala'] : '';
        $lado = in_array($q['lado'] ?? null, ['host', 'convidado'], true) ? $q['lado'] : '';
        $token = is_string($q['t'] ?? null) ? $q['t'] : '';
        $esperado = hash_hmac('sha256', $sala.'|'.$lado, config('app.key'));

        if (! $chave || $lado === '' || ! hash_equals($esperado, $token)) {
            fwrite($this->conexoes[$id]['s'], "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            $this->fechar($id);

            return false;
        }

        $aceite = base64_encode(sha1($chave.self::GUID, true));
        $this->conexoes[$id]['saida'] .= "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {$aceite}\r\n\r\n";
        $this->conexoes[$id]['aberto'] = true;

        // Reconectou do mesmo lado (internet caiu e voltou): a conexão antiga sai.
        if (isset($this->salas[$sala][$lado])) {
            $this->fechar($this->salas[$sala][$lado], avisar: false);
        }
        $this->salas[$sala][$lado] = $id;
        $this->conexoes[$id]['sala'] = $sala;
        $this->conexoes[$id]['lado'] = $lado;
        $this->avisarPresenca($sala);

        return true;
    }

    /** @return array{0: int, 1: string}|null */
    private function proximoQuadro(int $id): ?array
    {
        $b = $this->conexoes[$id]['entrada'];
        if (strlen($b) < 2) {
            return null;
        }
        $opcode = ord($b[0]) & 0x0F;
        $mascarado = (ord($b[1]) & 0x80) !== 0;
        $tamanho = ord($b[1]) & 0x7F;
        $pos = 2;
        if ($tamanho === 126) {
            if (strlen($b) < 4) {
                return null;
            }
            $tamanho = unpack('n', substr($b, 2, 2))[1];
            $pos = 4;
        } elseif ($tamanho === 127) {
            $this->fechar($id); // mensagem gigante: o jogo nunca manda isso

            return null;
        }
        if (! $mascarado || $tamanho > self::MAX_MENSAGEM) {
            $this->fechar($id); // o navegador sempre mascara; sem máscara não é um cliente válido

            return null;
        }
        if (strlen($b) < $pos + 4 + $tamanho) {
            return null;
        }
        $mascara = substr($b, $pos, 4);
        $conteudo = substr($b, $pos + 4, $tamanho);
        $this->conexoes[$id]['entrada'] = substr($b, $pos + 4 + $tamanho);

        return [$opcode, $conteudo ^ str_repeat($mascara, intdiv($tamanho, 4) + 1)];
    }

    private function repassar(int $id, string $texto): void
    {
        $c = $this->conexoes[$id];
        $outroLado = $c['lado'] === 'host' ? 'convidado' : 'host';
        if (isset($this->salas[$c['sala']][$outroLado])) {
            $this->enviar($this->salas[$c['sala']][$outroLado], $texto);
        }
    }

    private function avisarPresenca(string $sala): void
    {
        $presenca = json_encode(['t' => 'sala', 'host' => isset($this->salas[$sala]['host']), 'convidado' => isset($this->salas[$sala]['convidado'])]);
        foreach ($this->salas[$sala] ?? [] as $id) {
            $this->enviar($id, $presenca);
        }
    }

    private function enviar(int $id, string $texto, int $opcode = 0x1): void
    {
        if (! isset($this->conexoes[$id])) {
            return;
        }
        $n = strlen($texto);
        $cabeca = chr(0x80 | $opcode).($n < 126 ? chr($n) : chr(126).pack('n', $n));
        $this->conexoes[$id]['saida'] .= $cabeca.$texto;
        $this->escrever($id);
    }

    private function escrever(int $id): void
    {
        if (! isset($this->conexoes[$id])) {
            return; // fechou antes nesta mesma volta do laço
        }
        $c = &$this->conexoes[$id];
        $foi = @fwrite($c['s'], $c['saida']);
        if ($foi === false) {
            unset($c);
            $this->fechar($id);

            return;
        }
        $c['saida'] = substr($c['saida'], $foi);
        // Celular que não lê (sinal muito ruim): não deixa a fila crescer sem fim.
        if (strlen($c['saida']) > 1_000_000) {
            unset($c);
            $this->fechar($id);
        }
    }

    private function derrubarSilenciosos(): void
    {
        $agora = time();
        foreach ($this->conexoes as $id => $c) {
            if ($c['visto'] < $agora - ($c['aberto'] ? self::SILENCIO_MAXIMO : self::ESPERA_APERTO_DE_MAO)) {
                $this->fechar($id);
            }
        }
    }

    private function fechar(int $id, bool $avisar = true): void
    {
        if (! isset($this->conexoes[$id])) {
            return;
        }
        ['s' => $s, 'sala' => $sala, 'lado' => $lado] = $this->conexoes[$id];
        unset($this->conexoes[$id]);
        @fclose($s);
        if ($sala !== null && ($this->salas[$sala][$lado] ?? null) === $id) {
            unset($this->salas[$sala][$lado]);
            if ($this->salas[$sala] === []) {
                unset($this->salas[$sala]);
            } elseif ($avisar) {
                $this->avisarPresenca($sala);
            }
        }
    }
}
