<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Sala de luta: quem cria é o "host", quem entra pelo código é o "convidado". */
class Sala extends Model
{
    // Sem 0/O e 1/I: fácil de ditar em voz alta e digitar no celular.
    private const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    protected $fillable = ['codigo', 'host_id', 'convidado_id'];

    public function getRouteKeyName(): string
    {
        return 'codigo';
    }

    public static function criarPara(Jogador $host): self
    {
        do {
            $codigo = '';
            for ($i = 0; $i < 4; $i++) {
                $codigo .= self::LETRAS[random_int(0, strlen(self::LETRAS) - 1)];
            }
        } while (self::query()->where('codigo', $codigo)->exists());

        return self::query()->create(['codigo' => $codigo, 'host_id' => $host->id]);
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(Jogador::class, 'host_id');
    }

    public function convidado(): BelongsTo
    {
        return $this->belongsTo(Jogador::class, 'convidado_id');
    }

    public function partidas(): HasMany
    {
        return $this->hasMany(Partida::class);
    }

    /** 'host', 'convidado' ou null (não é desta sala). */
    public function ladoDe(Jogador $jogador): ?string
    {
        return match ($jogador->id) {
            $this->host_id => 'host',
            $this->convidado_id => 'convidado',
            default => null,
        };
    }

    /** Senha de uso único do relay: prova que este jogador é deste lado desta sala. */
    public function tokenRelay(string $lado): string
    {
        return hash_hmac('sha256', $this->codigo.'|'.$lado, config('app.key'));
    }
}
