/* =====================================================================
   GUERRA NOS CÉUS — Configuração e tabelas de balanceamento
   Tudo que é "número de design" fica aqui, para ajustar sem caçar no código.
   ===================================================================== */

// Resolução lógica (o canvas é escalado para caber na janela, mantendo nitidez)
const W = 720;
const H = 960;

// --- RANKING ONLINE (JSONBin.io) -------------------------------------
// ATENÇÃO: a Master Key fica visível para qualquer jogador que abrir o código.
// Recomendação: no JSONBin crie uma "Access Key" só com permissão de leitura e
// atualização deste bin e use-a aqui no lugar da Master Key.
const RANKING_CONFIG = {
    apiKey: '$2a$10$ijIDXOStIv4MILwJuGppvuuGWjZwuD43v6m3UcH6UCef95XRMwrXS',
    binId: '68b8754dd0ea881f4070a142',
    get url() { return `https://api.jsonbin.io/v3/b/${this.binId}`; },
    localKey: 'gnc_ranking_local_v2',
    allowReset: true // coloque false para esconder o botão "Zerar ranking"
};

// --- DIFICULDADE -------------------------------------------------------
// density = volume de inimigos; elite = chance base de inimigo "veterano" (mais forte)
// supply = power-ups previstos POR FASE (igual em todas as fases; ver SUPPLY abaixo)
// endless = libera os ciclos infinitos depois da fase 10 (só no Ás)
const DIFFICULTY = {
    recruta:  { label: 'Recruta',  dmgTaken: 0.6,  enemyHp: 0.85, bulletSpeed: 0.88, fireRate: 0.8,  density: 0.85, elite: 0.0,  score: 0.3, bombs: 3, supply: 10, healBoost: 1.3, endless: false },
    veterano: { label: 'Veterano', dmgTaken: 0.9,  enemyHp: 1.0,  bulletSpeed: 1.0,  fireRate: 1.0,  density: 1.0,  elite: 0.03, score: 1.0,  bombs: 2, supply: 8.5, healBoost: 1.0, endless: false },
    as:       { label: 'Ás',       dmgTaken: 1.25, enemyHp: 1.25, bulletSpeed: 1.12, fireRate: 1.25, density: 1.2,  elite: 0.1,  score: 1.7,  bombs: 1, supply: 7, healBoost: 0.85, endless: true }
};
// Escalonamento por "progressão global" g = fase (0..9) + 10 × ciclo.
// Linear ao longo das 10 fases + EXPONENCIAL a cada ciclo extra (modo infinito do Ás).
const SCALING = {
    hpPerStage: 0.2, dmgPerStage: 0.11, fireRatePerStage: 0.06, bulletSpeedPerStage: 0.022, densityPerStage: 0.1, elitePerStage: 0.03,
    loopCompound: { hp: 1.7, dmg: 1.45, fireRate: 1.18, density: 1.15, bulletSpeed: 1.06 },
    caps: { fireRate: 3.2, bulletSpeed: 1.75, density: 3.4, elite: 0.7 },
    // pressão adaptativa: quanto mais evoluído o avião, mais inimigos e mais resistentes
    powerHp: 0.5, powerDensity: 0.45
};

// --- JOGADOR -----------------------------------------------------------
const PLAYER_CFG = {
    maxHp: 100,
    hpPerStage: 12,          // vida máxima ganha a cada fase vencida
    clearHeal: 0.35,         // fração da vida recuperada ao vencer uma fase
    radius: 9,               // hitbox real (pequena, estilo shmup)
    grazeRadius: 34,         // passar raspando nos tiros rende pontos e Fúria
    accel: 2600,
    baseSpeed: 320,
    focusFactor: 0.5,        // segurar SHIFT = voo de precisão
    invuln: 1.0,             // segundos de invencibilidade após ser atingido
    rollDuration: 0.45,
    rollCooldown: 2.8,
    maxBombs: 3,
    furyMax: 100,
    furyDuration: 6
};

// --- EVOLUÇÃO ------------------------------------------------------------
// Cada power-up vale 100 XP; peças soltas pelos inimigos valem GEAR_XP.
// xp[i] = custo para subir do nível i+1 para i+2 (mísseis começam no 0).
const UPGRADES = {
    cannon:  { max: 20, start: 1, xp: [100, 110, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360] },
    engine:  { max: 12, start: 1, xp: [100, 120, 140, 160, 185, 210, 235, 260, 285, 310, 335] },
    missile: { max: 10, start: 0, xp: [100, 120, 140, 160, 180, 200, 220, 240, 260, 280] }
};
// Peças: chegam por "fichas" que acumulam com o TEMPO (GEAR_RATE por segundo) — mais inimigos na tela não aceleram a evolução
const GEAR_XP = 12, GEAR_DROP = 0.6, GEAR_RATE = 0.3, GEAR_BUCKET = 5;

