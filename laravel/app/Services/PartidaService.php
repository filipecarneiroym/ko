<?php

namespace App\Services;

use App\Models\Jogador;
use App\Models\Partida;
use App\Models\Sala;
use Illuminate\Support\Facades\DB;

/**
 * Resultado da luta. Os dois celulares rodam a mesma luta e cada um manda o que viu;
 * o ranking só muda quando os dois relatos batem (um celular sozinho não inventa vitória).
 */
class PartidaService
{
    /**
     * @param  array{numero: int, lutador_host: string, lutador_convidado: string, cenario: string, vencedor: string, rounds_host: int, rounds_convidado: int}  $dados
     */
    public function registrar(Sala $sala, string $lado, array $dados): Partida
    {
        $partida = Partida::query()->firstOrCreate(
            ['sala_id' => $sala->id, 'numero' => $dados['numero']],
            ['lutador_host' => $dados['lutador_host'], 'lutador_convidado' => $dados['lutador_convidado'], 'cenario' => $dados['cenario']],
        );

        $relato = [
            'lutador_host' => $dados['lutador_host'],
            'lutador_convidado' => $dados['lutador_convidado'],
            'vencedor' => $dados['vencedor'],
            'rounds_host' => $dados['rounds_host'],
            'rounds_convidado' => $dados['rounds_convidado'],
        ];
        // Cada lado só escreve o próprio relato, uma vez (reenvio não muda o que já foi dito).
        Partida::query()->whereKey($partida->id)->whereNull('relato_'.$lado)
            ->update(['relato_'.$lado => json_encode($relato), 'updated_at' => now()]);

        $partida->refresh();
        if ($partida->relato_host !== null && $partida->relato_host === $partida->relato_convidado) {
            $this->fechar($sala, $partida);
        }

        return $partida->refresh();
    }

    private function fechar(Sala $sala, Partida $partida): void
    {
        $r = $partida->relato_host;
        $vencedorId = $r['vencedor'] === 'host' ? $sala->host_id : $sala->convidado_id;
        $perdedorId = $r['vencedor'] === 'host' ? $sala->convidado_id : $sala->host_id;

        DB::transaction(function () use ($partida, $r, $vencedorId, $perdedorId) {
            // Os dois pedidos podem chegar juntos: só quem conseguir marcar o vencedor conta o placar.
            $marcou = Partida::query()->whereKey($partida->id)->whereNull('vencedor_id')->update([
                'vencedor_id' => $vencedorId,
                'rounds_vencedor' => max($r['rounds_host'], $r['rounds_convidado']),
                'rounds_perdedor' => min($r['rounds_host'], $r['rounds_convidado']),
            ]);
            if ($marcou) {
                Jogador::query()->whereKey($vencedorId)->increment('vitorias');
                Jogador::query()->whereKey($perdedorId)->increment('derrotas');
            }
        });
    }
}
