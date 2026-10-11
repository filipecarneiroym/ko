<?php
// Empacota renders locais em GIF; não requer bibliotecas adicionais ao GD.
declare(strict_types=1);
$raiz = dirname(__DIR__, 2);
$pasta = $raiz . '/art/premium/modelos-3d/estudos-mixamo';
$modo = $argv[1] ?? 'guarda';
function quadrosDaPrevia(string $modo, string $pasta): array {
    if ($modo === 'corpo') {
        $diretorio = $pasta . '/previa-corpo-v10';
        $manifesto = json_decode(file_get_contents($diretorio . '/quadros.json'), true, flags: JSON_THROW_ON_ERROR);
        if (count($manifesto['quadros']) !== 102) throw new RuntimeException('Prévia do corpo incompleta.');
        $modelo = dirname(__DIR__, 2) . '/public/modelos/estudos/pipoca-corpo-v10.glb';
        if (($manifesto['sha256Glb'] ?? null) !== hash_file('sha256', $modelo)) throw new RuntimeException('Renderize novamente a prévia: o GLB foi alterado.');
        return array_map(static fn($q, $i) => ['caminho' => $diretorio . '/' . sprintf('%03d.png', $i), 'atraso' => $q['atraso']], $manifesto['quadros'], array_keys($manifesto['quadros']));
    }
    [$diretorio, $esperados, $duracao, $ciclico] = match ($modo) {
        'guarda' => ['previa-v4', 16, 104 / 60, false],
        'jab' => ['previa-jab-v5', 13, .6, true],
        'forte' => ['previa-soco-forte-v6', 19, .9, true],
        'defesa' => ['previa-defesa-v7', 17, 1.83, false],
        'reacao' => ['previa-reacao-v8', 13, .65, false],
        'marcha' => ['previa-marcha-v9', 13, .6, true],
        'chutes' => ['previa-chute-v11', 25, 24 / 60, false],
        'chute-forte' => ['previa-chute-forte-v12', 29, 28 / 60, false],
        default => throw new InvalidArgumentException('Prévia desconhecida.'),
    };
    $caminhos = glob($pasta . '/' . $diretorio . '/[0-9][0-9][0-9].png');
    sort($caminhos, SORT_STRING);
    if (count($caminhos) !== $esperados) throw new RuntimeException('A prévia requer todos os renders PNG de ' . $modo . '.');
    if ($ciclico) array_pop($caminhos);
    $quadros = [];
    $quantidade = count($caminhos);
    foreach ($caminhos as $i => $caminho) {
        $atraso = (int) round(($i + 1) * $duracao / $quantidade * 100)
                - (int) round($i * $duracao / $quantidade * 100);
        if (in_array($modo, ['jab', 'forte', 'chutes', 'chute-forte'], true) && $i === 0) $atraso += 30;
        if ($modo === 'reacao' && $i === $quantidade - 1) $atraso += 30;
        if ($modo === 'defesa') {
            // Guarda, 1s de defesa e saída ampliada para leitura.
            $atraso = $i === 0 ? 35 : ($i <= 12
                ? (int) round($i * 100 / 12) - (int) round(($i - 1) * 100 / 12) : 12);
        }
        $quadros[] = ['caminho' => $caminho, 'atraso' => $atraso];
    }
    return $quadros;
}
$quadros = [];
foreach ($modo === 'vida' ? ['guarda', 'jab', 'forte', 'defesa', 'reacao', 'marcha'] : [$modo] as $parte) {
    $quadros = array_merge($quadros, quadrosDaPrevia($parte, $pasta));
    if ($parte === 'marcha') $quadros = array_merge($quadros, quadrosDaPrevia($parte, $pasta));
}
$quantidade = count($quadros);
function u16(string $dados, int $posicao): int {
    return unpack('v', substr($dados, $posicao, 2))[1];
}
function saltarBlocos(string $dados, int &$p): void {
    do {
        if ($p >= strlen($dados)) throw new RuntimeException('GIF truncado.');
        $n = ord($dados[$p++]);
        $p += $n;
    } while ($n > 0);
}
$saida = '';
$dimensoes = null;
foreach ($quadros as $indice => $quadro) {
    $imagem = imagecreatefrompng($quadro['caminho']);
    if (!$imagem) throw new RuntimeException('PNG não pôde ser lido.');
    imagetruecolortopalette($imagem, true, 256);
    ob_start();
    imagegif($imagem);
    $gif = ob_get_clean();
    imagedestroy($imagem);
    if (substr($gif, 0, 3) !== 'GIF') throw new RuntimeException('Falha na codificação GD.');
    $atual = [u16($gif, 6), u16($gif, 8)];
    if ($dimensoes !== null && $atual !== $dimensoes) throw new RuntimeException('Dimensões inconsistentes.');
    $dimensoes = $atual;
    $flags = ord($gif[10]);
    $tamanhoPaleta = ($flags & 0x80) ? 3 * (1 << (($flags & 7) + 1)) : 0;
    $paleta = substr($gif, 13, $tamanhoPaleta);
    $p = 13 + $tamanhoPaleta;
    if ($indice === 0) {
        $saida = 'GIF89a' . substr($gif, 6, 7) . $paleta;
        $saida .= "\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00";
    }
    while ($p < strlen($gif) && $gif[$p] === "\x21") {
        $p += 2;
        saltarBlocos($gif, $p);
    }
    if (($gif[$p] ?? '') !== "\x2C") throw new RuntimeException('Descritor de imagem GIF ausente.');
    $descritor = substr($gif, $p, 10);
    $p += 10;
    $local = ord($descritor[9]);
    if ($local & 0x80) {
        $n = 3 * (1 << (($local & 7) + 1));
        $tabela = substr($gif, $p, $n);
        $p += $n;
    } else {
        if (!$tamanhoPaleta) throw new RuntimeException('Paleta GIF ausente.');
        $descritor[9] = chr(($local & 0x78) | 0x80 | ($flags & 7));
        $tabela = $paleta;
    }
    $inicioDados = $p++;
    saltarBlocos($gif, $p);
    $saida .= "\x21\xF9\x04\x04" . pack('v', $quadro['atraso']) . "\x00\x00";
    $saida .= $descritor . $tabela . substr($gif, $inicioDados, $p - $inicioDados);
}
$saida .= "\x3B";
$nome = match ($modo) {
    'guarda' => 'pipoca-guarda-v4.gif', 'jab' => 'pipoca-jab-v5-lento.gif',
    'forte' => 'pipoca-soco-forte-v6-lento.gif', 'defesa' => 'pipoca-defesa-v7.gif',
    'reacao' => 'pipoca-reacao-v8-lento.gif', 'marcha' => 'pipoca-marcha-v9-lento.gif',
    'chutes' => 'pipoca-chutes-v11-lento.gif', 'chute-forte' => 'pipoca-chute-forte-v12-lento.gif',
    'vida' => 'pipoca-movimentos-v9.gif',
    'corpo' => 'pipoca-corpo-v10-movimentos.gif',
};
$destino = $pasta . '/' . $nome;
file_put_contents($destino, $saida);
if (getimagesize($destino)[0] !== $dimensoes[0]) throw new RuntimeException('GIF final inválido.');
echo 'Prévia GIF: ' . $quantidade . ' quadros, ' . implode('x', $dimensoes) . ', ' . strlen($saida) . ' bytes.' . PHP_EOL;