// Canhão — 20 níveis (1 modelo de avião por nível). Gerado por regra:
//   canos 1→9, dano 9→25, cadência 7→13.6/s, perfuração a partir do 6.
//   Abertura máxima de ±7°: o poder cresce PARA A FRENTE (evita acampar no canto).
const CANNON_LEVELS = [null];
(function buildCannon() {
    const gunsBy = [1, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9];
    for (let L = 1; L <= 20; L++) {
        const n = gunsBy[L - 1], half = Math.min(30, 6 + n * 3), maxDeg = Math.min(7, L * 0.55);
        const guns = [];
        for (let i = 0; i < n; i++) {
            const k = n === 1 ? 0 : i / (n - 1) * 2 - 1; // -1..1
            guns.push([Math.round(k * half), +(k * maxDeg * Math.abs(k)).toFixed(1)]);
        }
        CANNON_LEVELS.push({
            rate: +(7 + (L - 1) * 0.35).toFixed(2), dmg: +(9 + (L - 1) * 0.85).toFixed(1), w: +(3.5 + L * 0.17).toFixed(2), guns,
            pierce: L >= 17 ? 4 : L >= 13 ? 3 : L >= 9 ? 2 : L >= 6 ? 1 : 0
        });
    }
})();
// Motor — 12 níveis: velocidade, recarga da rolagem, cor/tamanho do pós-combustor e propulsores extras
const ENGINE_LEVELS = [
    null,
    { speed: 1.00, roll: 1.00, flame: '#ff9a3a', len: 1.0,  boosters: 0, name: 'Turbojato' },
    { speed: 1.04, roll: 0.97, flame: '#ffb347', len: 1.08, boosters: 0, name: 'Turbofan' },
    { speed: 1.08, roll: 0.94, flame: '#4fb4ff', len: 1.16, boosters: 2, name: 'Pós-combustor' },
    { speed: 1.12, roll: 0.90, flame: '#39d5ff', len: 1.24, boosters: 2, name: 'Vetorado' },
    { speed: 1.16, roll: 0.86, flame: '#9a7bff', len: 1.32, boosters: 2, name: 'SuperBaependi' },
    { speed: 1.20, roll: 0.82, flame: '#d070ff', len: 1.4,  boosters: 4, name: 'Scramjet' },
    { speed: 1.24, roll: 0.78, flame: '#35ff8a', len: 1.5,  boosters: 4, name: 'Plasma Verde' },
    { speed: 1.28, roll: 0.74, flame: '#ffe14a', len: 1.6,  boosters: 4, name: 'Plasma Ouro-Brasil' },
    { speed: 1.32, roll: 0.70, flame: '#7cffe8', len: 1.7,  boosters: 6, name: 'Aurora Austral' },
    { speed: 1.36, roll: 0.66, flame: '#4f7fe4', len: 1.8,  boosters: 6, name: 'Anil Supersônico' },
    { speed: 1.40, roll: 0.63, flame: '#ffffff', len: 1.9,  boosters: 6, name: 'Fusão Branca' },
    { speed: 1.44, roll: 0.60, flame: '#f6d21e', len: 2.05, boosters: 6, name: 'Coração do Brasil', tricolor: true }
];
// Mísseis — 10 níveis (a partir do 7: enxame de micromísseis)
const MISSILE_LEVELS = [null,
    { count: 1, every: 1.2 }, { count: 2, every: 1.1 }, { count: 2, every: 0.9 }, { count: 3, every: 0.85 }, { count: 4, every: 0.8 },
    { count: 4, every: 0.72 }, { count: 5, every: 0.68 }, { count: 6, every: 0.64 }, { count: 6, every: 0.58 }, { count: 8, every: 0.55 }];
const MISSILE_DMG = 22, MISSILE_DMG_PER_LVL = 2.5, MISSILE_SPLASH = 16;

// --- POWER-UPS -----------------------------------------------------------
// weight = chance relativa; o sistema ainda ajusta dinamicamente (ver powerups.js)
const POWERUP_TYPES = {
    cannon:  { label: 'Canhão',     sprite: 'PWcanhao',     color: '#ffa53a', weight: 26 },
    feather: { label: 'Motor',      sprite: 'PWvelocidade', color: '#4fc3ff', weight: 16 },
    health:  { label: 'Reparo',     sprite: 'PWsaude',      color: '#5cff7a', weight: 18 },
    bomb:    { label: 'Bomba',      sprite: 'PWbomba',      color: '#ff5a2a', weight: 11 },
    missile: { label: 'Mísseis',    sprite: null,           color: '#ff3df2', weight: 13 },
    shield:  { label: 'Escudo',     sprite: null,           color: '#7cf7ff', weight: 8 }
};
// Distribuição EQUALIZADA: o medidor enche com o TEMPO (supply ÷ stageSeconds por segundo) e um pouco
// com os abates (bônus limitado por fase). Quando chega a 1, cai um power-up.
// Resultado: Recruta ~10, Veterano ~8-9, Ás ~7 power-ups por fase — da fase 1 à fase 10.
const SUPPLY = { stageSeconds: 110, killBonus: 0.03, killBonusCap: 1.0, firstDropAt: 8 };
// Cura: vale uma fração da vida máxima que cresce a cada fase (mais tiros na tela = curas maiores)
// e fica mais provável quando você vem tomando muito dano.
const HEAL = { fraction: 0.22, perStage: 0.015, flat: 8, recentWindow: 30 };

// --- INIMIGOS -------------------------------------------------------------
// lives = vidas palestinas perdidas quando esse inimigo PASSA por você (multiplicado pela fase).
//         Começa em 1 no mais fraco (drone); os mais fortes causam mais mortes.
// alt = altitude (afeta tamanho/offset da sombra). faction define cor dos tiros.
const ENEMY_TYPES = {
    ap: { name: 'Caça Americano',         sprite: 'aviaoEUA',          w: 58,  hp: 55,  speed: 230, dmg: 12, score: 30,  lives: 3,  ai: 'diver',    faction: 'us', kind: 'plane', alt: 1.0,
          fire: { type: 'aimedBurst', every: [1.6, 2.6], count: 3, speed: 300 } },
    ip: { name: 'Caça Israelense',        sprite: 'aviaoISRAEL',       w: 58,  hp: 50,  speed: 190, dmg: 11, score: 28,  lives: 3,  ai: 'strafe',   faction: 'il', kind: 'plane', alt: 1.0,
          fire: { type: 'spread', every: [1.4, 2.2], count: 2, arc: 22, speed: 280 } },
    jp: { name: 'Interceptador Japonês',  sprite: 'aviaoJAPAO',        w: 62,  hp: 45,  speed: 330, dmg: 12, score: 35,  lives: 2,  ai: 'swooper',  faction: 'jp', kind: 'plane', alt: 1.1,
          fire: { type: 'spread', every: [1.2, 1.8], count: 5, arc: 60, speed: 250 } },
    ah: { name: 'Helicóptero Americano',  sprite: 'helicopteroEUA',    w: 74,  hp: 120, speed: 130, dmg: 14, score: 45,  lives: 5,  ai: 'hover',    faction: 'us', kind: 'heli',  alt: 0.55,
          fire: { type: 'rockets', every: [2.0, 2.8], count: 2, speed: 210 } },
    ih: { name: 'Helicóptero Israelense', sprite: 'helicopteroISRAEL', w: 74,  hp: 100, speed: 120, dmg: 10, score: 42,  lives: 4,  ai: 'ringer',   faction: 'il', kind: 'heli',  alt: 0.55,
          fire: { type: 'ring', every: [2.2, 3.0], count: 12, speed: 170 } },
    dr: { name: 'Drone Kamikaze',         sprite: null,                w: 34,  hp: 18,  speed: 260, dmg: 22, score: 15,  lives: 1,  ai: 'kamikaze', faction: 'us', kind: 'drone', alt: 0.8 },
    bm: { name: 'Bombardeiro Pesado',     sprite: 'aviaoEUA',          w: 150, hp: 900, speed: 55,  dmg: 14, score: 400, lives: 25, ai: 'bomber',   faction: 'us', kind: 'plane', alt: 1.35, tint: '#3a4250', elite: true,
          fire: { type: 'bomber', every: [0.9, 1.3], speed: 240 } },
    sam:{ name: 'Bateria Antiaérea',      sprite: null,                w: 56,  hp: 140, speed: 0,   dmg: 14, score: 60,  ai: 'ground',   faction: 'us', kind: 'ground', alt: 0,
          fire: { type: 'flak', every: [2.0, 3.0], speed: 230 } },
    gb: { name: 'Lancha Armada',          sprite: null,                w: 60,  hp: 160, speed: 40,  dmg: 12, score: 65,  ai: 'boat',     faction: 'il', kind: 'ground', alt: 0,
          fire: { type: 'aimedBurst', every: [1.8, 2.6], count: 4, speed: 260 } }
};

