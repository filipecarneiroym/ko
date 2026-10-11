const somar = (a, b) => a.map((v, i) => v + b[i]);
const escalar = (v, s) => v.map(x => x * s);
const subtrair = (a, b) => a.map((v, i) => v - b[i]);
const cruzar = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalizar = v => escalar(v, 1 / (Math.hypot(...v) || 1));
function girar(v, r = [0, 0, 0]) {
  let [x, y, z] = v;
  let c = Math.cos(r[0]), s = Math.sin(r[0]); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(r[1]); s = Math.sin(r[1]); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(r[2]); s = Math.sin(r[2]); return [x * c - y * s, x * s + y * c, z];
}

// Superfícies trianguladas em metros; cada parte segue um osso do rig de produção inicial.
export function criarMalha() {
  const grupos = new Map();
  function adicionar(posicoes, normais, indices, material, junta) {
    if (!grupos.has(material)) grupos.set(material, { posicoes: [], normais: [], indices: [], juntas: [], pesos: [], material });
    const g = grupos.get(material), deslocamento = g.posicoes.length / 3;
    g.posicoes.push(...posicoes); g.normais.push(...normais);
    for (const i of indices) g.indices.push(i + deslocamento);
    for (let i = 0; i < posicoes.length / 3; i++) { g.juntas.push(junta, 0, 0, 0); g.pesos.push(1, 0, 0, 0); }
  }
  function elipsoide(centro, raios, material, junta, opcoes = {}) {
    const segmentos = opcoes.segmentos || 24, aneis = opcoes.aneis || 16;
    const p = [], n = [], indices = [];
    for (let i = 0; i <= aneis; i++) {
      const theta = Math.PI * i / aneis;
      for (let j = 0; j <= segmentos; j++) {
        const phi = 2 * Math.PI * j / segmentos;
        const v = [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
        p.push(...somar(centro, girar(v.map((x, k) => x * raios[k]), opcoes.rotacao)));
        n.push(...normalizar(girar(v.map((x, k) => x / raios[k]), opcoes.rotacao)));
      }
    }
    for (let i = 0; i < aneis; i++) for (let j = 0; j < segmentos; j++) {
      const a = i * (segmentos + 1) + j, b = a + segmentos + 1;
      if (i > 0) indices.push(a, a + 1, b);
      if (i < aneis - 1) indices.push(a + 1, b + 1, b);
    }
    adicionar(p, n, indices, material, junta);
  }
  function segmento(a, b, raioA, raioB, material, junta, opcoes = {}) {
    const segmentos = opcoes.segmentos || 20;
    const eixo = normalizar(subtrair(b, a)), comprimento = Math.hypot(...subtrair(b, a));
    const u = normalizar(cruzar(eixo, Math.abs(eixo[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const v = cruzar(eixo, u), p = [], n = [], indices = [];
    for (let k = 0; k <= 1; k++) for (let i = 0; i <= segmentos; i++) {
      const t = 2 * Math.PI * i / segmentos;
      const radial = somar(escalar(u, Math.cos(t)), escalar(v, Math.sin(t)));
      p.push(...somar(k ? b : a, escalar(radial, k ? raioB : raioA)));
      n.push(...normalizar(somar(radial, escalar(eixo, (raioA - raioB) / comprimento))));
    }
    for (let i = 0; i < segmentos; i++) { const j = i + segmentos + 1; indices.push(i, i + 1, j, i + 1, j + 1, j); }
    // Tampas com normais próprias evitam pontas abertas nas faixas e roupas.
    for (const [c, sinal, raio] of [[a, -1, raioA], [b, 1, raioB]]) {
      const base = p.length / 3; p.push(...c); n.push(...escalar(eixo, sinal));
      for (let i = 0; i <= segmentos; i++) {
        const t = 2 * Math.PI * i / segmentos;
        p.push(...somar(c, somar(escalar(u, Math.cos(t) * raio), escalar(v, Math.sin(t) * raio)))); n.push(...escalar(eixo, sinal));
      }
      for (let i = 0; i < segmentos; i++) if (sinal < 0) indices.push(base, base + i + 2, base + i + 1); else indices.push(base, base + i + 1, base + i + 2);
    }
    adicionar(p, n, indices, material, junta);
  }
  function caixa(centro, dimensoes, material, junta, opcoes = {}) {
    const p = [], n = [], indices = [];
    for (const [normal, vertices] of [
      [[1,0,0], [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],
      [[-1,0,0], [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],
      [[0,1,0], [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]],
      [[0,-1,0], [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]],
      [[0,0,1], [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
      [[0,0,-1], [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
    ]) {
      const base = p.length / 3;
      for (const v of vertices) { p.push(...somar(centro, girar(v.map((x, i) => x * dimensoes[i] / 2), opcoes.rotacao))); n.push(...girar(normal, opcoes.rotacao)); }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    adicionar(p, n, indices, material, junta);
  }
  function torus(centro, raio, espessura, material, junta, opcoes = {}) {
    const p = [], n = [], indices = [], segmentos = opcoes.segmentos || 24, lados = opcoes.aneis || 10;
    const r = opcoes.eixo === 'x' ? [0, 0, Math.PI / 2] : opcoes.eixo === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    const escala = opcoes.escala || [1, 1, 1];
    for (let i = 0; i <= segmentos; i++) for (let j = 0; j <= lados; j++) {
      const a = i / segmentos * 2 * Math.PI, b = j / lados * 2 * Math.PI;
      const normal = [Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)];
      const v = [(raio + espessura * Math.cos(b)) * Math.cos(a), espessura * Math.sin(b), (raio + espessura * Math.cos(b)) * Math.sin(a)];
      p.push(...somar(centro, girar(v.map((x,k) => x * escala[k]), r)));
      n.push(...normalizar(girar(normal.map((x,k) => x / escala[k]), r)));
    }
    for (let i = 0; i < segmentos; i++) for (let j = 0; j < lados; j++) { const a = i * (lados + 1) + j, b = a + lados + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    adicionar(p, n, indices, material, junta);
  }
  return { elipsoide, segmento, caixa, torus, primitivas: () => [...grupos.values()].sort((a,b) => a.material - b.material) };
}
