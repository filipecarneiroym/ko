<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Throwable;

class VerificarPublicacao extends Command
{
    protected $signature = 'ko:verificar-publicacao';

    protected $description = 'Confere configuração, banco e artes sem alterar dados ou exibir segredos';

    public function handle(): int
    {
        $erros = [];
        if (config('app.debug')) {
            $erros[] = 'Defina APP_DEBUG=false no serviço publicado.';
        }
        $url = config('app.url');
        if (parse_url($url, PHP_URL_SCHEME) !== 'https') {
            $erros[] = 'APP_URL precisa usar HTTPS em produção.';
        }
        $relay = config('ko.relay_url') ?: preg_replace('/^https:/', 'wss:', rtrim($url, '/')).'/ws';
        if (parse_url($relay, PHP_URL_SCHEME) !== 'wss' || in_array(parse_url($relay, PHP_URL_HOST), ['localhost', '127.0.0.1', '::1'], true)) {
            $erros[] = 'Configure o relay público com WSS; localhost não funciona nos celulares.';
        }
        try {
            if (! Schema::hasTable('jogadores') || ! Schema::hasColumn('jogadores', 'pin_hash')) {
                $erros[] = 'Banco sem a migração do PIN. Execute php artisan migrate --force no banco correto.';
            }
        } catch (Throwable) {
            $erros[] = 'Não foi possível acessar o banco; confira conexão, caminho e permissões.';
        }
        foreach (config('ko.lutadores') as $id => $lutador) {
            if ($lutador['pronto'] && (! isset($lutador['arte']) || ! is_file(public_path('img/elenco/'.$lutador['arte'])))) {
                $erros[] = 'Arte atual ausente: '.$id;
            }
        }
        foreach ($erros as $erro) {
            $this->error($erro);
        }
        if ($erros !== []) {
            return self::FAILURE;
        }
        $this->info('Configuração, migração do PIN e artes verificadas.');
        $this->line('Ainda é necessário testar /ws com dois jogadores e os aparelhos físicos. Este comando não testa a rede pública.');

        return self::SUCCESS;
    }
}