const FACTION_COLORS = {
    us:     { core: '#fff2f0', glow: '#ff3b2f' },
    il:     { core: '#f0ffff', glow: '#22d8ff' },
    jp:     { core: '#fff0fb', glow: '#ff4fd8' },
    boss:   { core: '#ffffff', glow: '#b45cff' },
    boss2:  { core: '#fffbe0', glow: '#ffb020' },
    player: { core: '#fffbe6', glow: '#ffd34a' },
    player2: { core: '#f2fff4', glow: '#3dff8a' },
    player3: { core: '#ffffff', glow: '#6fd8ff' },
    fury:   { core: '#ffffff', glow: '#ff7b1c' }
};

// --- FASES E HISTÓRIA ---------------------------------------------------------
// ambient: escuridão global (0 = dia claro, 0.75 = noite fechada)
// grade: cor de correção aplicada à cena (overlay). music: tema da fase (music.js)
// {P} é trocado pelo nome do piloto.
const STAGES = [
    {
        name: 'Céus em Chamas', chapter: 'O CERCO', bg: 'bg1', duration: 75, ambient: 0.12, grade: 'rgba(255,140,60,0.10)', music: 'stage1',
        weather: 'embers', hudColor: '#c8e6a0', ground: 'sam', groundEvery: [8, 12],
        pool: { lineDive: 3, vForm: 3, heliPair: 2, mixed: 2 }, waveEvery: [3.0, 4.0], maxEnemies: 10,
        midboss: 38, boss: 'fortaleza',
        briefing: [
            'CORONEL BALDANZA, BASE Baependi: {P}, o que vamos fazer hoje não tem autorização de Brasília. Se quiser recuar, recue agora. Ninguém vai te julgar.',
            'A flotilha precisa de céu limpo até a costa de Gaza. A TRÍADE cobriu a cidade costeira com uma cúpula de caças e atira em qualquer coisa que se mova — ambulância, padaria, fila de água.',
            'Hoje de manhã eles bombardearam a última escola de pé no bairro. Era abrigo de 300 famílias.',
            'Rompa o cerco externo. O guardião do setor é a FORTALEZA VOADORA, couraçado do comandante de codinome "Trump".'
        ],
        radio: [
            [3, 'Baependi', 'Contatos às 12 horas. Boa sorte, {P}.'],
            [14, 'Lula', 'Tenente Luiz Inácio "Lula" da Silva na sua ala! Achou que ia fazer isso sozinho?'],
            [26, 'DRA. Camila', 'Aqui é o Hospital Al-Amal... estamos ouvindo vocês pelo rádio. Por favor, não parem.'],
            [37, 'Baependi', 'Bombardeiro pesado entrando. Ele leva suprimentos da TRÍADE — derrube e fique com eles.'],
            [52, 'Lula', 'Olha a cidade lá embaixo... não sobrou um prédio de pé. Que tipo de gente faz isso?'],
            [68, 'Baependi', 'Assinatura gigante no radar. É o Trump.']
        ]
    },
    {
        name: 'Campos de Tendas', chapter: 'OS QUE FICARAM', bg: 'bg4', flipX: true, duration: 78, ambient: 0.22, grade: 'rgba(255,150,120,0.16)', music: 'camp',
        weather: 'sand', hudColor: '#ffc6a8', ground: 'sam', groundEvery: [9, 13],
        pool: { drones: 4, lineDive: 2, vForm: 2, heliPair: 1, mixed: 1 }, waveEvery: [3.0, 4.0], maxEnemies: 11,
        midboss: 40, boss: 'ceifador',
        scene: [
            'CENA — Campo de tendas, ao sul. Madrugada.',
            'Uma menina de dez anos, Amal, gira o botão de um rádio de pilha. Entre os chiados, ouve a voz de um piloto brasileiro.',
            '"Mãe, ele está vindo pra cá?" A mãe não responde. Só aperta a mão da filha com mais força.',
            'Lá fora, o zumbido dos drones não para há onze dias.'
        ],
        briefing: [
            'CORONEL BALDANZA: O cerco externo caiu, mas a TRÍADE respondeu como sempre — atacando quem não pode se defender.',
            'Ao sul, um campo com quarenta mil pessoas vivendo em tendas de lona foi declarado "zona segura". Desde ontem, enxames de drones caçam qualquer fila de água.',
            'O operador do enxame usa o codinome "CEIFADOR" e comanda tudo de uma nave-mãe. Derrube a nave e o enxame cai junto.',
            'Cada drone que passar por você é uma tenda a menos, {P}.'
        ],
        radio: [
            [3, 'Baependi', 'Enxames chegando do leste. Fique entre eles e o campo.'],
            [15, 'AMAL', 'Alô? Alô? Aqui é a Amal... meu tio disse que esse rádio fala com aviões. Você tá ouvindo?'],
            [24, 'Baependi', '{P}, uma criança entrou na nossa frequência. Deixa o canal aberto.'],
            [38, 'AMAL', 'Eu tô vendo a sua fumaça no céu! Minha irmã tá contando quantos você derruba!'],
            [55, 'DRA. Camila', 'Estou no posto médico do campo. Os drones miraram a fila do pão. Por favor... mais rápido.'],
            [70, 'Baependi', 'Sinal da nave-mãe! É o Ceifador.']
        ]
    },
    {
        name: 'Cidade às Escuras', chapter: 'A NOITE MAIS LONGA', bg: 'bg2', duration: 80, ambient: 0.72, grade: 'rgba(40,70,160,0.16)', music: 'stage2',
        weather: 'none', searchlights: true, hudColor: '#8fd3ff', ground: 'sam', groundEvery: [6, 10],
        pool: { lineDive: 2, vForm: 2, heliPair: 3, ringHeli: 2, drones: 2, mixed: 2 }, waveEvery: [2.8, 3.8], maxEnemies: 11,
        midboss: 40, boss: 'vespa',
        scene: [
            'CENA — Campo de tendas. Noite.',
            'Amal adormeceu abraçada ao rádio. Pela primeira vez em onze dias, não se ouviu nenhum drone.',
            'Mas do outro lado da cidade, as luzes se apagaram de uma vez. Todas.'
        ],
        briefing: [
            'A TRÍADE cortou a energia da cidade inteira. Incubadoras, respiradores, bombas d\'água — tudo parado.',
            'A Dra. Camila Rodrigues opera à luz de lanterna de celular. Um comboio de combustível tenta chegar ao Hospital Al-Amal esta noite.',
            'Holofotes antiaéreos varrem o céu. Se for DETECTADO, todas as baterias concentram fogo em você.',
            'Caçando o comboio está a VESPA DE AÇO, helicóptero pesado da unidade "VESPA". A ordem dele é simples: nenhum caminhão chega.'
        ],
        radio: [
            [3, 'DRA. Camila', 'Os geradores têm combustível para três horas. Três horas, {P}. Tenho onze bebês nas incubadoras.'],
            [14, 'SINAL DESCONHECIDO', 'Aqui é Noa. Eu pilotava para eles. Me recusei a bombardear um campo de refugiados e fui presa. Fugi ontem.'],
            [21, 'NOA', 'Os holofotes giram em padrão fixo. Voe entre os fachos e eles ficam cegos. Nem todos do nosso lado querem essa guerra.'],
            [30, 'Lula', 'Drones kamikaze! Eles vão direto em você!'],
            [48, 'Lula', 'Uma piloto deles ajudando a gente... a TRÍADE não manda no coração de ninguém.'],
            [66, 'Baependi', 'Rotores pesados se aproximando do comboio!']
        ]
    },
    {
        name: 'Hospital Sitiado', chapter: 'A ÚLTIMA LUZ', bg: 'bg1', flipX: true, duration: 80, ambient: 0.4, grade: 'rgba(200,60,40,0.18)', music: 'hospital',
        weather: 'embers', hudColor: '#ff9e80', ground: 'sam', groundEvery: [7, 11],
        pool: { heliPair: 3, lineDive: 2, vForm: 2, drones: 2, ringHeli: 2 }, waveEvery: [2.8, 3.7], maxEnemies: 12,
        midboss: 41, boss: 'espectro',
        scene: [
            'CENA — Hospital Al-Amal. Corredor do terceiro andar.',
            'O gerador voltou a funcionar graças ao combustível que você escoltou. Por algumas horas, as luzes ficaram acesas.',
            'Então chegou o ultimato: "evacuem o hospital em duas horas". Há seiscentos pacientes. Metade não consegue andar.',
            'A Dra. Camila assina a última folha de prontuário e diz à equipe: "Ninguém sai sozinho. Ninguém fica para trás."'
        ],
        briefing: [
            'CORONEL BALDANZA: A TRÍADE cercou o hospital. Um avião-canhoneira circula sobre o bairro há horas, atirando em qualquer ambulância.',
            'Codinome "ESPECTRO": uma fortaleza de quatro motores com canhões laterais. Ele nunca para no ar — gira em torno do alvo.',
            'Os comboios de evacuação saem pelo norte. Mantenha o céu limpo sobre eles até o último paciente sair.',
            'Não há outra forma de dizer isso, {P}: se eles passarem, as ambulâncias não chegam.'
        ],
        radio: [
            [3, 'DRA. Camila', 'Primeira ambulância saindo. Três bebês em incubadoras portáteis. Cobre a gente, {P}.'],
            [16, 'SAMIR', 'Aqui é Samir, enfermeiro. Estou dirigindo o ônibus com os pacientes de hemodiálise. Só não deixe eles chegarem perto.'],
            [30, 'Baependi', 'Helicópteros tentando fechar a rua principal!'],
            [46, 'DRA. Camila', 'O prédio da maternidade foi atingido. Todos já tinham saído. Todos. Graças a você.'],
            [60, 'NOA', 'Noa na escuta. Interceptei a frequência do Espectro: ele sempre gira em torno do alvo. Antecipe a curva.'],
            [74, 'Baependi', 'Quatro motores no radar. O Espectro chegou.']
        ]
    },
    {
        name: 'Floresta Silenciosa', chapter: 'O ÊXODO', bg: 'bg3', duration: 85, ambient: 0.28, grade: 'rgba(80,140,90,0.14)', music: 'stage3',
        weather: 'fog', hudColor: '#b6ffb0', ground: 'sam', groundEvery: [7, 11],
        pool: { heliPair: 3, ringHeli: 3, swoop: 3, vForm: 2, drones: 2 }, waveEvery: [2.6, 3.5], maxEnemies: 12,
        midboss: 42, boss: 'sol',
        scene: [
            'CENA — Estrada do norte. Ao nascer do sol.',
            'As ambulâncias do hospital chegam a um galpão abandonado. Os pacientes são deitados em papelão, lado a lado.',
            'A Dra. Camila conta as macas duas vezes. Ninguém faltou.',
            'A próxima rota de fuga passa pela mata. É longa, escura — e os helicópteros já estão lá.'
        ],
        briefing: [
            'Milhares de famílias fogem a pé pela mata rumo ao porto onde a flotilha vai atracar. Levam o que cabe nas mãos.',
            'A TRÍADE mandou o braço japonês da aliança: interceptadores velozes e o protótipo SOL NASCENTE, pilotado por "Sugawara".',
            'Um engenheiro do projeto vazou os planos para nós: o laser do protótipo superaquece depois de cada disparo. Ataque nessa janela.',
            'A neblina esconde os refugiados — e também os helicópteros que os caçam.'
        ],
        radio: [
            [3, 'Lula', 'Não vejo nada nessa neblina... fica perto, {P}.'],
            [15, 'HIROSHI', 'Sou Hiroshi Tanaka, engenheiro do Sol Nascente. Construí aquela máquina acreditando que defenderia pessoas. Me enganaram. Usem o que enviei.'],
            [31, 'Baependi', 'Interceptadores cruzando pelo flanco!'],
            [50, 'Lula', 'Tem gente lá embaixo... uma mulher carregando duas crianças. Segura esses helicópteros longe da trilha!'],
            [74, 'Baependi', 'Assinatura térmica fora da escala. É o Sugawara.']
        ]
    },
    {
        name: 'A Travessia do Rio', chapter: 'A CORDA', bg: 'bg6', duration: 85, ambient: 0.24, grade: 'rgba(255,140,80,0.12)', music: 'river',
        weather: 'rain', hudColor: '#9fe0ff', ground: 'sam', groundEvery: [7, 10],
        pool: { swoop: 3, vForm: 3, heliPair: 2, lineDive: 2, drones: 2 }, waveEvery: [2.5, 3.4], maxEnemies: 13,
        midboss: 43, boss: 'tita',
        scene: [
            'CENA — Margem do rio. Fim de tarde.',
            'A ponte foi destruída de manhã. As famílias atravessam com água pela cintura, crianças nos ombros, colchões na cabeça.',
            'Um velho chamado Abu Yusuf amarrou uma corda de uma margem à outra. Está ali há seis horas, segurando quem escorrega.',
            'Amal está na fila. Ela segura o rádio acima da cabeça para não molhar.'
        ],
        briefing: [
            'CORONEL BALDANZA: Do outro lado do rio fica a estrada para o porto. Quem atravessar hoje tem chance de embarcar na flotilha.',
            'A TRÍADE mandou um helicóptero de carga pesado, o TITÃ, para lançar minas no rio e cortar a travessia.',
            'Ele tem dois rotores blindados nas laterais. Destrua os rotores primeiro — só então a fuselagem fica exposta.',
            'Cada minuto que você ganhar é uma família do outro lado.'
        ],
        radio: [
            [3, 'AMAL', '{P}! Tô na fila do rio! A água tá gelada, mas o Abu Yusuf disse que hoje todo mundo passa!'],
            [14, 'ABU YUSUF', 'Piloto, eu já vi três guerras deste rio. Nunca vi alguém vir de tão longe para nos ajudar. Que Deus guarde suas asas.'],
            [28, 'Baependi', 'Caças cruzando o rio em rasante! Eles estão mirando a corda!'],
            [44, 'AMAL', 'Minha irmã escorregou! ... O Abu Yusuf pegou ela! Ela tá bem! Ela tá bem!'],
            [58, 'HIROSHI', 'Hiroshi aqui. O Titã carrega minas magnéticas — seus tiros detonam as minas antes de caírem na água.'],
            [74, 'Baependi', 'Rotores duplos no horizonte. É o Titã.']
        ]
    },
    {
        name: 'Deserto de Fogo', chapter: 'O PREÇO', bg: 'bg4', duration: 90, ambient: 0.05, grade: 'rgba(255,180,80,0.14)', music: 'stage4',
        weather: 'sand', hudColor: '#ffd36b', ground: 'sam', groundEvery: [3.8, 6],
        pool: { lineDive: 3, swoop: 3, heliPair: 2, drones: 3, mixed: 3 }, waveEvery: [2.4, 3.2], maxEnemies: 13,
        midboss: 45, boss: 'leviata',
        scene: [
            'CENA — Do outro lado do rio.',
            'Abu Yusuf solta a corda pela última vez e senta na areia, exausto. Amal coloca o próprio cobertor nas costas dele.',
            '"Agora falta pouco", ele diz. "Só o deserto. E depois, o mar."',
            'No horizonte, as baterias de mísseis da TRÍADE acendem uma a uma, como uma cerca de fogo.'
        ],
        briefing: [
            'O último anel do bloqueio: um cinturão de baterias de mísseis cravado no deserto, da fronteira até o mar.',
            'Atrás dele, a TRÍADE ergueu os chamados "centros de triagem". Quem entra não sai. É ali que a Doutrina Tábula Rasa acontece longe das câmeras.',
            'Cada bateria destruída abre uma brecha para a flotilha. No fim do setor aguarda o LEVIATÃ, a fortaleza conjunta da aliança. Derrube as torres laterais — só então o núcleo fica exposto.',
            'Lula vai na frente para atrair o fogo. Não discuta, {P}. É uma ordem.'
        ],
        radio: [
            [3, 'Baependi', 'Baterias SAM por todo o setor. Limpe o caminho.'],
            [20, 'Lula', '{P}... se eu não voltar, minha esposa se chama Janja. Tem sete anos. Diz pra ela que o pai tentou.'],
            [43, 'Lula', 'Mais um bombardeiro, escoltado! Deixa a escolta comigo!'],
            [57, 'Lula', 'Fui atingido! Motor em chamas! Ejetando! EJETAN—'],
            [61, 'Baependi', '...Perdemos o sinal do Lula. Continue, {P}. Ele escolheu isso por você.'],
            [80, 'Baependi', 'Leviatã detectado. Mire nas torres laterais!']
        ]
    },
    {
        name: 'Céu de Ferro', chapter: 'SOZINHO', bg: 'bg2', flipX: true, duration: 90, ambient: 0.78, grade: 'rgba(90,40,140,0.16)', music: 'ironsky',
        weather: 'embers', searchlights: true, hudColor: '#c9a7ff', ground: 'sam', groundEvery: [4.5, 7],
        pool: { lineDive: 3, vForm: 2, swoop: 2, drones: 3, mixed: 3 }, waveEvery: [2.3, 3.1], maxEnemies: 14,
        midboss: 40, boss: 'sombra',
        scene: [
            'CENA — Base Baependi. Hangar 3. Madrugada.',
            'O capacete do seu ala está sobre a mesa, ainda com areia do deserto. Ninguém teve coragem de tocar nele.',
            'A Coronel Baldanza olha o mapa por um longo tempo antes de falar: "Eles vão jogar tudo na estrada costeira esta noite. Você vai sozinho."',
            'No rádio, a voz pequena de Amal: "O seu amigo vai voltar. Eu sei que vai."'
        ],
        briefing: [
            'CORONEL BALDANZA: A TRÍADE lançou a operação "Céu de Ferro" — bombardeio em tapete sobre a estrada costeira, onde as famílias caminham rumo ao porto.',
            'O bombardeiro furtivo SOMBRA lidera a operação. Ele some do radar por instantes; fique atento ao brilho dos motores.',
            'Os holofotes voltaram. Se for detectado, toda a artilharia mira em você.',
            'Noa conseguiu um caça e vai te dar cobertura pelo rádio. Não estamos sozinhos, {P}. Ainda não.'
        ],
        radio: [
            [3, 'NOA', 'Noa decolando num caça "emprestado". Não me pergunte como. Estou no seu flanco, fora do radar deles.'],
            [16, 'AMAL', 'A estrada tá cheia de gente andando no escuro. Minha mãe disse pra não acender a lanterna.'],
            [30, 'Baependi', 'Bombardeiros em formação! Eles vão marcar a estrada inteira!'],
            [46, 'NOA', 'Já fui parte disso, {P}. Já voei numa noite como esta do outro lado. Hoje eu quero desfazer pelo menos um pouco.'],
            [62, 'DRA. Camila', 'O posto médico da estrada está recebendo feridos de todas as direções. Segura mais um pouco!'],
            [76, 'Baependi', 'Assinatura fantasma... ela some e volta. É a Sombra.']
        ]
    },
    {
        name: 'Porto da Esperança', chapter: 'O CAIS', bg: 'bg5', flipX: true, duration: 92, ambient: 0.28, grade: 'rgba(255,190,140,0.14)', music: 'port',
        weather: 'fog', hudColor: '#ffd0a0', ground: 'gb', groundEvery: [4, 6.5],
        pool: { lineDive: 3, vForm: 2, swoop: 3, heliPair: 2, drones: 2, mixed: 3 }, waveEvery: [2.2, 3.0], maxEnemies: 14,
        midboss: 42, boss: 'colosso',
        scene: [
            'CENA — Porto de Gaza. Amanhecer.',
            'Milhares de pessoas chegaram ao cais durante a noite. Sentam no chão molhado, de frente para o mar, esperando ver velas no horizonte.',
            'Amal desenha um avião verde e amarelo num pedaço de papelão e prende numa vara, como uma bandeira.',
            'No horizonte, ainda escondido pela neblina, um porta-aviões da TRÍADE bloqueia a entrada da baía.'
        ],
        briefing: [
            'CORONEL BALDANZA: A flotilha está a doze horas do porto. Mas a TRÍADE ancorou o porta-aviões COLOSSO na boca da baía.',
            'Ele lança caças sem parar e tem baterias no convés. Enquanto estiver ali, nenhum barco entra.',
            'Destrua as baterias do convés para expor a ponte de comando.',
            'Depois dele, só resta o mar aberto. Estamos quase lá, {P}.'
        ],
        radio: [
            [3, 'AMAL', 'Eu tô no cais! Fiz uma bandeira com o seu avião! Todo mundo tá olhando pro céu!'],
            [16, 'Baependi', 'Caças decolando do Colosso. Muitos.'],
            [30, 'DRA. Camila', 'Montamos um hospital de campanha no armazém do porto. Se a flotilha chegar, temos remédio para todos.'],
            [45, 'HIROSHI', 'Os elevadores do convés do Colosso param quando as baterias caem. Ele não consegue lançar mais caças.'],
            [60, 'NOA', 'Meus motores estão falhando, {P}. Vou pousar na praia, perto do cais. A partir daqui, o céu é seu.'],
            [78, 'Baependi', 'Sinal de navio gigante na neblina. É o Colosso.']
        ]
    },
    {
        name: 'Mar da Flotilha', chapter: 'A TRAVESSIA', bg: 'bg5', duration: 95, ambient: 0.4, grade: 'rgba(60,90,130,0.18)', music: 'stage5',
        weather: 'rain', hudColor: '#ff8a80', ground: 'gb', groundEvery: [4.5, 7],
        pool: { lineDive: 2, vForm: 2, swoop: 3, heliPair: 2, ringHeli: 2, drones: 3, mixed: 3 }, waveEvery: [2.2, 3.0], maxEnemies: 14,
        midboss: 45, boss: 'supremo',
        scene: [
            'CENA — Mar aberto.',
            'As velas aparecem no horizonte. No cais, alguém começa a cantar baixinho, e logo são milhares cantando juntos.',
            'Amal sobe nos ombros da mãe e levanta a bandeira de papelão o mais alto que consegue.',
            'Atrás das nuvens, um ronco grave cresce. O Comando Supremo decolou.'
        ],
        briefing: [
            'Quarenta barcos. Arroz, farinha, insulina, leite em pó. Médicos e voluntários de quarenta e quatro países, desarmados.',
            'No porto, uma multidão espera desde a madrugada. A Dra. Camila está lá, com os pacientes que conseguiram andar.',
            'O ARQUITETO — o rosto por trás da TRÍADE e da Doutrina Tábula Rasa — decolou pessoalmente no COMANDO SUPREMO para afundar a flotilha diante das câmeras do mundo inteiro.',
            'Lanchas armadas patrulham a costa. Cada inimigo que passar por você ameaça um barco — o bônus de escolta cai.',
            'Não há reforços. Só você, {P}. Faça valer.'
        ],
        radio: [
            [3, 'CAP. Janones', 'Flotilha da Liberdade para a escolta brasileira. Estamos te vendo, piloto. Seguimos com você.'],
            [18, 'DRA. Camila', 'As crianças estão no cais acenando bandeiras. Elas não sabem o seu nome, mas sabem que você veio.'],
            [34, 'Baependi', 'Não deixe ninguém passar!'],
            [50, 'PESCADOR', 'Aqui é o barco pesqueiro Al-Bahr, de Gaza! Tiramos um piloto brasileiro do mar! Ele diz que se chama Lula!'],
            [55, 'Lula', 'Tô vivo, {P}! Encharcado, quebrado, mas vivo! ACABA COM ELES!'],
            [84, 'Baependi', 'É agora, {P}. Tudo ou nada.']
        ]
    }
];

