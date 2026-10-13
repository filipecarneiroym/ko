import { criarMalha } from './malha.mjs';

// Volumes de estudo vinculados ao rig; a aprovação da arte final continua separada.
export function criarPipoca(ossos) {
    const m = criarMalha();
    const junta = (nome) => {
        const indice = ossos.findIndex((osso) => osso.nome === nome);
        if (indice < 0) throw new Error(`Osso obrigatório da Pipoca ausente: ${nome}`);
        return indice;
    };
    const osso = Object.fromEntries(ossos.map((item, indice) => [item.nome, indice]));
    [
        'quadril', 'tronco', 'peito', 'cabeca', 'mandibula', 'cauda',
        'orelha_E', 'orelha_D', 'braco_E', 'antebraco_E', 'mao_E',
        'braco_D', 'antebraco_D', 'mao_D', 'coxa_E', 'canela_E', 'pe_E',
        'coxa_D', 'canela_D', 'pe_D',
    ].forEach(junta);

    const PELO = 0;
    const INDIGO = 1;
    const VERMELHO = 2;
    const ROSA = 3;
    const ESCURO = 4;
    const AMBAR = 5;
    const arredondado = { segmentos: 16, aneis: 10 };
    const rosto = { segmentos: 20, aneis: 12 };
    const detalhe = { segmentos: 12, aneis: 7 };
    const segmento = (a, b, raioA, raioB, material, indice, opcoes = {}) =>
        m.segmento(a, b, raioA, raioB, material, indice, { segmentos: 16, ...opcoes });
    const anel = (centro, raioMaior, raioTubo, material, indice, opcoes = {}) =>
        m.torus(centro, raioMaior, raioTubo, material, indice, { segmentos: 16, aneis: 8, ...opcoes });

    // O top e o short têm volume próprio, sem usar a ilustração como superfície.
    m.elipsoide([-.012, 1.34, 0], [.174, .258, .233], PELO, osso.tronco, arredondado);
    m.elipsoide([-.024, 1.63, 0], [.189, .263, .289], PELO, osso.peito, arredondado);
    m.elipsoide([0, 1.024, 0], [.211, .166, .302], PELO, osso.quadril, arredondado);
    m.elipsoide([-.020, 1.680, 0], [.235, .190, .325], INDIGO, osso.peito, arredondado);
    m.elipsoide([-.020, 1.563, 0], [.205, .048, .294], INDIGO, osso.peito, arredondado);
    for (const lado of [-1, 1]) {
        m.caixa([.112, 1.833, lado * .200], [.033, .199, .060], INDIGO, osso.peito, { rotacao: [0, 0, .10] });
        m.caixa([-.145, 1.824, lado * .155], [.033, .196, .059], INDIGO, osso.peito, { rotacao: [0, 0, -.35] });
    }
    m.elipsoide([-.183, 1.791, 0], [.046, .135, .143], INDIGO, osso.peito, arredondado);
    m.elipsoide([-.014, 1.979, 0], [.109, .137, .122], PELO, osso.cabeca, arredondado);
    m.elipsoide([-.008, 1.025, 0], [.229, .155, .326], INDIGO, osso.quadril, arredondado);
    m.elipsoide([0, 1.137, 0], [.191, .043, .287], PELO, osso.quadril, arredondado);
    m.caixa([.188, 1.136, 0], [.018, .055, .068], INDIGO, osso.quadril);
    m.caixa([.199, 1.136, 0], [.009, .036, .046], PELO, osso.quadril);

    // A cabeça conserva focinho curto, bochechas e olhar âmbar da referência atual.
    m.elipsoide([-.006, 2.194, 0], [.251, .271, .263], PELO, osso.cabeca, rosto);
    m.elipsoide([.075, 2.077, 0], [.219, .155, .237], PELO, osso.cabeca, arredondado);
    for (const lado of [-1, 1]) {
        m.elipsoide([.081, 2.128, lado * .197], [.151, .114, .126], PELO, osso.cabeca, arredondado);
        for (let faixa = 0; faixa < 3; faixa++) {
            const altura = 2.095 + faixa * .039;
            segmento([-.028, altura, lado * .232], [-.096 - faixa * .012, altura + .012, lado * (.329 - faixa * .011)], .038, .002, PELO, osso.cabeca, { segmentos: 12 });
        }

        const giroOlho = [0, -lado * .345, 0];
        m.elipsoide([.217, 2.237, lado * .156], [.038, .101, .085], ESCURO, osso.cabeca, { ...rosto, rotacao: giroOlho });
        m.elipsoide([.227, 2.232, lado * .158], [.036, .093, .078], PELO, osso.cabeca, { ...rosto, rotacao: giroOlho });
        m.elipsoide([.260, 2.231, lado * .170], [.012, .068, .052], AMBAR, osso.cabeca, { ...rosto, rotacao: giroOlho });
        m.elipsoide([.272, 2.231, lado * .174], [.006, .053, .025], ESCURO, osso.cabeca, { ...arredondado, rotacao: giroOlho });
        m.elipsoide([.278, 2.260, lado * .164], [.006, .012, .009], PELO, osso.cabeca, detalhe);
        m.elipsoide([.277, 2.206, lado * .186], [.005, .006, .004], PELO, osso.cabeca, detalhe);

        const sobrancelha = [
            [.189, 2.357, lado * .241],
            [.226, 2.377, lado * .176],
            [.254, 2.349, lado * .094],
        ];
        segmento(sobrancelha[0], sobrancelha[1], .012, .019, ESCURO, osso.cabeca, { segmentos: 12 });
        segmento(sobrancelha[1], sobrancelha[2], .019, .011, ESCURO, osso.cabeca, { segmentos: 12 });
        for (let cilio = 0; cilio < 3; cilio++) {
            const z = lado * (.211 + cilio * .017);
            const y = 2.294 - cilio * .011;
            segmento([.256 - cilio * .008, y, z], [.254 - cilio * .013, y + .021, z + lado * .020], .006, .001, ESCURO, osso.cabeca, { segmentos: 8 });
        }

        m.elipsoide([.270, 2.073, lado * .076], [.127, .084, .092], PELO, osso.mandibula, arredondado);
        segmento([.352, 2.031, lado * .014], [.332, 2.024, lado * .076], .006, .006, ESCURO, osso.mandibula, { segmentos: 10 });
        segmento([.332, 2.024, lado * .076], [.293, 2.055, lado * .136], .006, .002, ESCURO, osso.mandibula, { segmentos: 10 });
    }
    m.elipsoide([.231, 2.008, 0], [.110, .056, .129], PELO, osso.mandibula, arredondado);
    m.elipsoide([.381, 2.110, 0], [.034, .025, .049], ROSA, osso.cabeca, arredondado);
    segmento([.378, 2.102, 0], [.369, 2.075, 0], .012, .004, ROSA, osso.cabeca, { segmentos: 12 });
    segmento([.370, 2.076, 0], [.352, 2.031, 0], .004, .004, ESCURO, osso.mandibula, { segmentos: 10 });

    // As orelhas são malhas espessas articuladas individualmente, inclusive o interior.
    for (const [sufixo, lado] of [['E', -1], ['D', 1]]) {
        const indice = osso[`orelha_${sufixo}`];
        const giro = [lado * .12, 0, -.035];
        m.elipsoide([-.043, 2.787, lado * .198], [.077, .431, .121], PELO, indice, { ...rosto, rotacao: giro });
        m.elipsoide([.021, 2.800, lado * .200], [.030, .352, .083], ROSA, indice, { ...arredondado, rotacao: giro });
        m.elipsoide([-.049, 2.464, lado * .159], [.086, .134, .091], PELO, indice, arredondado);
    }

    for (const [sufixo, lado] of [['E', -1], ['D', 1]]) {
        const braco = osso[`braco_${sufixo}`];
        const antebraco = osso[`antebraco_${sufixo}`];
        const mao = osso[`mao_${sufixo}`];
        const coxa = osso[`coxa_${sufixo}`];
        const canela = osso[`canela_${sufixo}`];
        const pe = osso[`pe_${sufixo}`];

        m.elipsoide([-.007, 1.797, lado * .393], [.146, .160, .162], PELO, braco, arredondado);
        m.elipsoide([.055, 1.584, lado * .529], [.130, .279, .127], PELO, braco, {
            ...arredondado, rotacao: [-lado * .367, 0, .17],
        });
        m.elipsoide([.100, 1.359, lado * .620], [.099, .103, .103], PELO, antebraco, arredondado);
        m.elipsoide([.156, 1.163, lado * .673], [.111, .218, .110], PELO, antebraco, {
            ...arredondado, rotacao: [-lado * .245, 0, .19],
        });

        const pontoPulso = (t) => [.20 - .10 * t, .98 + .38 * t, lado * (.72 - .10 * t)];
        segmento(pontoPulso(.01), pontoPulso(.32), .088, .096, PELO, mao);
        segmento(pontoPulso(.04), pontoPulso(.09), .091, .092, VERMELHO, mao);
        segmento(pontoPulso(.23), pontoPulso(.28), .096, .098, VERMELHO, mao);
        m.elipsoide([.218, .899, lado * .739], [.143, .173, .140], VERMELHO, mao, arredondado);
        m.elipsoide([.303, .947, lado * .664], [.076, .105, .074], VERMELHO, mao, arredondado);
        m.elipsoide([.260, .827, lado * .746], [.119, .078, .117], VERMELHO, mao, arredondado);

        m.elipsoide([.015, .764, lado * .218], [.159, .267, .157], PELO, coxa, {
            ...arredondado, rotacao: [-lado * .055, 0, .04],
        });
        segmento([0, .995, lado * .20], [.011, .801, lado * .216], .203, .179, INDIGO, coxa);
        anel([.011, .803, lado * .216], .179, .010, INDIGO, coxa, { eixo: 'y', escala: [1.025, 1, 1] });
        for (const faixa of [0, 1]) {
            const z = lado * (.355 + faixa * .018);
            segmento([.112 - faixa * .039, 1.002, z], [.115 - faixa * .039, .807, z + lado * .014], .009, .010, PELO, coxa, { segmentos: 10 });
        }
        m.elipsoide([.034, .533, lado * .230], [.106, .112, .105], PELO, canela, arredondado);
        m.elipsoide([-.004, .331, lado * .236], [.096, .219, .102], PELO, canela, arredondado);

        m.elipsoide([.104, .077, lado * .240], [.228, .077, .111], PELO, pe, arredondado);
        for (const [x, raio] of [[.025,.088],[.065,.094],[.105,.095],[.145,.092],[.185,.085],[.225,.075]]) {
            anel([x, .075, lado * .240], raio, .009, PELO, pe, {
                eixo: 'x', escala: [.69, 2, 1.075],
            });
        }
        for (const [x, raio] of [[.008,.086],[.245,.068]]) {
            anel([x, .075, lado * .240], raio, .0025, VERMELHO, pe, {
                eixo: 'x', escala: [.69, 2, 1.075],
            });
        }
        for (const dedo of [-1, 0, 1]) {
            const z = lado * .240 + dedo * .065;
            m.elipsoide([.302, .057, z], [.071, .054, .041], PELO, pe, detalhe);
            m.elipsoide([.367, .059, z], [.012, .022, .017], ROSA, pe, detalhe);
        }
    }

    m.elipsoide([-.272, 1.062, 0], [.137, .148, .143], PELO, osso.cauda, arredondado);
    for (let tufo = 0; tufo < 3; tufo++) {
        const angulo = tufo * Math.PI * 2 / 3;
        m.elipsoide([-.306, 1.062 + Math.cos(angulo) * .070, Math.sin(angulo) * .065], [.105, .080, .081], PELO, osso.cauda, detalhe);
    }

    const material = (nome, cor, aspereza) => ({
        name: nome,
        pbrMetallicRoughness: {
            baseColorFactor: [...cor, 1], metallicFactor: 0, roughnessFactor: aspereza,
        },
        doubleSided: false,
    });
    return {
        primitivas: m.primitivas(),
        materiais: [
            material('pipoca_pelo_e_faixas_creme', [.91, .856, .77], .91),
            material('pipoca_tecido_indigo', [.039, .055, .255], .61),
            material('pipoca_luvas_vermelhas', [.63, .013, .026], .30),
            material('pipoca_orelhas_e_nariz_rosa', [.91, .32, .36], .74),
            material('pipoca_pupilas_e_sobrancelhas', [.029, .018, .015], .48),
            material('pipoca_iris_ambar', [.90, .338, .025], .27),
        ],
        extras: {
            lutador: 'pipoca',
            status: 'blockout',
            aprovadoFinal: false,
            referencia: 'pipoca-referencia-v1.png',
            orientacao: { cima: '+Y', frente: '+X', chao: 0 },
            identidade: ['coelha adulta', 'pelo creme', 'orelhas rosadas longas', 'olhos âmbar', 'top e short índigo', 'luvas vermelhas'],
            limites: ['Volumes articulados de estudo; não é o modelo final aprovado.', 'Pelagem e tecidos ainda sem mapas de superfície.'],
        },
    };
}
