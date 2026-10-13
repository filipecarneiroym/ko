<?php

namespace App\Services;

/** Personagens liberados para o jogo publicado, compartilhados pela tela e pelo resultado. */
class Elenco
{
    public static function publicados(): array
    {
        return array_filter(config('ko.lutadores'), fn (array $lutador) => ($lutador['pronto'] ?? false)
            && self::temModelos($lutador));
    }

    public static function temModelos(array $lutador): bool
    {
        $modelos = $lutador['modelos3d'] ?? null;

        return is_array($modelos) && array_keys($modelos) === [0, 1]
            && is_string($modelos[0]) && str_starts_with($modelos[0], '/modelos/')
            && is_string($modelos[1]) && str_starts_with($modelos[1], '/modelos/');
    }
}
