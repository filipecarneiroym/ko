<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Cabeçalhos de segurança em toda resposta, sem depender da configuração do servidor (igual à YM). */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        if ($request->secure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // O jogo não usa nada de fora: CSP valendo de verdade. Só o relay da luta fica liberado.
        $relay = parse_url(config('ko.relay_url'));
        $origemRelay = $relay['scheme'].'://'.$relay['host'].(isset($relay['port']) ? ':'.$relay['port'] : '');
        $response->headers->set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; "
            ."img-src 'self' data:; connect-src 'self' {$origemRelay}; manifest-src 'self'; worker-src 'self'; "
            ."object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");

        return $response;
    }
}
