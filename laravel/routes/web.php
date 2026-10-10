<?php

use App\Http\Controllers\JogadorController;
use App\Http\Controllers\SalaController;
use Illuminate\Support\Facades\Route;

Route::get('/', [JogadorController::class, 'inicio'])->name('inicio');
Route::post('/entrar', [JogadorController::class, 'entrar'])->middleware('throttle:10,1')->name('entrar');
Route::get('/ranking', [JogadorController::class, 'ranking'])->name('ranking');

Route::middleware('auth')->group(function () {
    Route::post('/salas', [SalaController::class, 'criar'])->middleware('throttle:20,1')->name('sala.criar');
    // Limite contra quem tenta adivinhar códigos de sala.
    Route::post('/salas/entrar', [SalaController::class, 'entrar'])->middleware('throttle:20,1')->name('sala.entrar');
    Route::get('/sala/{sala}', [SalaController::class, 'show'])->name('sala.show');
    Route::post('/sala/{sala}/resultado', [SalaController::class, 'resultado'])->middleware('throttle:30,1')->name('sala.resultado');
    Route::get('/jogar/{modo}', [SalaController::class, 'local'])->whereIn('modo', ['cpu', 'treino'])->name('jogar.local');
});
