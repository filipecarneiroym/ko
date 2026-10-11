import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { criarEstudoJab, substituirSoco } from './gerar-estudo-jab.mjs';
import { exportarGlb } from './glb.mjs';
import { validarGlb } from '../../src/3d/contrato-glb.mjs';

const raiz=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function criarEstudoSocos(guarda,jab,forte,simulador) {
  const dados=substituirSoco(criarEstudoJab(guarda,jab,simulador),forte,'p2',simulador);
  // Os dois socos começam e terminam na mesma guarda, incluindo todos os ossos.
  for(const clip of [jab,forte])for(const canal of clip.canais) {
    const referencia=guarda.canais.find(c=>c.osso===canal.osso&&c.tipo===canal.tipo);
    assert.ok(referencia,'Canal presente na guarda');
    const tamanho=canal.tipo==='rotation'?4:3;
    for(const valores of [canal.valores.slice(0,tamanho),canal.valores.slice(-tamanho)]) {
      const alvo=referencia.valores.slice(0,tamanho);
      const sinal=canal.tipo==='rotation'&&valores.reduce((s,v,i)=>s+v*alvo[i],0)<0?-1:1;
      assert.ok(valores.every((v,i)=>Math.abs(sinal*v-alvo[i])<.001),'Soco começa e termina na guarda completa');
    }
  }
  dados.extras.status='estudo-guarda-dois-socos';
  dados.extras.animacoes='Guarda refinada, jab e soco forte por IK; demais 28 clips preservados.';
  return dados;
}
export function gerarEstudoSocos() {
  const pasta=resolve(raiz,'art/premium/modelos-3d/estudos-mixamo');
  const ler=nome=>JSON.parse(readFileSync(resolve(pasta,nome)));
  const guarda=ler('guarda-v4.json'),jab=ler('jab-v5.json'),forte=ler('soco-forte-v6.json');
  const K=createRequire(import.meta.url)('../../public/js/ko-sim.js');
  const shaSim=createHash('sha256').update(readFileSync(resolve(raiz,'public/js/ko-sim.js'))).digest('hex');
  for(const [arquivo,nome] of [['jab-relatorio-v5.json','p1'],['soco-forte-relatorio-v6.json','p2']]) {
    const origem=ler(arquivo);
    assert.equal(origem.sha256Simulacao,shaSim,'Fonte de tempos atual');
    assert.deepEqual(origem.janelaContato,K.LUTADORES.pipoca.golpes[nome].janelas.map(j=>[j.de,j.ate])[0]);
  }
  const dados=criarEstudoSocos(guarda,jab,forte,K),bytes=exportarGlb(dados);
  const doc=validarGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'pipoca',K);
  assert.equal(doc.animations.length,31);
  const caminho='public/modelos/estudos/pipoca-socos-v6.glb';
  writeFileSync(resolve(raiz,caminho),bytes);
  const relatorio={aprovadoFinal:false,caminho,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    clips:31,substituidos:['parado','p1','p2'],guardaCompletaNasExtremidades:true,
    golpes:[jab,forte].map(c=>({nome:c.nome,duracaoQuadros:c.duracaoQuadros,contato:K.LUTADORES.pipoca.golpes[c.nome].janelas.map(j=>[j.de,j.ate])})),
    preservados:dados.clips.filter(c=>!['parado','p1','p2'].includes(c.nome)).map(c=>c.nome),
    limites:['Arte provisória e pesos rígidos.','Transição p1→p2 suavizada até o quadro 4; outras transições pendentes.']};
  writeFileSync(resolve(pasta,'integracao-v6.json'),JSON.stringify(relatorio,null,2)+'\n');
  console.log(JSON.stringify(relatorio));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)gerarEstudoSocos();