const STORY = {
    prologue: [
        '2026. Nos bastidores, os comandos militares dos Estados Unidos, de Israel e do Japão selaram um pacto secreto: a TRÍADE.',
        'Sua doutrina oficial tem nome — TÁBULA RASA: apagar do mapa povos inteiros e minorias "inconvenientes" para redesenhar fronteiras, rotas e mercados.',
        'O primeiro alvo é a Palestina. Dois milhões de pessoas cercadas em Gaza, sem comida, sem água, sem remédios. Hospitais às escuras. Crianças na fila do pão.',
        'Uma flotilha civil de quarenta barcos zarpou com ajuda humanitária. A TRÍADE prometeu afundá-la. Nenhum governo ousou escoltá-la.',
        'Mas, numa base aérea no litoral do Nordeste, uma coronel decidiu desobedecer.',
        'Um único caça. Um único piloto. Você.'
    ],
    epilogue: [
        'O Comando Supremo afunda no Mediterrâneo. Sem o Arquiteto, o bloqueio se desfaz em poucas horas.',
        'Os quarenta barcos atracam. Pela primeira vez em meses, há pão quente em Gaza.',
        'DRA. Camila: "Hoje nenhuma criança dormiu com fome. Diga ao Brasil que nós nunca vamos esquecer o seu nome."',
        'Lula volta para casa enrolado numa bandeira palestina que ganhou dos pescadores. Janja corre para o abraço na pista.',
        'Amal ganha o primeiro pão quente em meses e divide em cinco pedaços: para a mãe, para a irmã, para Abu Yusuf, para ela... e um que ela guarda "para o piloto".'
    ],
    // final das dificuldades Recruta e Veterano: a história termina aqui
    endingNormal: [
        'Pelo rádio, uma última vez, a voz de Amal: "Obrigada por ter vindo. Quando tudo acabar, volta pra visitar a gente?"',
        'MISSÃO CONCLUÍDA. A flotilha chegou. O corredor está aberto.',
        'Quer um desafio de verdade? No modo Ás, a guerra não termina aqui.'
    ],
    // final do modo Ás: abre os ciclos infinitos
    endingAs: [
        'Mas a TRÍADE tem esquadras espalhadas pelo planeta, e agora quer vingança. Novas frentes se abrem — e outros povos estão na mira.',
        'A guerra nos céus continua. Desta vez, eles vêm com tudo — e cada ciclo será mais impiedoso que o anterior.'
    ],
    // texto extra no início de cada ciclo após o primeiro
    loops: [
        'CONTRAOFENSIVA: a TRÍADE reconstruiu suas frotas com tudo o que tinha. Mais inimigos, mais blindados, mais rápidos — e sem piedade.',
        'GUERRA TOTAL: a aliança mobilizou todas as reservas. Cada bateria, cada caça, cada drone aponta para você.',
        'O FIM DA TRÍADE: dizem que ninguém sobrevive a este céu. Você já ouviu isso antes.'
    ],
    gameOver: [
        'No cais, a Dra. Camila desliga o rádio em silêncio.',
        'No campo de tendas, Amal continua chamando no rádio. Ninguém responde.',
        'A flotilha seguiu sem escolta. Ninguém sabe se chegou.',
        'Na Base Baependi, a coronel Baldanza guarda seu capacete na parede.',
        'A TRÍADE anuncia vitória. Mas a história ainda não acabou — levante-se, piloto.'
    ]
};

