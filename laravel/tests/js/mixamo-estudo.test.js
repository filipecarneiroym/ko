const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('../../../scripts/producao-3d/gerar-estudo-mixamo.mjs'),
  import('../../../scripts/producao-3d/glb.mjs'),
  import('../../../src/producao3d/rig.mjs'),
  import('../../../src/producao3d/animacoes.mjs'),
  import('../../../src/3d/contrato-glb.mjs'),
]);

function guardaValida(ossos) {
  return {
    nome: 'parado', duracaoQuadros: 104,
    canais: [
      ...ossos.map((_, osso) => ({ osso, tipo: 'rotation', tempos: [0, 104 / 60], valores: [0, 0, 0, 1, 0, 0, 0, 1] })),
      { osso: 0, tipo: 'translation', tempos: [0, 104 / 60], valores: [0, 1, 0, 0, 1.02, 0] },
    ],
  };
}

test('guarda Mixamo substitui somente parado e preserva integralmente os outros 30 clips', async () => {
  const [{ substituirGuarda }, , { criarRig }, { criarAnimacoes }] = await modulos;
  const ossos = criarRig(), base = criarAnimacoes('pipoca', ossos, K), guarda = guardaValida(ossos);
  const original = JSON.stringify(base), origem = JSON.stringify(guarda);
  const resultado = substituirGuarda(base, guarda, ossos);
  assert.equal(resultado.length, 31);
  assert.deepEqual(resultado.map(c => c.nome), base.map(c => c.nome));
  assert.equal(resultado.find(c => c.nome === 'parado').duracaoQuadros, 104);
  for (const clip of base.filter(c => c.nome !== 'parado')) assert.equal(resultado.find(c => c.nome === clip.nome), clip);
  assert.equal(JSON.stringify(base), original, 'Não altera dados de origem');
  assert.equal(JSON.stringify(guarda), origem, 'Não altera o JSON extraído do Blender');
  assert.notEqual(resultado.find(c => c.nome === 'parado'), guarda, 'A guarda inserida tem cópia independente');
});

test('guarda rejeita perda de ossos, tempo deslocado, canais corrompidos e movimento horizontal', async () => {
  const [{ substituirGuarda }, , { criarRig }, { criarAnimacoes }] = await modulos;
  const ossos = criarRig(), base = criarAnimacoes('pipoca', ossos, K);
  const casos = [
    [g => { g.nome = 'p1'; }, /exclusivamente/],
    [g => { g.duracaoQuadros = 0; }, /duração/],
    [g => { g.canais.shift(); }, /todos os ossos/],
    [g => { g.canais.pop(); }, /quadril/],
    [g => { g.canais[0].tempos[0] = 1 / 60; }, /começar em zero/],
    [g => { g.canais[0].tempos[1] = 103 / 60; }, /duração declarada/],
    [g => { g.canais[0].valores[3] = 0; }, /quaternion/],
    [g => { g.canais[0].valores[0] = NaN; }, /não finito/],
    [g => { g.canais.push(g.canais[0]); }, /repetido/],
    [g => { g.canais[0].osso = 20; }, /fora do rig/],
    [g => { g.canais.at(-1).valores[3] = .1; }, /deslocamento horizontal/],
  ];
  for (const [corromper, esperado] of casos) {
    const guarda = guardaValida(ossos); corromper(guarda);
    assert.throws(() => substituirGuarda(base, guarda, ossos), esperado);
  }
});

test('GLB do estudo mantém o contrato real, a malha e os nomes dos 31 clips', async () => {
  const [{ criarEstudoMixamo }, { exportarGlb }, { criarRig }, { criarAnimacoes }, { validarGlb }] = await modulos;
  const dados = criarEstudoMixamo(guardaValida(criarRig()), K);
  const bytes = exportarGlb(dados);
  const doc = validarGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'pipoca', K);
  assert.equal(doc.animations.length, 31);
  assert.equal(doc.skins[0].joints.length, 20);
  assert.equal(doc.extras.aprovadoFinal, false);
  assert.equal(doc.extras.status, 'estudo-mixamo');
  assert.equal(doc.meshes.length, 1);
  assert.equal(doc.extensionsUsed, undefined);
  assert.equal(doc.buffers[0].uri, undefined);
  assert.deepEqual(dados.clips.filter(c => c.nome !== 'parado'), criarAnimacoes('pipoca', criarRig(), K).filter(c => c.nome !== 'parado'));
  const parado = doc.animations.find(a => a.name === 'parado');
  assert.equal(parado.extras.duracaoQuadros, 104);
  for (const canal of parado.channels) assert.ok(doc.skins[0].joints.includes(canal.target.node));
});

