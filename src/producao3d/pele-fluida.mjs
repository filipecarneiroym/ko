// Superfícies de anéis compartilhados; mantém o mesmo repouso e rig do estudo.
const somar = (a, b) => a.map((v, i) => v + b[i]);
const subtrair = (a, b) => a.map((v, i) => v - b[i]);
const escalar = (a, s) => a.map(v => v * s);
const produto = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cruzar = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function normalizar(a) {
  const tamanho = Math.hypot(...a);
  if (tamanho < 1e-10) throw new Error('Vetor nulo na superfície fluida.');
  return escalar(a, 1 / tamanho);
}

function influencia(anel) {
  if (!Array.isArray(anel.ossos) || !Array.isArray(anel.pesos) || anel.ossos.length !== anel.pesos.length || ![1, 2].includes(anel.ossos.length)) throw new Error('Defina uma ou duas influências por anel.');
  if (anel.ossos.some(i => !Number.isInteger(i) || i < 0) || new Set(anel.ossos).size !== anel.ossos.length) throw new Error('Influências precisam de ossos distintos válidos.');
  if (anel.pesos.some(p => !Number.isFinite(p) || p < 0) || anel.pesos.reduce((s, p) => s + p, 0) <= 0) throw new Error('Pesos de superfície inválidos.');
  const soma = anel.pesos.reduce((s, p) => s + p, 0);
  return { juntas: [...anel.ossos, ...Array(4 - anel.ossos.length).fill(0)], pesos: [...anel.pesos.map(p => p / soma), ...Array(4 - anel.pesos.length).fill(0)] };
}

export function criarLoft({ aneis, material, segmentos = 24, tampas = false, referencia = [1, 0, 0] }) {
  if (!Array.isArray(aneis) || aneis.length < 2 || !Number.isInteger(segmentos) || segmentos < 6) throw new Error('Loft precisa de dois anéis e ao menos seis segmentos.');
  const p = [], indices = [], juntas = [], pesos = [];
  for (let a = 0; a < aneis.length; a++) {
    const anel = aneis[a];
    if (!Array.isArray(anel.centro) || anel.centro.length !== 3 || !anel.centro.every(Number.isFinite)
      || !Array.isArray(anel.raios) || anel.raios.length !== 2 || !anel.raios.every(v => Number.isFinite(v) && v > 0)) throw new Error('Centro e raios do anel inválidos.');
    const tangente = normalizar(subtrair(aneis[Math.min(a + 1, aneis.length - 1)].centro, aneis[Math.max(a - 1, 0)].centro));
    let u = subtrair(referencia, escalar(tangente, produto(referencia, tangente)));
    if (Math.hypot(...u) < 1e-6) {
      const alternativa = Math.abs(tangente[2]) < .9 ? [0, 0, 1] : [0, 1, 0];
      u = subtrair(alternativa, escalar(tangente, produto(alternativa, tangente)));
    }
    u = normalizar(u);
    const v = cruzar(tangente, u), skin = influencia(anel);
    for (let s = 0; s < segmentos; s++) {
      const angulo = 2 * Math.PI * s / segmentos;
      p.push(...somar(anel.centro, somar(escalar(u, anel.raios[0] * Math.cos(angulo)), escalar(v, anel.raios[1] * Math.sin(angulo)))));
      juntas.push(...skin.juntas); pesos.push(...skin.pesos);
    }
  }
  for (let a = 0; a < aneis.length - 1; a++) for (let s = 0; s < segmentos; s++) {
    const i = a * segmentos + s, n = a * segmentos + (s + 1) % segmentos, b = i + segmentos, bn = n + segmentos;
    indices.push(i, n, b, n, bn, b);
  }
  if (tampas) for (const a of [0, aneis.length - 1]) {
    const centro = p.length / 3, skin = influencia(aneis[a]);
    p.push(...aneis[a].centro); juntas.push(...skin.juntas); pesos.push(...skin.pesos);
    for (let s = 0; s < segmentos; s++) {
      const i = a * segmentos + s, n = a * segmentos + (s + 1) % segmentos;
      if (a === 0) indices.push(centro, n, i); else indices.push(centro, i, n);
    }
  }
  const normais = Array(p.length).fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = indices.slice(t, t + 3);
    const normal = cruzar(subtrair(p.slice(b*3, b*3+3), p.slice(a*3, a*3+3)), subtrair(p.slice(c*3, c*3+3), p.slice(a*3, a*3+3)));
    if (Math.hypot(...normal) < 1e-12) throw new Error('Triângulo degenerado na superfície fluida.');
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) normais[i*3+k] += normal[k];
  }
  for (let i = 0; i < normais.length; i += 3) normais.splice(i, 3, ...normalizar(normais.slice(i, i+3)));
  return { posicoes: p, normais, indices, juntas, pesos, material };
}

export function unirPrimitivas(primitivas) {
  const grupos = new Map();
  for (const p of primitivas) {
    if (!p.indices.length) continue;
    if (!grupos.has(p.material)) grupos.set(p.material, { posicoes: [], normais: [], indices: [], juntas: [], pesos: [], material: p.material });
    const g = grupos.get(p.material), deslocamento = g.posicoes.length / 3;
    g.posicoes.push(...p.posicoes); g.normais.push(...p.normais); g.juntas.push(...p.juntas); g.pesos.push(...p.pesos);
    for (const i of p.indices) g.indices.push(i + deslocamento);
  }
  return [...grupos.values()].sort((a, b) => a.material - b.material);
}
