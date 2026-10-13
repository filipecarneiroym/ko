const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
const ler=n=>JSON.parse(fs.readFileSync(path.join(pasta,n)));

test('posturas reais mantêm apoio, joelhos e volume acima do piso, nas duas faces, e fecham os ciclos',async()=> {
  const {verificarPosturas}=await import('../../../scripts/producao-3d/verificar-posturas-pipoca.mjs');
  const bytes=fs.readFileSync(path.resolve(pasta,'../../../../public/modelos/estudos/pipoca-direcao-visual-v13.glb'));
  const resultado=await verificarPosturas(bytes);
  assert.equal(resultado.amostras,1352);
  assert.ok(resultado.resultados.every(r=>r.erroApoio<.001));
  assert.ok(resultado.resultados.every(r=>r.volumeMinimo>=-.001&&r.joelhoMinimo>=.15));
});

test('posturas incompletas e relógios incompatíveis são rejeitados sem alterar as fontes',async()=> {
  const {aplicarPosturasPipoca}=await import('../../../src/producao3d/pipoca-posturas.mjs');
  const {criarRig}=await import('../../../src/producao3d/rig.mjs');
  const fonte=ler('posturas-v14.json'),antes=JSON.stringify(fonte);
  const dados={ossos:criarRig(),clips:fonte.clips.map(c=>({...c})),extras:{aprovadoFinal:false}};
  const novo=aplicarPosturasPipoca(dados,fonte);
  assert.equal(JSON.stringify(fonte),antes);
  assert.notEqual(novo.clips[0],fonte.clips[0]);
  assert.deepEqual(novo.clips,fonte.clips,'A integração preserva os canais autorais de IK, incluindo os apoios de agachado e defesa baixa');
  const incompleta=structuredClone(fonte);incompleta.clips[0].canais.pop();
  assert.throws(()=>aplicarPosturasPipoca(dados,incompleta),/rig completo/);
  const relogio=structuredClone(fonte);relogio.clips[0].canais[0].tempos[1]=.1;
  assert.throws(()=>aplicarPosturasPipoca(dados,relogio),/Relógio/);
});