// --- CHEFES -------------------------------------------------------------------
// phases: limiar de vida (fração) a partir do qual a fase vale + padrões de ataque
const BOSSES = {
    fortaleza: {
        name: 'FORTALEZA VOADORA', pilot: 'TRUMP', sprite: 'chefao', w: 270, hp: 5000,
        intro: 'Brasileiro? Volte para o seu carnaval. Aqui quem decide quem vive somos nós.',
        outro: ['Lula', 'O Trump caiu! O cerco externo está aberto!'], r: 95, move: 'sway', speed: 70, alt: 1.5,
        engines: [[-0.36, -0.12], [0.36, -0.12], [-0.12, -0.3], [0.12, -0.3]],
        phases: [
            { at: 1.0,  patterns: ['aimedFan', 'sideTurrets', 'ring'] },
            { at: 0.6,  patterns: ['spiral', 'sideTurrets', 'aimedFan', 'missiles'] },
            { at: 0.3,  patterns: ['spiralDouble', 'missiles', 'ring', 'aimedFan'], rage: true }
        ]
    },
    vespa: {
        name: 'VESPA DE AÇO', pilot: 'NETANYAHU', sprite: 'helicopteroEUA', w: 250, hp: 6000,
        intro: 'Comboio localizado. Nenhum caminhão chega ao hospital. Nenhum.',
        outro: ['DRA. Camila', 'O combustível chegou! As luzes voltaram! Os bebês estão bem... obrigada.'], r: 80, move: 'strafe', speed: 120, alt: 0.9, rotor: true,
        engines: [],
        phases: [
            { at: 1.0, patterns: ['minigun', 'rocketBarrage', 'aimedFan'] },
            { at: 0.55, patterns: ['minigun', 'drones', 'rocketBarrage', 'ring'] },
            { at: 0.25, patterns: ['minigunDouble', 'rocketBarrage', 'spiral'], rage: true }
        ]
    },
    sol: {
        name: 'SOL NASCENTE', pilot: 'SUGAWARA', sprite: 'aviaoJAPAO', w: 210, hp: 6600,
        intro: 'Honra é obedecer. Você arrisca a vida por gente que nem conhece.',
        outro: ['Lula', 'Sugawara abatido! As famílias estão saindo da mata!'], r: 70, move: 'dash', speed: 160, alt: 1.2,
        engines: [[-0.08, -0.45], [0.08, -0.45]],
        phases: [
            { at: 1.0, patterns: ['fanWide', 'laserSweep', 'dashRun'] },
            { at: 0.55, patterns: ['laserSweep', 'dashRun', 'spiral', 'fanWide'] },
            { at: 0.25, patterns: ['laserTwin', 'dashRun', 'spiralDouble'], rage: true }
        ]
    },
    leviata: {
        name: 'LEVIATÃ', pilot: 'JD VANCE', sprite: 'chefao', tint: '#9a7a4a', w: 300, hp: 7000,
        intro: 'Seu ala virou cinza no deserto. Ninguém lembra de quem fica pelo caminho, brasileiro.',
        outro: ['Baependi', 'O cinturão caiu! O mar está aberto para a flotilha!'], r: 100, move: 'sway', speed: 55, alt: 1.6,
        engines: [[-0.36, -0.12], [0.36, -0.12], [-0.12, -0.3], [0.12, -0.3]],
        parts: [ { ox: -0.36, oy: 0.08, r: 26, hp: 900 }, { ox: 0.36, oy: 0.08, r: 26, hp: 900 } ],
        phases: [
            { at: 1.0, patterns: ['partsFire', 'laserTwin', 'mines'] },
            { at: 0.5, patterns: ['spiral', 'laserTwin', 'mines', 'missiles'] },
            { at: 0.22, patterns: ['spiralDouble', 'laserSweep', 'missiles', 'ring'], rage: true }
        ]
    },
    supremo: {
        name: 'COMANDO SUPREMO', pilot: 'SUPER TRUMP', sprite: 'chefao', tint: '#7a1b1b', w: 330, hp: 11000,
        intro: 'Povos são linhas num mapa. Eu apago linhas. Você é só mais uma.',
        outro: ['O ARQUITETO', 'Impossível... um único... avião...'], r: 110, move: 'sway', speed: 60, alt: 1.7,
        engines: [[-0.36, -0.12], [0.36, -0.12], [-0.12, -0.3], [0.12, -0.3]],
        parts: [ { ox: -0.38, oy: 0.05, r: 26, hp: 800 }, { ox: 0.38, oy: 0.05, r: 26, hp: 800 } ],
        phases: [
            { at: 1.0, patterns: ['partsFire', 'aimedFan', 'drones', 'ring'] },
            { at: 0.66, patterns: ['spiralDouble', 'laserTwin', 'missiles', 'mines'] },
            { at: 0.33, patterns: ['laserSweep', 'spiralDouble', 'drones', 'rocketBarrage', 'minigunDouble'], rage: true }
        ]
    },
    ceifador: {
        name: 'NAVE-MÃE CEIFADORA', pilot: 'CEIFADOR', sprite: 'boss_ceifador', w: 260, hp: 5200,
        intro: 'Contei quarenta mil alvos neste campo. Você é só mais um ponto no meu radar.',
        outro: ['AMAL', 'Os drones caíram! Todo mundo tá saindo das tendas! Minha mãe tá chorando... de alegria, eu acho.'], r: 90, move: 'sway', speed: 60, alt: 1.3,
        engines: [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]],
        parts: [ { ox: -0.38, oy: -0.38, r: 24, hp: 500 }, { ox: 0.38, oy: -0.38, r: 24, hp: 500 } ],
        phases: [
            { at: 1.0, patterns: ['droneSwarm', 'aimedFan', 'ring'] },
            { at: 0.55, patterns: ['droneRing', 'droneSwarm', 'spiral'] },
            { at: 0.25, patterns: ['droneSwarm', 'spiralDouble', 'droneRing', 'missiles'], rage: true }
        ]
    },
    espectro: {
        name: 'CANHONEIRA ESPECTRO', pilot: 'ESPECTRO', sprite: 'boss_espectro', w: 300, hp: 6200,
        intro: 'Vejo cada maca daqui de cima. Ninguém sai deste hospital.',
        outro: ['DRA. Camila', 'Último paciente fora! O hospital está vazio... e todos estão vivos. Todos!'], r: 85, move: 'orbit', speed: 90, alt: 1.5,
        engines: [[-0.3, -0.05], [-0.16, -0.05], [0.16, -0.05], [0.3, -0.05]],
        phases: [
            { at: 1.0, patterns: ['broadside', 'aimedFan', 'missiles'] },
            { at: 0.55, patterns: ['broadside', 'flakBarrage', 'minigun'] },
            { at: 0.25, patterns: ['broadside', 'flakBarrage', 'minigunDouble', 'rocketBarrage'], rage: true }
        ]
    },
    tita: {
        name: 'TITÃ DE CARGA', pilot: 'TITÃ', sprite: 'boss_tita', w: 190, hp: 6600,
        intro: 'Um rio é uma fronteira. Fronteiras existem para que alguns fiquem do lado errado.',
        outro: ['ABU YUSUF', 'O Titã caiu no rio! Atravessem, atravessem! A corda aguenta todo mundo hoje!'], r: 90, move: 'strafe', speed: 85, alt: 1.0, rotors2: true,
        engines: [],
        parts: [ { ox: 0, oy: -0.36, r: 30, hp: 900, rotor: true }, { ox: 0, oy: 0.36, r: 30, hp: 900, rotor: true } ],
        phases: [
            { at: 1.0, patterns: ['mineCarpet', 'partsFire', 'aimedFan'] },
            { at: 0.5, patterns: ['mineCarpet', 'rocketBarrage', 'ring', 'drones'] },
            { at: 0.22, patterns: ['mineCarpet', 'spiralDouble', 'rocketBarrage', 'minigunDouble'], rage: true }
        ]
    },
    sombra: {
        name: 'BOMBARDEIRO SOMBRA', pilot: 'SOMBRA', sprite: 'boss_sombra', w: 340, hp: 7400,
        intro: 'Você não pode atirar no que não vê. E esta noite, ninguém vai ver o amanhecer.',
        outro: ['NOA', 'A Sombra caiu em chamas! A estrada está livre! Olha só... estão acendendo as lanternas.'], r: 100, move: 'sway', speed: 75, alt: 1.7,
        engines: [[-0.12, 0.2], [0.12, 0.2], [-0.25, 0.18], [0.25, 0.18]],
        phases: [
            { at: 1.0, patterns: ['carpetBomb', 'cloak', 'aimedFan'] },
            { at: 0.55, patterns: ['carpetBomb', 'cloak', 'laserTwin', 'missiles'] },
            { at: 0.25, patterns: ['carpetBomb', 'cloak', 'spiralDouble', 'laserSweep'], rage: true }
        ]
    },
    colosso: {
        name: 'PORTA-AVIÕES COLOSSO', pilot: 'COLOSSO', sprite: 'boss_colosso', w: 300, hp: 8000,
        intro: 'Este porto está fechado. Para sempre. Diga às crianças no cais para olharem para o outro lado.',
        outro: ['Baependi', 'O Colosso está afundando! A baía está aberta! A flotilha pode entrar!'], r: 100, move: 'fixed', speed: 30, alt: 0, sea: true,
        engines: [],
        parts: [ { ox: -0.28, oy: -0.22, r: 24, hp: 800 }, { ox: 0.3, oy: 0.02, r: 24, hp: 800 }, { ox: -0.28, oy: 0.26, r: 24, hp: 800 } ],
        phases: [
            { at: 1.0, patterns: ['launchJets', 'partsFire', 'flakBarrage'] },
            { at: 0.5, patterns: ['launchJets', 'spiral', 'flakBarrage', 'missiles'] },
            { at: 0.22, patterns: ['launchJets', 'spiralDouble', 'rocketBarrage', 'laserSweep'], rage: true }
        ]
    }
};

