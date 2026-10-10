<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;

/** Quem joga. Entra só com o apelido; o cookie "lembrar" mantém a pessoa no celular. */
class Jogador extends Authenticatable
{
    protected $table = 'jogadores';

    protected $fillable = ['apelido'];

    protected $hidden = ['remember_token'];

    /** Sem senha: o Laravel pede uma para o "lembrar", mas nunca é conferida. */
    public function getAuthPassword(): string
    {
        return '';
    }

    public function scopeRanking(Builder $query): Builder
    {
        return $query->where('vitorias', '>', 0)->orWhere('derrotas', '>', 0)
            ->orderByDesc('vitorias')->orderBy('derrotas')->orderBy('apelido');
    }
}
