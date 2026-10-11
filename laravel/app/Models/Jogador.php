<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;

/** Apelido e PIN identificam o jogador; contas antigas cadastram o PIN na sessão original. */
class Jogador extends Authenticatable
{
    protected $table = 'jogadores';

    protected $fillable = ['apelido', 'pin_hash'];

    protected $attributes = ['pin_hash' => null, 'remember_token' => null];

    protected $hidden = ['remember_token', 'pin_hash'];

    /** Preserva os cookies de contas antigas; o PIN é conferido explicitamente na entrada. */
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
