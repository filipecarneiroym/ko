import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

export function criarEfeitos(scene, simulador, movimentoReduzido) {
  let cursor = 0;
  const pool = Array.from({ length: 12 }, (_, i) => {
    const malha = MeshBuilder.CreateTorus(`impacto-${i}`, { diameter: 1, thickness: .055, tessellation: 24 }, scene);
    const material = new StandardMaterial(`impacto-cor-${i}`, scene);
    material.disableLighting = true; malha.material = material;
    malha.rotation.x = Math.PI / 2; malha.setEnabled(false);
    return { malha, material, nascimento: -100, forte: 0 };
  });
  return {
    eventos(eventos, quadro) {
      for (const e of eventos) {
        if (!['acerto', 'defendeu'].includes(e.t)) continue;
        const item = pool[cursor++ % pool.length];
        item.nascimento = quadro; item.forte = e.forte || 0;
        item.malha.position.set((e.x / simulador.U - simulador.LARGURA / 2) / 24, e.y / simulador.U / 24, -.35);
        item.material.emissiveColor = Color3.FromHexString(e.t === 'defendeu' ? '#69d9ff' : '#ffcc55');
      }
    },
    atualizar(quadro) {
      for (const item of pool) {
        const idade = quadro - item.nascimento;
        item.malha.setEnabled(idade >= 0 && idade < 16);
        const tamanho = .3 + item.forte * .1 + (movimentoReduzido.matches ? 0 : idade * .04);
        item.malha.scaling.setAll(Math.max(.1, tamanho));
        item.material.alpha = Math.max(0, (1 - idade / 16) * .8);
      }
    },
    limpar() { for (const item of pool) { item.nascimento = -100; item.malha.setEnabled(false); } },
  };
}
