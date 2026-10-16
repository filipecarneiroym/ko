const { test } = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../../public/js/ko-sim.js');

for (const lado of [0, 1]) for (const final of [false, true])
  test(`encerramento real da Lola: lado ${lado}, Final ${final}`, async () => {
    const { descreverPose } = await import('../../../src/3d/estado-visual.mjs');
    for (const golpe of ['p1', 'k1', 'ck', 'ap', 'dp', 'esp', 'ultra', 'agarrao', 'tempo']) {
      const s = K.novo({ lutadores: ['pipoca', 'pipoca'] });
      s.fase = 'luta'; s.fT = 0; s.rounds[lado] = 1;
      const a = s.p[lado], v = s.p[1 - lado], frente = a.face > 0 ? K.B.R : K.B.L;
      s.p[0].x = 150 * K.U; s.p[1].x = (golpe === 'esp' || golpe === 'ultra' ? 230 : 170) * K.U;
      v.vida = 1; a.poder = K.PODER_MAX; a.revanche = K.ULTRA_MAX;
      if (golpe === 'tempo') s.timer = 1;
      const fases = new Set(); let tentouFinal = false;
      for (let q = 0; q < 2500 && s.fase !== 'fim'; q++) {
        let bits = q === 0 ? { p1: K.B.P, k1: K.B.K, ck: K.B.D | K.B.K,
          ap: K.B.U, dp: frente | K.B.S, esp: K.B.S, ultra: K.B.S | K.B.F,
          agarrao: frente | K.B.P, tempo: 0 }[golpe] : golpe === 'ap' && q === 6 ? K.B.P : 0;
        if (final && s.fase === 'acaba' && !tentouFinal) { bits = K.B.S; tentouFinal = true; }
        const entrada = [0, 0]; entrada[lado] = bits;
        if (golpe === 'ap' && q === 0) entrada[1 - lado] = K.B.U;
        K.passo(s, entrada); fases.add(s.fase);
        for (const p of s.p) assert.ok([p.x, p.y, p.vx, p.vy, p.vida].every(Number.isFinite) && p.y >= 0 && p.vida >= 0);
      }
      assert.equal(s.fase, 'fim', `${golpe}: encerra sem travar`);
      assert.equal(s.vencedor, lado, `${golpe}: preserva o vencedor`);
      assert.ok(fases.has('ko') && fases.has('acaba'));
      assert.equal(!!s.finalFeito, final, `${golpe}: caminho com/sem Final`);
      assert.equal(s.fT, 0, 'relógio real ao chegar à tela de resultado');
      const antes = JSON.stringify(s), pose = descreverPose(v, K, s);
      assert.equal(pose.clip, 'derrotado');
      assert.ok(pose.quadro >= 60, `${golpe}: resultado congelado mantém a pose deitada, sem depender de outro passo`);
      assert.equal(descreverPose(a, K, s).quadro, 100, 'comemoração não fica presa na guarda');
      assert.equal(descreverPose(a, K, s, 0).quadro, 0);
      assert.equal(descreverPose(a, K, s, 75).quadro, 75, 'apresentação avança a comemoração sem passos do motor');
      assert.equal(JSON.stringify(s), antes, 'apresentação não muda a simulação');
    }
  });
