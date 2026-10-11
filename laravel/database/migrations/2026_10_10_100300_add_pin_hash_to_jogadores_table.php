<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('jogadores', fn (Blueprint $table) => $table->string('pin_hash')->nullable());
    }

    public function down(): void
    {
        Schema::table('jogadores', fn (Blueprint $table) => $table->dropColumn('pin_hash'));
    }
};
