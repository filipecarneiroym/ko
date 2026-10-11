import { criarMalha } from './malha.mjs';

// Volumes articulados para revisar a silhueta; ainda não são a malha final esculpida.
export function criarUivo(ossos) {
    const m = criarMalha();
    const juntas = new Map(ossos.map((osso, indice) => [osso.nome, indice]));
    const escala = 1.1;
    const v = (p) => p.map((n) => n * escala);
    const j = (nome) => {
        if (!juntas.has(nome)) throw new Error(`Uivo: junta ausente: ${nome}`);
        return juntas.get(nome);
    };
    const el = (centro, raios, material, osso, opcoes = {}) => m.elipsoide(
        v(centro), v(raios), material, j(osso), { segmentos: 14, aneis: 8, ...opcoes },
    );
    const seg = (a, b, raioA, raioB, material, osso, opcoes = {}) => m.segmento(
        v(a), v(b), raioA * escala, raioB * escala, material, j(osso), { segmentos: 16, ...opcoes },
    );
    const caixa = (centro, dimensoes, material, osso, opcoes = {}) => m.caixa(
        v(centro), v(dimensoes), material, j(osso), opcoes,
    );
    const torus = (centro, raio, tubo, material, osso, opcoes = {}) => m.torus(
        v(centro), raio * escala, tubo * escala, material, j(osso), opcoes,
    );

    const PELO = 0;
    const PELO_ESCURO = 1;
    const CLARO = 2;
    const GI = 3;
    const COSTURA = 4;
    const BANDAGEM = 5;
    const PRETO = 6;
    const AMBAR = 7;

    const material = (nome, cor, rugosidade = 0.86) => ({
        name: nome,
        pbrMetallicRoughness: { baseColorFactor: [...cor, 1], metallicFactor: 0, roughnessFactor: rugosidade },
    });
    const materiais = [
        material('Uivo · pelo cinza quente', [0.36, 0.32, 0.30]),
        material('Uivo · pelo escuro', [0.18, 0.16, 0.17]),
        material('Uivo · focinho e peito claros', [0.77, 0.73, 0.65]),
        material('Uivo · gi índigo', [0.075, 0.055, 0.17]),
        material('Uivo · costuras e faixa', [0.15, 0.12, 0.26]),
        material('Uivo · bandagens bege', [0.68, 0.62, 0.51]),
        material('Uivo · nariz e garras', [0.025, 0.020, 0.025], 0.42),
        material('Uivo · olhos âmbar', [1.0, 0.48, 0.025], 0.28),
    ];

    // Peitoral largo e gi aberto deixam a identidade visível sem desenhar pele em um plano.
    el([0, 1.48, 0], [0.27, 0.40, 0.37], PELO, 'tronco', { segmentos: 20, aneis: 12 });
    el([0.04, 1.78, 0], [0.28, 0.26, 0.43], PELO, 'peito', { segmentos: 20, aneis: 12 });
    el([0.235, 1.77, 0], [0.085, 0.25, 0.225], CLARO, 'peito');
    el([-0.13, 1.60, 0], [0.18, 0.37, 0.425], GI, 'tronco');
    for (const lado of [-1, 1]) {
        el([0.11, 1.58, lado * 0.30], [0.18, 0.33, 0.15], GI, 'tronco');
        seg([0.12, 1.96, lado * 0.295], [0.285, 1.34, lado * 0.055], 0.069, 0.063, COSTURA, 'peito');
        seg([0.145, 1.94, lado * 0.272], [0.306, 1.34, lado * 0.035], 0.018, 0.018, GI, 'peito');
        el([0.18, 1.075, lado * 0.24], [0.13, 0.20, 0.18], GI, 'quadril', { rotacao: [lado * 0.18, 0, 0] });
        // Pequenos triângulos dão ao ombro da roupa uma borda rasgada, própria de Uivo.
        for (let n = 0; n < 4; n += 1) {
            seg([-0.09 + n * 0.07, 1.94, lado * 0.355], [-0.11 + n * 0.07, 1.88, lado * 0.46], 0.035, 0.003, GI, 'peito', { segmentos: 8 });
        }
    }
    el([0, 1.15, 0], [0.29, 0.15, 0.385], GI, 'quadril');
    el([0.005, 1.175, 0], [0.305, 0.063, 0.41], COSTURA, 'quadril');
    for (const y of [1.145, 1.175, 1.205]) {
        el([0.015, y, 0], [0.308, 0.012, 0.411], GI, 'quadril', { segmentos: 20, aneis: 6 });
    }
    el([0.325, 1.16, 0], [0.065, 0.075, 0.095], COSTURA, 'quadril');
    caixa([0.31, 0.965, -0.065], [0.055, 0.39, 0.085], COSTURA, 'quadril', { rotacao: [-0.09, 0, 0] });
    caixa([0.32, 0.99, 0.065], [0.055, 0.35, 0.085], COSTURA, 'quadril', { rotacao: [0.12, 0, 0] });

    // As pernas folgadas terminam acima dos pés e não acrescentam calçado à referência.
    for (const lado of [-1, 1]) {
        const sufixo = lado < 0 ? 'E' : 'D';
        const coxa = `coxa_${sufixo}`;
        const canela = `canela_${sufixo}`;
        const pe = `pe_${sufixo}`;
        seg([0, 0.98, lado * 0.20], [0.03, 0.53, lado * 0.23], 0.235, 0.205, GI, coxa);
        el([0.02, 0.77, lado * 0.22], [0.255, 0.29, 0.235], GI, coxa);
        el([0.035, 0.53, lado * 0.23], [0.225, 0.16, 0.22], GI, canela);
        seg([0.03, 0.53, lado * 0.23], [0, 0.25, lado * 0.24], 0.22, 0.15, GI, canela);
        el([0.015, 0.36, lado * 0.235], [0.21, 0.18, 0.205], GI, canela);
        torus([0, 0.245, lado * 0.24], 0.145, 0.022, COSTURA, canela, { eixo: 'y', escala: [1.05, 0.8, 1] });
        seg([0, 0.245, lado * 0.24], [0.025, 0.105, lado * 0.24], 0.125, 0.125, PELO, pe);
        el([0.105, 0.10, lado * 0.24], [0.245, 0.10, 0.175], PELO, pe);
        el([0.19, 0.075, lado * 0.24], [0.18, 0.066, 0.17], CLARO, pe);
        for (let dedo = 0; dedo < 4; dedo += 1) {
            const z = lado * 0.24 + (dedo - 1.5) * 0.071;
            el([0.265, 0.068, z], [0.075, 0.055, 0.043], PELO, pe, { segmentos: 12, aneis: 8 });
            seg([0.305, 0.073, z], [0.379, 0.022, z], 0.028, 0.003, PRETO, pe, { segmentos: 10 });
        }
        for (let prega = 0; prega < 3; prega += 1) {
            el([0.181, 0.39 + prega * 0.105, lado * 0.255], [0.028, 0.022, 0.15], COSTURA, canela, { rotacao: [lado * 0.22, 0, 0], segmentos: 12, aneis: 6 });
        }
    }

    // Ombros, bíceps e antebraços usam as mesmas juntas do esqueleto comum.
    for (const lado of [-1, 1]) {
        const sufixo = lado < 0 ? 'E' : 'D';
        const braco = `braco_${sufixo}`;
        const antebraco = `antebraco_${sufixo}`;
        const mao = `mao_${sufixo}`;
        el([0, 1.80, lado * 0.435], [0.235, 0.235, 0.22], PELO, braco);
        seg([0, 1.82, lado * 0.43], [0.10, 1.36, lado * 0.62], 0.205, 0.15, PELO, braco);
        el([0.095, 1.57, lado * 0.535], [0.19, 0.255, 0.18], PELO, braco, { rotacao: [lado * 0.29, 0, 0] });
        el([0.15, 1.56, lado * 0.565], [0.07, 0.18, 0.115], CLARO, braco);
        el([0.10, 1.36, lado * 0.62], [0.15, 0.15, 0.15], PELO, antebraco);
        seg([0.10, 1.36, lado * 0.62], [0.20, 0.98, lado * 0.72], 0.155, 0.105, PELO, antebraco);
        seg([0.14, 1.22, lado * 0.658], [0.205, 0.965, lado * 0.725], 0.142, 0.113, BANDAGEM, antebraco);
        for (let tira = 0; tira < 4; tira += 1) {
            const t = tira / 3;
            torus([0.148 + t * 0.055, 1.20 - t * 0.21, lado * (0.664 + t * 0.055)], 0.133 - t * 0.022, 0.009, CLARO, antebraco, { eixo: 'y', escala: [1, 0.65, 1] });
        }
        el([0.22, 0.87, lado * 0.748], [0.115, 0.145, 0.125], BANDAGEM, mao);
        el([0.292, 0.867, lado * 0.748], [0.055, 0.11, 0.11], PELO, mao);
        for (let dedo = 0; dedo < 4; dedo += 1) {
            const z = lado * 0.748 + (dedo - 1.5) * 0.052;
            el([0.25, 0.747, z], [0.049, 0.075, 0.036], PELO, mao, { segmentos: 12, aneis: 8 });
            seg([0.265, 0.702, z], [0.299, 0.644, z], 0.023, 0.002, PRETO, mao, { segmentos: 10 });
        }
        el([0.332, 0.895, lado * 0.808], [0.065, 0.062, 0.045], PELO, mao, { segmentos: 12, aneis: 8 });
        seg([0.365, 0.865, lado * 0.805], [0.395, 0.808, lado * 0.8], 0.023, 0.002, PRETO, mao, { segmentos: 10 });
        for (let tufo = 0; tufo < 4; tufo += 1) {
            seg([-0.12, 1.87 - tufo * 0.105, lado * (0.46 + tufo * 0.037)], [-0.22, 1.81 - tufo * 0.105, lado * (0.57 + tufo * 0.037)], 0.059, 0.003, PELO_ESCURO, braco, { segmentos: 8 });
        }
    }

    // Focinho projetado, olhos âmbar e orelhas triangulares diferenciam o lobo da coelha.
    el([-0.035, 2.00, 0], [0.26, 0.23, 0.285], PELO, 'peito');
    el([0.02, 2.225, 0], [0.27, 0.285, 0.26], PELO, 'cabeca', { segmentos: 20, aneis: 14 });
    el([-0.12, 2.23, 0], [0.17, 0.28, 0.27], PELO_ESCURO, 'cabeca');
    el([0.135, 2.165, 0], [0.22, 0.18, 0.235], CLARO, 'cabeca');
    el([0.285, 2.165, 0], [0.24, 0.105, 0.152], CLARO, 'cabeca');
    el([0.35, 2.122, 0], [0.184, 0.012, 0.141], PRETO, 'cabeca', { segmentos: 16, aneis: 6 });
    el([0.28, 2.09, 0], [0.185, 0.045, 0.12], CLARO, 'mandibula');
    el([0.51, 2.197, 0], [0.077, 0.059, 0.103], PRETO, 'cabeca');
    el([0.561, 2.217, -0.028], [0.012, 0.011, 0.025], PELO_ESCURO, 'cabeca', { segmentos: 10, aneis: 6 });
    for (const lado of [-1, 1]) {
        el([0.008, 2.16, lado * 0.23], [0.12, 0.14, 0.075], CLARO, 'cabeca');
        el([0.21, 2.292, lado * 0.165], [0.034, 0.044, 0.078], PRETO, 'cabeca');
        el([0.235, 2.292, lado * 0.167], [0.030, 0.032, 0.068], CLARO, 'cabeca', { rotacao: [lado * 0.18, 0, 0] });
        el([0.263, 2.288, lado * 0.171], [0.012, 0.027, 0.028], AMBAR, 'cabeca', { segmentos: 14, aneis: 10 });
        el([0.273, 2.288, lado * 0.171], [0.006, 0.022, 0.010], PRETO, 'cabeca', { segmentos: 12, aneis: 8 });
        el([0.279, 2.301, lado * 0.163], [0.003, 0.006, 0.006], CLARO, 'cabeca', { segmentos: 8, aneis: 6 });
        seg([0.245, 2.326, lado * 0.10], [0.18, 2.376, lado * 0.235], 0.029, 0.027, PRETO, 'cabeca', { segmentos: 10 });
        const orelha = `orelha_${lado < 0 ? 'E' : 'D'}`;
        seg([-0.04, 2.43, lado * 0.163], [-0.07, 2.735, lado * 0.205], 0.105, 0.003, PELO_ESCURO, orelha, { segmentos: 12 });
        seg([0.018, 2.45, lado * 0.163], [-0.026, 2.69, lado * 0.197], 0.058, 0.002, CLARO, orelha, { segmentos: 10 });
        for (let tufo = 0; tufo < 5; tufo += 1) {
            const y = 2.36 - tufo * 0.075;
            seg([-0.10, y, lado * 0.215], [-0.30 - (tufo % 2) * 0.055, y - 0.075, lado * (0.27 + (tufo % 2) * 0.035)], 0.07, 0.002, tufo > 2 ? CLARO : PELO, 'cabeca', { segmentos: 8 });
        }
        for (let ponto = 0; ponto < 3; ponto += 1) {
            el([0.36 - ponto * 0.044, 2.18 + (ponto % 2) * 0.021, lado * 0.141], [0.010, 0.009, 0.007], PELO_ESCURO, 'cabeca', { segmentos: 8, aneis: 6 });
        }
        for (let tufo = 0; tufo < 3; tufo += 1) {
            seg([0.18, 1.98 - tufo * 0.095, lado * 0.16], [0.24, 1.85 - tufo * 0.105, lado * 0.12], 0.06, 0.002, CLARO, 'peito', { segmentos: 8 });
        }
    }
    for (let tufo = 0; tufo < 4; tufo += 1) {
        seg([-0.13, 2.42 - tufo * 0.10, 0], [-0.33 - tufo * 0.015, 2.49 - tufo * 0.10, 0], 0.075, 0.002, PELO_ESCURO, 'cabeca', { segmentos: 8 });
    }

    // A cauda é um volume traseiro próprio e acompanha sua junta, inclusive nos giros.
    seg([-0.20, 1.02, 0], [-0.61, 0.70, 0], 0.14, 0.205, PELO, 'cauda');
    el([-0.54, 0.76, 0], [0.29, 0.23, 0.22], PELO, 'cauda', { rotacao: [0, 0, 0.50] });
    el([-0.77, 0.54, 0], [0.255, 0.20, 0.19], PELO, 'cauda', { rotacao: [0, 0, 0.65] });
    el([-0.925, 0.395, 0], [0.17, 0.155, 0.145], CLARO, 'cauda', { rotacao: [0, 0, 0.65] });
    seg([-0.95, 0.41, 0], [-1.11, 0.24, 0], 0.12, 0.002, CLARO, 'cauda', { segmentos: 12 });
    for (let tufo = 0; tufo < 6; tufo += 1) {
        const t = tufo / 5;
        for (const lado of [-1, 1]) {
            seg([-0.43 - t * 0.43, 0.92 - t * 0.38, lado * 0.12], [-0.62 - t * 0.43, 0.90 - t * 0.41, lado * 0.22], 0.07 - t * 0.02, 0.002, t > 0.7 ? CLARO : PELO_ESCURO, 'cauda', { segmentos: 8 });
        }
    }

    return {
        primitivas: m.primitivas(),
        materiais,
        extras: {
            status: 'blockout',
            personagem: 'uivo',
            referencia: 'uivo-v1 / uivo-referencia-v1',
            finalidade: 'Validar silhueta, articulação e integração; exige escultura, topologia e animação finais.',
            eixoFrente: '+X',
            escalaRelativa: escala,
        },
    };
}
