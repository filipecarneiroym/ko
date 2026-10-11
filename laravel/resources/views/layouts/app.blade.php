<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="theme-color" content="#0b0614">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="robots" content="noindex">
    <title>{{ $titulo ?? 'K.O' }}</title>
    <link rel="manifest" href="/site.webmanifest">
    <link rel="icon" href="/favicon.png" type="image/png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="stylesheet" href="/css/ko.css?v={{ filemtime(public_path('css/ko.css')) }}">
    <script src="/js/ko-controle.js?v={{ filemtime(public_path('js/ko-controle.js')) }}" defer></script>
    <script src="/js/pwa.js?v={{ filemtime(public_path('js/pwa.js')) }}" defer></script>
    @stack('head')
</head>
<body class="@yield('corpo')">
    @if(trim($__env->yieldContent('corpo')) !== 'corpo-jogo')
        @include('partials.fundo-elenco')
    @endif
    @yield('conteudo')
</body>
</html>
