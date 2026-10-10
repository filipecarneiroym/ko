<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma luta dentro da sala. Vale para o ranking quando os relatos dos dois celulares batem. */
class Partida extends Model
{
    protected $fillable = [
        'sala_id', 'numero', 'lutador_host', 'lutador_convidado', 'cenario',
        'relato_host', 'relato_convidado', 'vencedor_id', 'rounds_vencedor', 'rounds_perdedor',
    ];

    protected function casts(): array
    {
        return ['relato_host' => 'array', 'relato_convidado' => 'array'];
    }

    public function sala(): BelongsTo
    {
        return $this->belongsTo(Sala::class);
    }

    public function vencedor(): BelongsTo
    {
        return $this->belongsTo(Jogador::class, 'vencedor_id');
    }
}
