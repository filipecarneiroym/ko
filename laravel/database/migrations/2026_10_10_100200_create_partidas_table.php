<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partidas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sala_id')->constrained()->cascadeOnDelete();
            // 1ª, 2ª, 3ª luta da sala (revanche cria a próxima).
            $table->unsignedInteger('numero');
            $table->string('lutador_host', 20);
            $table->string('lutador_convidado', 20);
            $table->string('cenario', 20);
            // O que cada celular disse que aconteceu. Só vale para o ranking quando os dois batem.
            $table->json('relato_host')->nullable();
            $table->json('relato_convidado')->nullable();
            $table->foreignId('vencedor_id')->nullable()->constrained('jogadores')->nullOnDelete();
            $table->unsignedTinyInteger('rounds_vencedor')->nullable();
            $table->unsignedTinyInteger('rounds_perdedor')->nullable();
            $table->timestamps();
            $table->unique(['sala_id', 'numero']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partidas');
    }
};
