export function criarRig(escala = 1) {
  const ossos = [];
  function osso(nome, pai, mundo) {
    const p = pai === null ? [0,0,0] : ossos[pai].mundo;
    const posicaoMundo = mundo.map(v => v * escala);
    const indice = ossos.length;
    ossos.push({ nome, pai, posicao: posicaoMundo.map((v,i) => v - p[i]), mundo: posicaoMundo }); return indice;
  }
  const quadril = osso('quadril', null, [0,1,0]);
  const tronco = osso('tronco', quadril, [0,1.42,0]);
  const peito = osso('peito', tronco, [0,1.82,0]);
  const cabeca = osso('cabeca', peito, [0,2.18,0]);
  osso('mandibula', cabeca, [.19,2.10,0]);
  osso('orelha_E', cabeca, [-.04,2.44,-.16]); osso('orelha_D', cabeca, [-.04,2.44,.16]);
  for (const [lado, sinal] of [['E',-1],['D',1]]) {
    const braco = osso(`braco_${lado}`, peito, [0,1.82,.43*sinal]);
    const antebraco = osso(`antebraco_${lado}`, braco, [.10,1.36,.62*sinal]);
    osso(`mao_${lado}`, antebraco, [.20,.98,.72*sinal]);
    const coxa = osso(`coxa_${lado}`, quadril, [0,.98,.20*sinal]);
    const canela = osso(`canela_${lado}`, coxa, [.03,.53,.23*sinal]);
    osso(`pe_${lado}`, canela, [0,.12,.24*sinal]);
  }
  osso('cauda', quadril, [-.20,1.02,0]);
  return ossos;
}
