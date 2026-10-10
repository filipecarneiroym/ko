<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // No PC e nos testes, erro de atributo inexistente ou consulta N+1 aparece na hora.
        Model::shouldBeStrict(! $this->app->isProduction());
    }
}
