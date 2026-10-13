import assert from 'node:assert/strict';

const duracoes={agachado:60,defesaBaixa:60,pulo:44,pousando:4};

export function aplicarPosturasPipoca(dados,fonte) {
  assert.equal(fonte.versao,14,'Versão das posturas incompatível');
  assert.deepEqual(fonte.clips.map(c=>c.nome).sort(),Object.keys(duracoes).sort(),'Forneça as quatro posturas únicas');
  for(const clip of fonte.clips) {
    assert.equal(clip.duracaoQuadros,duracoes[clip.nome]);
    assert.equal(clip.canais.length,dados.ossos.length*2,'Postura deve descrever o rig completo');
    const alvos=new Set();
    for(const c of clip.canais) {
      assert.ok(Number.isInteger(c.osso)&&c.osso>=0&&c.osso<dados.ossos.length);
      assert.ok(['rotation','translation'].includes(c.tipo));
      const chave=`${c.osso}:${c.tipo}`;
      assert.ok(!alvos.has(chave),'Canal de postura repetido');alvos.add(chave);
      assert.equal(c.tempos.length,clip.duracaoQuadros*2+1,'Amostragem deve incluir meios quadros');
      c.tempos.forEach((t,i)=>assert.ok(Math.abs(t-i/120)<1e-8,'Relógio de postura inválido'));
      const n=c.tipo==='rotation'?4:3;
      assert.equal(c.valores.length,c.tempos.length*n);
      assert.ok(c.valores.every(Number.isFinite));
      if(n===4)for(let i=0;i<c.valores.length;i+=4)
        assert.ok(Math.abs(Math.hypot(...c.valores.slice(i,i+4))-1)<1e-5,'Quaternion de postura inválido');
    }
  }
  // A fonte já resolve o IK dos apoios; rotações adicionais quebram essa solução.
  const novas=new Map(fonte.clips.map(c => [c.nome, structuredClone(c)]));
  return {...dados,clips:dados.clips.map(c=>novas.get(c.nome)||c),extras:{...dados.extras,
    posturas:{versao:14,clips:[...novas.keys()],origem:'IK autoral sobre guarda v4',passoQuadros:.5,
      trajetoriaVerticalPertenceAoMotor:true,aprovadoFinal:false}}};
}
