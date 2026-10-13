"""Costuras de UV da malha de jogo: partes pelo osso dominante, cortes pelas
costas ligando os buracos de cada parte e abrindo as pontas fechadas.
Cada parte vira uma ilha plana de baixa distorção (o smart project
fragmentava a malha reduzida em ~1.600 ilhas)."""
import heapq
from collections import Counter, defaultdict

import bmesh
import numpy as np

GRUPO = {'mandibula': 'cabeca', 'quadril': 'tronco', 'peito': 'tronco', 'antebraco_E': 'mao_E', 'antebraco_D': 'mao_D'}


def partes_por_osso(obj, bm):
    """Parte de cada face: componente solta (peça do rosto) ou osso dominante
    do corpo, suavizada por maioria entre vizinhas (bordas menos serrilhadas)."""
    names = {g.index: g.name for g in obj.vertex_groups}
    dl = bm.verts.layers.deform.active
    comp = [-1]*len(bm.faces)
    c = 0
    for f in bm.faces:
        if comp[f.index] >= 0:
            continue
        st = [f]
        comp[f.index] = c
        while st:
            g = st.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if comp[h.index] < 0:
                        comp[h.index] = c
                        st.append(h)
        c += 1
    corpo = int(np.bincount(comp).argmax())
    parte = []
    for f in bm.faces:
        if comp[f.index] != corpo:
            parte.append(f'peca{comp[f.index]}')
            continue
        acc = defaultdict(float)
        for v in f.verts:
            for gi, w in v[dl].items():
                n = names[gi]
                acc[GRUPO.get(n, n)] += w
        parte.append(max(acc, key=acc.get))
    for _ in range(4):
        novo = parte[:]
        for f in bm.faces:
            if parte[f.index].startswith('peca'):
                continue
            viz = Counter(parte[h.index] for e in f.edges for h in e.link_faces if h is not f)
            p, n = viz.most_common(1)[0]
            if n >= 2 and p != parte[f.index]:
                novo[f.index] = p
        parte = novo
    return parte


def marcar_costuras(bm, parte):
    """Costura nas fronteiras entre partes e, dentro de cada parte, cortes pelo
    caminho mais curto (preferindo o lado de trás, +y) que ligam todos os
    buracos; parte fechada recebe um corte nas costas. Cada parte vira disco."""
    for e in bm.edges:
        fs = e.link_faces
        e.seam = len(fs) != 2 or parte[fs[0].index] != parte[fs[1].index]
    faces_de = defaultdict(set)
    for f in bm.faces:
        faces_de[parte[f.index]].add(f.index)
    custo = {}
    for e in bm.edges:
        n = (e.verts[0].normal+e.verts[1].normal).normalized()
        frente = max(0.0, -n.y)                  # frente da personagem é -y
        custo[e.index] = e.calc_length()*(1+8*frente)
    cortes = 0
    for nome, fs in faces_de.items():
        interiores = [e for e in bm.edges if not e.seam and all(h.index in fs for h in e.link_faces) and len(e.link_faces) == 2]
        if not interiores and len(fs) < 3:
            continue
        adj = defaultdict(list)
        for e in interiores:
            a, b = e.verts
            adj[a.index].append((b.index, e))
            adj[b.index].append((a.index, e))
        borda = [e for e in bm.edges if e.seam and any(h.index in fs for h in e.link_faces)]
        # Buracos: componentes do grafo das arestas de borda.
        pai = {}
        def raiz(a):
            while pai[a] != a:
                pai[a] = pai[pai[a]]
                a = pai[a]
            return a
        for e in borda:
            a, b = (v.index for v in e.verts)
            pai.setdefault(a, a)
            pai.setdefault(b, b)
            pai[raiz(a)] = raiz(b)
        loops = defaultdict(set)
        for v in pai:
            loops[raiz(v)].add(v)
        loops = list(loops.values())
        verts_parte = {v.index for i in fs for v in bm.faces[i].verts}
        if not loops:
            # Parte fechada: corte das costas até o ponto mais distante.
            ys = sorted(verts_parte, key=lambda i: -bm.verts[i].co.y)
            loops = [{ys[0]}]
            alvo = {max(verts_parte, key=lambda i: (bm.verts[i].co-bm.verts[ys[0]].co).length)}
            loops.append(alvo)
        elif len(loops) == 1 and not nome.startswith('peca'):
            # Ponta fechada (orelha, luva, pé, cauda): um disco comprimiria a
            # ponta. Corte do buraco até o vértice mais distante dele.
            dist = {v: 0.0 for v in loops[0]}
            fila = [(0.0, v) for v in loops[0]]
            heapq.heapify(fila)
            while fila:
                d, v = heapq.heappop(fila)
                if d > dist.get(v, 1e18):
                    continue
                for w, e in adj[v]:
                    nd = d+e.calc_length()
                    if nd < dist.get(w, 1e18):
                        dist[w] = nd
                        heapq.heappush(fila, (nd, w))
            loops.append({max(dist, key=dist.get)})
        arvore = set(loops[0])
        restantes = loops[1:]
        while restantes:
            dist, prev = {v: 0.0 for v in arvore}, {}
            fila = [(0.0, v) for v in arvore]
            heapq.heapify(fila)
            alvos = {v: k for k, l in enumerate(restantes) for v in l}
            achado = None
            while fila:
                d, v = heapq.heappop(fila)
                if d > dist.get(v, 1e18):
                    continue
                if v in alvos:
                    achado = v
                    break
                for w, e in adj[v]:
                    nd = d+custo[e.index]
                    if nd < dist.get(w, 1e18):
                        dist[w], prev[w] = nd, (v, e)
                        heapq.heappush(fila, (nd, w))
            if achado is None:
                break
            v = achado
            while v in prev:
                u, e = prev[v]
                e.seam = True
                cortes += 1
                arvore.add(v)
                v = u
            k = alvos[achado]
            arvore |= restantes.pop(k)
    return cortes