// --- MELHORIAS ENTRE FASES (escolha 1 de 3) -------------------------------------
const PERKS = [
    { id: 'armor',    name: 'Blindagem Reforçada', desc: '+30 de vida máxima e reparo total.',              icon: '🛡' },
    { id: 'ap_ammo',  name: 'Munição Perfurante',  desc: '+15% de dano em todas as armas.',                 icon: '◆' },
    { id: 'turbo',    name: 'Oficina de Motores',  desc: '+150 XP de motor.',    icon: '➤' },
    { id: 'magnet',   name: 'Ímã de Suprimentos',  desc: 'Power-ups são atraídos até você.',                 icon: '⊕', once: true },
    { id: 'bombbay',  name: 'Compartimento Extra', desc: '+1 capacidade de bomba e +1 bomba agora.',        icon: '✸' },
    { id: 'regen',    name: 'Escudo Regenerativo', desc: 'Começa cada fase com escudo ativo.',              icon: '◎', once: true },
    { id: 'missiles', name: 'Pods de Mísseis',     desc: '+150 XP de mísseis teleguiados.',                icon: '⇡' },
    { id: 'fury',     name: 'Adrenalina',          desc: 'A barra de Fúria enche 40% mais rápido.',         icon: '⚡' },
    { id: 'armory',   name: 'Arsenal da FAB',      desc: '+150 XP de canhão.',                              icon: '⌖' },
    { id: 'repair',   name: 'Kit de Reparos',      desc: 'Regenera 1 de vida a cada 2 segundos.',           icon: '✚', once: true }
];
