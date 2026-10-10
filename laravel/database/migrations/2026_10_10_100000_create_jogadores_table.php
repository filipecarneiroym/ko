<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jogadores', function (Blueprint $table) {
            $table->id();
            $table->string('apelido', 16)->unique();
            $table->unsignedInteger('vitorias')->default(0);
            $table->unsignedInteger('derrotas')->default(0);
            // Sem senha: o cookie "lembrar" é o que mantém o jogador no celular dele.
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jogadores');
    }
};
