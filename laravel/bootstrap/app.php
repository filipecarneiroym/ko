<?php

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // ponytail: confia em qualquer proxy (Cloudflare na frente), como na YM. Só é seguro com o
        // firewall aceitando HTTP/HTTPS apenas da Cloudflare; senão, trocar '*' pelos IPs dela.
        $middleware->trustProxies(at: '*');
        $middleware->append(SecurityHeaders::class);
        $middleware->redirectGuestsTo(fn () => route('inicio'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontFlash(['pin', 'pin_confirmation']);
    })
    ->create()
    // public/ fica ao lado de laravel/ (mesmo molde da YM): sem isso o artisan serve não acharia o site.
    ->usePublicPath(dirname(__DIR__, 2).'/public');