test('jab produzido preserva os demais 29 movimentos e segue a duração real do motor', async () => {
  const { criarEstudoJab } = await import('../../../scripts/producao-3d/gerar-estudo-jab.mjs');
  const [{ criarEstudoMixamo }] = await modulos;
  const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  const guarda=JSON.parse(fs.readFileSync(path.join(pasta,'guarda-v4.json')));
  const jab=JSON.parse(fs.readFileSync(path.join(pasta,'jab-v5.json')));
  const base=criarEstudoMixamo(guarda,K);
  const dados=criarEstudoJab(guarda,jab,K);
  assert.equal(dados.clips.length,31);
  assert.equal(dados.clips.find(c=>c.nome==='p1').duracaoQuadros,K.LUTADORES.pipoca.golpes.p1.dur);
  assert.deepEqual(dados.clips.filter(c=>!['parado','p1'].includes(c.nome)),base.clips.filter(c=>!['parado','p1'].includes(c.nome)));
  for(const [alterar,esperado] of [
    [j=>{j.duracaoQuadros++;},/Duração segue/],
    [j=>{j.canais.find(c=>c.osso===0&&c.tipo==='translation').valores[0]=.1;},/não desloca/],
    [j=>{j.canais.pop();},/20 ossos/],
  ]) {
    const corrompido=structuredClone(jab);alterar(corrompido);
    assert.throws(()=>criarEstudoJab(guarda,corrompido,K),esperado);
  }
});

test('soco forte mantém jab e outros 28 clips, sem perder guarda e tempos do motor', async () => {
  const { criarEstudoSocos } = await import('../../../scripts/producao-3d/gerar-estudo-socos.mjs');
  const { criarEstudoJab } = await import('../../../scripts/producao-3d/gerar-estudo-jab.mjs');
  const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  const ler=nome=>JSON.parse(fs.readFileSync(path.join(pasta,nome)));
  const guarda=ler('guarda-v4.json'),jab=ler('jab-v5.json'),forte=ler('soco-forte-v6.json');
  const base=criarEstudoJab(guarda,jab,K),dados=criarEstudoSocos(guarda,jab,forte,K);
  assert.equal(dados.clips.length,31);
  assert.equal(dados.clips.find(c=>c.nome==='p2').duracaoQuadros,K.LUTADORES.pipoca.golpes.p2.dur);
  assert.deepEqual(dados.clips.filter(c=>c.nome!=='p2'),base.clips.filter(c=>c.nome!=='p2'));
  const foraDaGuarda=structuredClone(forte);
  foraDaGuarda.canais.find(c=>c.osso===15&&c.tipo==='translation').valores[0]+=.1;
  assert.throws(()=>criarEstudoSocos(guarda,jab,foraDaGuarda,K),/guarda completa/);
  const tempoErrado=structuredClone(forte);tempoErrado.duracaoQuadros++;
  assert.throws(()=>criarEstudoSocos(guarda,jab,tempoErrado,K),/Duração segue/);
});

test('defesa mantém os demais 30 clips e rejeita emenda quebrada do ciclo', async () => {
  const { criarEstudoSocos } = await import('../../../scripts/producao-3d/gerar-estudo-socos.mjs');
  const { criarEstudoDefesa } = await import('../../../scripts/producao-3d/gerar-estudo-defesa.mjs');
  const pasta=path.resolve(__dirname,'../../../art/premium/modelos-3d/estudos-mixamo');
  const ler=nome=>JSON.parse(fs.readFileSync(path.join(pasta,nome)));
  const guarda=ler('guarda-v4.json'),jab=ler('jab-v5.json'),forte=ler('soco-forte-v6.json'),defesa=ler('defesa-v7.json');
  const base=criarEstudoSocos(guarda,jab,forte,K),dados=criarEstudoDefesa(guarda,jab,forte,defesa,K);
  assert.equal(dados.clips.length,31);
  assert.deepEqual(dados.clips.filter(c=>c.nome!=='defesa'),base.clips.filter(c=>c.nome!=='defesa'));
  const quebrada=structuredClone(defesa);
  quebrada.canais.find(c=>c.osso===9&&c.tipo==='translation').valores[0]+=.1;
  assert.throws(()=>criarEstudoDefesa(guarda,jab,forte,quebrada,K),/Ciclo de defesa fecha/);
});
