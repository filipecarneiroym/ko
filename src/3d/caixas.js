import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export function criarCaixas(scene, simulador) {
  const material = new StandardMaterial('alcance-real', scene);
  material.emissiveColor = Color3.FromHexString('#65ffcb'); material.disableLighting = true; material.wireframe = true;
  const pool = Array.from({ length: 10 }, (_, i) => {
    const mesh = MeshBuilder.CreateBox(`caixa-${i}`, { size: 1 }, scene);
    mesh.material = material; mesh.setEnabled(false); return mesh;
  });
  return {
    atualizar(estado, exibir) {
      let cursor = 0;
      const mostrar = caixa => {
        const mesh = pool[cursor++]; if (!mesh) return;
        mesh.setEnabled(true);
        mesh.scaling.set(caixa.w / simulador.U / 24, caixa.h / simulador.U / 24, .06);
        mesh.position.set(((caixa.x + caixa.w / 2) / simulador.U - simulador.LARGURA / 2) / 24, (caixa.y + caixa.h / 2) / simulador.U / 24, -.4);
      };
      if (exibir) for (const p of estado.p) {
        if (!p.sumido) mostrar(simulador.corpo(p));
        const golpe = p.estado === 'golpe' && simulador.LUTADORES[p.id].golpes[p.golpe];
        for (const j of golpe?.janelas || []) if (p.t >= j.de && p.t <= j.ate) mostrar(simulador.caixaHit(p, j.caixa));
      }
      for (let i = cursor; i < pool.length; i++) pool[i].setEnabled(false);
    },
  };
}
