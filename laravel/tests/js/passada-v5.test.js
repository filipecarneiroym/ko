const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../../../public/js/ko-sim.js');
const modulos = Promise.all([
  import('@babylonjs/core/Engines/nullEngine.js'),
  import('@babylonjs/core/scene.js'),
  import('../../../src/3d/modelo-glb.js'),
  import('@babylonjs/core/Maths/math.vector.js'),
]);

for (const cor of ['azul', 'vermelha']) {
  test(`passada v5 ${cor}: apoio ancorado em ambos os sentidos, independente do relógio e FPS`, async t => {
    const [{ NullEngine }, { Scene }, { carregarModelo }, { Vector3 }] = await modulos;
    const bytes = fs.readFileSync(path.resolve(__dirname, `../../../public/modelos/estudos/pipoca-v5-${cor}.glb`));
    const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.ok(doc.extras.marcha.distanciaCiclo > 0, 'GLB jogável publica a calibração');
    const distancia = doc.extras.marcha.distanciaCiclo;
    let maiorErro = 0;
    for (const face of [1, -1]) for (const velocidade of [K.LUTADORES.pipoca.andar, -K.LUTADORES.pipoca.tras]) {
      const engine = new NullEngine(), scene = new Scene(engine);
      const modelo = await carregarModelo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), 'pipoca', K, scene);
      try {
        const ancoras = new Map();
        const atualizar = q => modelo.atualizar({ clip: 'andando', quadro: 1000 + q * 7,
          ciclico: true, x: face * velocidade / (K.U * 24) * q, y: 0, face, visivel: true });
        for (let i = 0; i <= 192; i++) {
          const q = i / 4; atualizar(q);
          if (i % 24 === 0) for (const mesh of scene.meshes.filter(m => m.getTotalVertices() && m.skeleton)) {
            mesh.computeWorldMatrix(true); mesh.skeleton.prepare(true);
            const vertices = mesh.getPositionData(true, false);
            let minY = Infinity;
            for (let j = 0; j < vertices.length; j += 3) minY = Math.min(minY,
              Vector3.TransformCoordinates(Vector3.FromArray(vertices, j), mesh.getWorldMatrix()).y);
            assert.ok(minY >= -.005, `malha da passada acima do piso: ${minY} m`);
          }
          for (const [lado, atraso] of [['E', 6], ['D', 18]]) {
            const continua = velocidade / (K.U * 24) * q / distancia * 24 + atraso;
            const fase = ((continua % 24) + 24) % 24;
            if (fase > 12 + 1e-8) continue;
            const no = modelo.osso(`pe_${lado}`);
            for (const n of [no.parent.parent.parent, no.parent.parent, no.parent, no]) n.computeWorldMatrix(true);
            const pos = no.getAbsolutePosition().clone();
            const chave = `${lado}:${Math.floor(continua / 24 + 1e-8)}`;
            if (!ancoras.has(chave)) ancoras.set(chave, pos);
            const erro = pos.subtract(ancoras.get(chave)).length();
            maiorErro = Math.max(maiorErro, erro);
            assert.ok(erro < .002, `pé ${lado} apoiado sem deslizar, face ${face}, velocidade ${velocidade}, q ${q}: ${erro} m`);
          }
        }
        const pose = scene.skeletons[0].bones.map(b => b.getTransformNode().rotationQuaternion.asArray());
        atualizar(48); atualizar(48);
        assert.deepEqual(scene.skeletons[0].bones.map(b => b.getTransformNode().rotationQuaternion.asArray()), pose,
          'sem deslocamento a animação congela, mesmo com chamadas repetidas');
        modelo.atualizar({ clip: 'parado', quadro: 1000, ciclico: true, x: 0, y: 0, face, visivel: true });
        for (const q of [0, 4, 11, 12, 20, 37, 48]) atualizar(q);
        const irregular = scene.skeletons[0].bones.map(b => b.getTransformNode().rotationQuaternion.asArray());
        assert.ok(irregular.every((r, i) => r.every((v, j) => Math.abs(v - pose[i][j]) < 1e-5)),
          'renderizar poucos quadros, em intervalos irregulares, chega à mesma pose');
      } finally { modelo.descartar(); scene.dispose(); engine.dispose(); }
    }
    t.diagnostic(`Maior deslizamento durante apoio: ${(maiorErro * 1000).toFixed(3)} mm`);
  });
}
