// Estudos de movimento: os tempos vêm do KSim, nunca de eventos do arquivo 3D.
import { ESTADOS_VISUAIS } from '../3d/estado-visual.mjs';

const clone = p => ({ r: Object.fromEntries(Object.entries(p.r).map(([n,v]) => [n,[...v]])), deslocamento: [...p.deslocamento] });
const ajustar = (p, rotacoes = {}, deslocamento = p.deslocamento) => ({ r: { ...clone(p).r, ...rotacoes }, deslocamento: [...deslocamento] });

export function quaternion([x = 0, y = 0, z = 0]) {
  const sx = Math.sin(x/2), cx = Math.cos(x/2), sy = Math.sin(y/2), cy = Math.cos(y/2), sz = Math.sin(z/2), cz = Math.cos(z/2);
  const q = [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz];
  const comprimento = Math.hypot(...q);
  return q.map(v => v / comprimento);
}

export function criarAnimacoes(id, ossos, simulador) {
  if (!['pipoca','uivo'].includes(id)) throw new Error('Estudo de animação sem personagem definido.');
  const lobo = id === 'uivo', escala = lobo ? 1.1 : 1;
  const guarda = { r: {
    tronco: [0,0,-.06], peito: [0,lobo ? -.08 : -.13,.06], cabeca: [0,.06,0],
    braco_E: [.24,0,lobo ? .82 : 1.03], antebraco_E: [.20,0,lobo ? 1.21 : 1.37], mao_E: [0,0,-.12],
    braco_D: [-.24,0,.94], antebraco_D: [-.20,0,1.29], mao_D: [0,0,-.12],
    orelha_E: [0,0,lobo ? -.08 : -.12], orelha_D: [0,0,.08], cauda: [0,0,.08],
  }, deslocamento: [0,0,0] };
  // Corrige a simetria restante do agachado: a perna que parecia para trás passa a puxar
  // a parte inferior para frente do quadril, mantendo o short e a cintura compactos.
  const baixo = ajustar(guarda, {
    quadril:[0,0,.04],
    coxa_E:[0,0,-.72],
    coxa_D:[0,0,.72],
    canela_E:[0,0,-1.10],
    canela_D:[0,0,-1.10],
    pe_E:[0,0,-.48],
    pe_D:[0,0,.48],
    tronco:[0,0,-.10],
  }, [0,-.22,0]);
  const deitado = ajustar(guarda, { quadril:[0,0,-Math.PI/2], tronco:[0,0,.05],braco_E:[.1,0,.1],braco_D:[-.1,0,.1],antebraco_E:[0,0,.25],antebraco_D:[0,0,.25],coxa_E:[0,0,.1],coxa_D:[0,0,.1] }, [0,-.73,0]);
  function forcarSimetriaPernas(p) {
    for (const [esquerda, direita] of [['coxa_E','coxa_D'], ['canela_E','canela_D'], ['pe_E','pe_D']]) {
      const esquerdaV = p.r[esquerda] || [0,0,0];
      const direitaV = p.r[direita] || [0,0,0];
      const modulo = Math.max(Math.abs(esquerdaV[2]), Math.abs(direitaV[2]), 0.12);
      const referencia = Math.abs(esquerdaV[2]) >= Math.abs(direitaV[2]) ? esquerdaV : direitaV;
      const sinal = referencia[2] >= 0 ? -1 : 1;
      p.r[esquerda] = [0, 0, -modulo * (referencia[2] === 0 ? 1 : Math.sign(referencia[2]))];
      p.r[direita] = [0, 0, modulo * (referencia[2] === 0 ? 1 : Math.sign(referencia[2]))];
      p.r[esquerda][0] = Math.abs(esquerdaV[0]) <= 1e-6 ? 0 : esquerdaV[0];
      p.r[esquerda][1] = Math.abs(esquerdaV[1]) <= 1e-6 ? 0 : esquerdaV[1];
      p.r[direita][0] = Math.abs(direitaV[0]) <= 1e-6 ? 0 : direitaV[0];
      p.r[direita][1] = Math.abs(direitaV[1]) <= 1e-6 ? 0 : direitaV[1];
      if (esquerda === 'pe_E' || esquerda === 'pe_D') {
        p.r[esquerda][2] = -Math.abs(modulo) * (sinal > 0 ? 1 : -1);
        p.r[direita][2] = Math.abs(modulo) * (sinal > 0 ? 1 : -1);
      }
    }
    return p;
  }
  const clips = [];
  function clip(nome, duracaoQuadros, chaves) {
    const frames = [...chaves].sort((a,b) => a[0]-b[0]).map(([q,p]) => [q, forcarSimetriaPernas(clone(p))]);
    if (frames[0]?.[0] !== 0 || frames.at(-1)?.[0] !== duracaoQuadros || frames.some((f,i) => i && f[0] <= frames[i-1][0])) throw new Error(`Quadros inválidos: ${nome}`);
    const tempos = frames.map(([q]) => q/60);
    const canais = ossos.map((osso,indice) => ({ osso:indice,tipo:'rotation',tempos,valores:frames.flatMap(([,p]) => quaternion(p.r[osso.nome] || [0,0,0])) }));
    const quadril = ossos.findIndex(o => o.nome === 'quadril');
    canais.push({ osso:quadril,tipo:'translation',tempos,valores:frames.flatMap(([,p]) => ossos[quadril].posicao.map((v,i) => v+p.deslocamento[i]*escala)) });
    clips.push({ nome,duracaoQuadros,canais });
  }
  const respirando = (q,d) => {
    const onda = Math.sin(q/d*Math.PI*2), p = clone(guarda);
    p.r.peito = [0,-.1,.035*onda]; p.r.orelha_E = [0,.025*onda,-.10+.045*onda];
    p.r.orelha_D = [0,-.02*onda,.06-.035*onda]; p.r.cauda = [.08*onda,0,.08];
    p.r.antebraco_E[2] += .035*onda; p.r.antebraco_D[2] -= .035*onda;
    return p;
  };
  clip('parado',72,[0,18,36,54,72].map(q => [q,respirando(q,72)]));
  for (const [nome,d,amplitude] of [['andando',40,.38],['corrida',24,.72]]) {
    clip(nome,d,[0,d/4,d/2,d*3/4,d].map(q => {
      const onda = Math.sin(q/d*Math.PI*2), p = clone(guarda);
      p.r.coxa_E = [0,0,onda*amplitude]; p.r.coxa_D = [0,0,-onda*amplitude];
      p.r.canela_E = [0,0,-Math.max(0,-onda)*amplitude*.7]; p.r.canela_D = [0,0,-Math.max(0,onda)*amplitude*.7];
      p.r.pe_E = [0,0,-onda*amplitude*.6]; p.r.pe_D = [0,0,onda*amplitude*.6];
      p.r.tronco = [0,0,nome === 'corrida' ? -.16 : -.06];
      p.r.peito = [0,.10*onda,0]; return [q,p];
    }));
  }
  clip('agachado',60,[[0,baixo],[30,ajustar(baixo,{cabeca:[0,0,.025]})],[60,baixo]]);
  // Mantém o rolamento e as poses curtas em espelho estrito: cada lado recebe o mesmo
  // módulo e sinal oposto para não empurrar a perna para o lado errado.
  const encolhido = ajustar(guarda,{
    coxa_E:[0,0,-1.1], coxa_D:[0,0,1.1],
    canela_E:[0,0,-1.25], canela_D:[0,0,1.25],
    pe_E:[0,0,-.48], pe_D:[0,0,.48],
    orelha_E:[0,0,-.25], orelha_D:[0,0,.25],
  });
  clip('pulo',44,[[0,guarda],[10,encolhido],[26,encolhido],[44,guarda]]);
  clip('pousando',4,[[0,ajustar(baixo,{},[0,-.12,0])],[4,guarda]]);
  const protegendo = ajustar(guarda,{braco_E:[.30,0,1.23],braco_D:[-.30,0,1.23],antebraco_E:[.10,0,1.53],antebraco_D:[-.10,0,1.53],cabeca:[0,0,.1]});
  clip('defesa',60,[[0,protegendo],[30,ajustar(protegendo,{peito:[0,0,.02]})],[60,protegendo]]);
  const defesaBaixa = ajustar(baixo,protegendo.r);
  clip('defesaBaixa',60,[[0,defesaBaixa],[60,defesaBaixa]]);
  const dano = ajustar(guarda,{tronco:[0,0,.32],cabeca:[0,0,.25],braco_E:[.3,0,.4],braco_D:[-.3,0,.55]});
  clip('dano',30,[[0,dano],[7,ajustar(dano,{tronco:[0,0,.22]})],[30,guarda]]);
  clip('caido',46,[[0,dano],[12,ajustar(deitado,{quadril:[0,0,-1.1]},[0,-.45,0])],[25,deitado],[46,deitado]]);
  clip('levantando',16,[[0,deitado],[8,baixo],[16,guarda]]);
  clip('rolando',24,[0,6,12,18,24].map(q => [q,ajustar(encolhido,{quadril:[0,0,-q/24*Math.PI*2]},[0,-.25,0])]));
  clip('recuo',18,[[0,guarda],[6,ajustar(guarda,{tronco:[0,0,.2],coxa_E:[0,0,-.35],coxa_D:[0,0,.25]})],[18,guarda]]);
  clip('quebra',16,[[0,baixo],[5,ajustar(guarda,{braco_E:[.4,0,2],braco_D:[-.4,0,2],antebraco_E:[0,0,-.8],antebraco_D:[0,0,-.8]})],[16,guarda]]);
  const alcancando = ajustar(guarda,{braco_E:[.1,0,1.5],braco_D:[-.1,0,1.5],antebraco_E:[0,0,.1],antebraco_D:[0,0,.1],tronco:[0,0,-.12]});
  clip('agarrando',30,[[0,guarda],[5,alcancando],[10,ajustar(alcancando,{peito:[0,-.5,.05]})],[20,ajustar(alcancando,{peito:[0,.5,.08]})],[30,guarda]]);
  clip('agarrado',30,[[0,dano],[10,ajustar(dano,{quadril:[0,0,-.25]})],[30,deitado]]);
  clip('tonto',60,[0,15,30,45,60].map(q => [q,ajustar(guarda,{cabeca:[.12*Math.sin(q/60*Math.PI*2),0,.15],braco_E:[.1,0,.1],braco_D:[-.1,0,.1],antebraco_E:[0,0,.1],antebraco_D:[0,0,.1],tronco:[0,0,.08*Math.sin(q/60*Math.PI*2)]})]));
  const celebrando = ajustar(guarda,{braco_E:[.1,0,2.8],braco_D:[-.1,0,lobo ? 2.8 : 1.03],antebraco_E:[0,0,.3],antebraco_D:[0,0,lobo ? .3 : 1.37],cabeca:[0,0,lobo ? .38 : 0],mandibula:[0,0,lobo ? -.35 : 0]});
  clip('vitoria',100,[[0,guarda],[24,celebrando],[100,celebrando]]);
  clip('derrotado',100,[[0,guarda],[25,baixo],[60,deitado],[100,deitado]]);
  clip('final',200,[[0,guarda],[25,alcancando],[70,celebrando],[130,celebrando],[170,guarda],[200,celebrando]]);
  clip('vitimaFinal',200,[[0,dano],[40,ajustar(dano,{cabeca:[0,.3,.3]})],[100,deitado],[200,deitado]]);

  function golpePose(nome, contato = 0) {
    const p = clone(['cp','ck'].includes(nome) ? baixo : guarda);
    const forte = ['p2','k2'].includes(nome), lado = contato % 2 ? 'D' : 'E';
    if (['p1','p2','cp','ap'].includes(nome)) {
      p.r[`braco_${lado}`] = [0,forte ? .10 : 0,1.55]; p.r[`antebraco_${lado}`] = [0,0,-.05]; p.r[`mao_${lado}`] = [0,0,0];
      p.r.peito = [0,lado === 'E' ? .18 : -.18,-.05];
    } else {
      p.r[`coxa_${lado}`] = [0,0,nome === 'ck' ? .9 : forte ? 1.85 : 1.45];
      p.r[`canela_${lado}`] = [0,0,nome === 'ck' ? .3 : -.08];
      p.r[`pe_${lado}`] = [0,0,forte ? -.7 : -.3]; p.r.tronco = [0,0,forte ? .20 : .10];
    }
    if (['ap','ak'].includes(nome)) Object.assign(p.r,{coxa_D:[0,0,.6],canela_D:[0,0,-1.0]});
    return p;
  }
  // dp (Shoryuken da Pipoca) não tem clipe na base v13: o clipe dele é feito à mão na v5.
  const golposBase = Object.entries(simulador.LUTADORES[id].golpes).filter(([nome]) => nome !== 'dp');
  for (const [nome,golpe] of golposBase) {
    const d = golpe.dur, chaves = new Map([[0,guarda],[d,guarda]]);
    const inserir = (q,p) => chaves.set(Math.max(0,Math.min(d,q)),p);
    if (nome === 'esp') {
      if (lobo) {
        const uivando = ajustar(guarda,{cabeca:[0,0,.42],mandibula:[0,0,-.48],braco_E:[.35,0,.2],braco_D:[-.35,0,.2],antebraco_E:[0,0,.55],antebraco_D:[0,0,.55],peito:[0,0,.06]});
        inserir(8,ajustar(baixo,{},[0,-.1,0])); inserir(12,uivando); inserir(18,uivando); inserir(d-5,guarda);
      } else {
        inserir(5,ajustar(guarda,{braco_E:[.2,-.2,-.1],antebraco_E:[0,0,1.2],peito:[0,-.2,0]}));
        inserir(10,golpePose('p1')); inserir(14,golpePose('p1')); inserir(d-5,guarda);
      }
    } else if (nome === 'sup') {
      if (lobo) {
        for (const [i,[de,ate]] of golpe.janelas.map(h => [h.de,h.ate]).entries()) {
          inserir(de-2,ajustar(baixo,{peito:[0,i%2 ? -.4 : .4,0]}));
          const p = golpePose('p2',i); p.r[`mao_${i%2 ? 'D' : 'E'}`] = [0,.25,.25]; inserir(de,p); inserir(ate,p); inserir(ate+2,guarda);
        }
      } else {
        inserir(5,baixo); inserir(8,ajustar(baixo,{},[0,-.45,0])); inserir(42,baixo);
        const uppercut = ajustar(guarda,{braco_E:[0,0,2.5],antebraco_E:[0,0,.10],mao_E:[0,0,0],tronco:[0,0,.05],coxa_E:[0,0,.45],canela_E:[0,0,-.55]});
        inserir(44,uppercut); inserir(50,uppercut); inserir(d-3,guarda);
      }
    } else {
      if (['cp','ck'].includes(nome)) inserir(0,baixo);
      for (const [i,h] of golpe.janelas.entries()) {
        inserir(Math.max(1,h.de-1),ajustar(['cp','ck'].includes(nome) ? baixo : guarda,{peito:[0,-.15,0]}));
        inserir(h.de,golpePose(nome,i)); inserir(h.ate,golpePose(nome,i)); inserir(h.ate+2,['cp','ck'].includes(nome) ? baixo : guarda);
      }
    }
    clip(nome,d,[...chaves]);
  }
  const esperados = [...ESTADOS_VISUAIS,...golposBase.map(([nome]) => nome)];
  if (clips.length !== esperados.length || esperados.some(n => !clips.some(c => c.nome === n))) throw new Error('Clips incompletos.');
  return clips;
}
