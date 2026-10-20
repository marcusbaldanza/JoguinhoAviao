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
const DIFFICULTY = {
    recruta:  { label: 'Recruta',  dmgTaken: 0.6,  enemyHp: 0.85, bulletSpeed: 0.88, fireRate: 0.8,  density: 0.85, elite: 0.0,  score: 0.3, bombs: 3 },
    veterano: { label: 'Veterano', dmgTaken: 0.9,  enemyHp: 1.0,  bulletSpeed: 1.0,  fireRate: 1.0,  density: 1.0,  elite: 0.03, score: 1.0,  bombs: 2 },
    as:       { label: 'Ás',       dmgTaken: 1.25, enemyHp: 1.25, bulletSpeed: 1.12, fireRate: 1.25, density: 1.2,  elite: 0.1,  score: 1.7,  bombs: 1 }
};
// Escalonamento por "progressão global" g = fase + 5 × ciclo (g = 0 na 1ª fase).
// Linear dentro do ciclo + composto entre ciclos: o jogo nunca "estabiliza".
const SCALING = {
    hpPerStage: 0.24, dmgPerStage: 0.16, fireRatePerStage: 0.08, bulletSpeedPerStage: 0.035, densityPerStage: 0.14, elitePerStage: 0.045,
    loopCompound: { hp: 1.5, dmg: 1.35, fireRate: 1.12, density: 1.08 },
    caps: { fireRate: 3.0, bulletSpeed: 1.7, density: 3.2, elite: 0.6 },
    // pressão adaptativa: quanto mais evoluído o avião, mais inimigos e mais resistentes
    powerHp: 0.45, powerDensity: 0.6
};

// --- JOGADOR -----------------------------------------------------------
const PLAYER_CFG = {
    maxHp: 100,
    hpPerStage: 15,          // vida máxima ganha a cada fase vencida
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
// xp[i] = custo para subir do nível i+1 para i+2.
const UPGRADES = {
    cannon:  { max: 12, start: 1, xp: [100, 120, 150, 190, 230, 270, 320, 370, 420, 480, 540] },
    engine:  { max: 8,  start: 1, xp: [100, 130, 170, 210, 250, 300, 350] },
    missile: { max: 6,  start: 0, xp: [100, 140, 190, 240, 300, 360] }
};
const GEAR_XP = 12, GEAR_DROP = 0.3;  // a chance de peça cai quando a densidade de inimigos sobe

// Canhão — 12 níveis (1 por modelo de avião). guns: [deslocamento x, ângulo°]; pierce = atravessa inimigos
const CANNON_LEVELS = [
    null, // abertura máxima ±7°: o poder cresce pela FRENTE (mais canos, dano, perfuração), não pelos lados
    { rate: 7,    dmg: 9,  w: 3.5, guns: [[0, 0]] },
    { rate: 7.5,  dmg: 9,  w: 3.8, guns: [[-7, 0], [7, 0]] },
    { rate: 8,    dmg: 10, w: 4,   guns: [[-9, 0], [0, 0], [9, 0]] },
    { rate: 8.5,  dmg: 10, w: 4.2, guns: [[-11, -1], [-4, 0], [4, 0], [11, 1]] },
    { rate: 9,    dmg: 11, w: 4.5, guns: [[-14, -2], [-6, 0], [0, 0], [6, 0], [14, 2]] },
    { rate: 9.5,  dmg: 12, w: 4.8, guns: [[-16, -3], [-7, -1], [0, 0], [7, 1], [16, 3]], pierce: 1 },
    { rate: 10,   dmg: 13, w: 5,   guns: [[-18, -3], [-11, -1], [-4, 0], [4, 0], [11, 1], [18, 3]], pierce: 1 },
    { rate: 10.5, dmg: 14, w: 5.2, guns: [[-20, -4], [-12, -1], [-4, 0], [4, 0], [12, 1], [20, 4]], pierce: 1 },
    { rate: 11,   dmg: 15, w: 5.5, guns: [[-22, -4], [-14, -2], [-7, 0], [0, 0], [7, 0], [14, 2], [22, 4]], pierce: 2 },
    { rate: 11.5, dmg: 16, w: 5.8, guns: [[-24, -5], [-15, -2], [-7, 0], [0, 0], [7, 0], [15, 2], [24, 5]], pierce: 2 },
    { rate: 12,   dmg: 17, w: 6,   guns: [[-26, -6], [-18, -3], [-10, -1], [-3, 0], [3, 0], [10, 1], [18, 3], [26, 6]], pierce: 2 },
    { rate: 13,   dmg: 18, w: 6.5, guns: [[-28, -7], [-20, -4], [-12, -1], [-5, 0], [0, 0], [5, 0], [12, 1], [20, 4], [28, 7]], pierce: 3 }
];
// Motor — 8 níveis: velocidade, recarga da rolagem, cor/tamanho do pós-combustor e propulsores extras
const ENGINE_LEVELS = [
    null,
    { speed: 1.00, roll: 1.00, flame: '#ff9a3a', len: 1.0,  boosters: 0, name: 'Turbojato' },
    { speed: 1.05, roll: 0.96, flame: '#ffb347', len: 1.1,  boosters: 0, name: 'Turbofan' },
    { speed: 1.10, roll: 0.92, flame: '#4fb4ff', len: 1.2,  boosters: 2, name: 'Pós-combustor' },
    { speed: 1.15, roll: 0.88, flame: '#39d5ff', len: 1.3,  boosters: 2, name: 'Vetorado' },
    { speed: 1.20, roll: 0.84, flame: '#9a7bff', len: 1.4,  boosters: 2, name: 'SuperBaependi' },
    { speed: 1.25, roll: 0.80, flame: '#d070ff', len: 1.5,  boosters: 4, name: 'Scramjet' },
    { speed: 1.30, roll: 0.75, flame: '#35ff8a', len: 1.65, boosters: 4, name: 'Plasma Verde' },
    { speed: 1.36, roll: 0.70, flame: '#ffe14a', len: 1.8,  boosters: 4, name: 'Plasma Ouro-Brasil' }
];
// Mísseis — 6 níveis
const MISSILE_LEVELS = [null,
    { count: 1, every: 1.2 }, { count: 2, every: 1.1 }, { count: 2, every: 0.85 },
    { count: 3, every: 0.85 }, { count: 4, every: 0.8 }, { count: 6, every: 0.75 }];
const MISSILE_DMG = 22, MISSILE_DMG_PER_LVL = 3, MISSILE_SPLASH = 16;

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
const POWERUP_PITY_KILLS = [8, 12]; // a cada X abates sai um power-up (aumenta por fase)

// --- INIMIGOS -------------------------------------------------------------
// alt = altitude (afeta tamanho/offset da sombra). faction define cor dos tiros.
const ENEMY_TYPES = {
    ap: { name: 'Caça Americano',         sprite: 'aviaoEUA',          w: 58,  hp: 55,  speed: 230, dmg: 12, score: 30,  ai: 'diver',    faction: 'us', kind: 'plane', alt: 1.0,
          fire: { type: 'aimedBurst', every: [1.6, 2.6], count: 3, speed: 300 } },
    ip: { name: 'Caça Israelense',        sprite: 'aviaoISRAEL',       w: 58,  hp: 50,  speed: 190, dmg: 11, score: 28,  ai: 'weaver',   faction: 'il', kind: 'plane', alt: 1.0,
          fire: { type: 'spread', every: [1.4, 2.2], count: 2, arc: 22, speed: 280 } },
    jp: { name: 'Interceptador Japonês',  sprite: 'aviaoJAPAO',        w: 62,  hp: 45,  speed: 330, dmg: 12, score: 35,  ai: 'swooper',  faction: 'jp', kind: 'plane', alt: 1.1,
          fire: { type: 'spread', every: [1.2, 1.8], count: 5, arc: 60, speed: 250 } },
    ah: { name: 'Helicóptero Americano',  sprite: 'helicopteroEUA',    w: 74,  hp: 120, speed: 130, dmg: 14, score: 45,  ai: 'hover',    faction: 'us', kind: 'heli',  alt: 0.55,
          fire: { type: 'rockets', every: [2.0, 2.8], count: 2, speed: 210 } },
    ih: { name: 'Helicóptero Israelense', sprite: 'helicopteroISRAEL', w: 74,  hp: 100, speed: 120, dmg: 10, score: 42,  ai: 'ringer',   faction: 'il', kind: 'heli',  alt: 0.55,
          fire: { type: 'ring', every: [2.2, 3.0], count: 12, speed: 170 } },
    dr: { name: 'Drone Kamikaze',         sprite: null,                w: 34,  hp: 18,  speed: 260, dmg: 22, score: 15,  ai: 'kamikaze', faction: 'us', kind: 'drone', alt: 0.8 },
    bm: { name: 'Bombardeiro Pesado',     sprite: 'aviaoEUA',          w: 150, hp: 900, speed: 55,  dmg: 14, score: 400, ai: 'bomber',   faction: 'us', kind: 'plane', alt: 1.35, tint: '#3a4250', elite: true,
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
        name: 'Cidade às Escuras', chapter: 'A NOITE MAIS LONGA', bg: 'bg2', duration: 80, ambient: 0.72, grade: 'rgba(40,70,160,0.16)', music: 'stage2',
        weather: 'none', searchlights: true, hudColor: '#8fd3ff', ground: 'sam', groundEvery: [6, 10],
        pool: { lineDive: 2, vForm: 2, heliPair: 3, ringHeli: 2, drones: 2, mixed: 2 }, waveEvery: [2.8, 3.8], maxEnemies: 11,
        midboss: 40, boss: 'vespa',
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
        name: 'Floresta Silenciosa', chapter: 'O ÊXODO', bg: 'bg3', duration: 85, ambient: 0.28, grade: 'rgba(80,140,90,0.14)', music: 'stage3',
        weather: 'fog', hudColor: '#b6ffb0', ground: 'sam', groundEvery: [7, 11],
        pool: { heliPair: 3, ringHeli: 3, swoop: 3, vForm: 2, drones: 2 }, waveEvery: [2.6, 3.5], maxEnemies: 12,
        midboss: 42, boss: 'sol',
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
        name: 'Deserto de Fogo', chapter: 'O PREÇO', bg: 'bg4', duration: 90, ambient: 0.05, grade: 'rgba(255,180,80,0.14)', music: 'stage4',
        weather: 'sand', hudColor: '#ffd36b', ground: 'sam', groundEvery: [3.8, 6],
        pool: { lineDive: 3, swoop: 3, heliPair: 2, drones: 3, mixed: 3 }, waveEvery: [2.4, 3.2], maxEnemies: 13,
        midboss: 45, boss: 'leviata',
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
        name: 'Mar da Flotilha', chapter: 'A TRAVESSIA', bg: 'bg5', duration: 95, ambient: 0.4, grade: 'rgba(60,90,130,0.18)', music: 'stage5',
        weather: 'rain', hudColor: '#ff8a80', ground: 'gb', groundEvery: [4.5, 7],
        pool: { lineDive: 2, vForm: 2, swoop: 3, heliPair: 2, ringHeli: 2, drones: 3, mixed: 3 }, waveEvery: [2.2, 3.0], maxEnemies: 14,
        midboss: 45, boss: 'supremo',
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
        'Mas a TRÍADE tem esquadras espalhadas pelo planeta, e agora quer vingança. Novas frentes se abrem — e outros povos estão na mira.',
        'A guerra nos céus continua. Desta vez, eles vêm com tudo.'
    ],
    // texto extra no início de cada ciclo após o primeiro
    loops: [
        'CONTRAOFENSIVA: a TRÍADE reconstruiu suas frotas com tudo o que tinha. Mais inimigos, mais blindados, mais rápidos — e sem piedade.',
        'GUERRA TOTAL: a aliança mobilizou todas as reservas. Cada bateria, cada caça, cada drone aponta para você.',
        'O FIM DA TRÍADE: dizem que ninguém sobrevive a este céu. Você já ouviu isso antes.'
    ],
    gameOver: [
        'No cais, a Dra. Camila desliga o rádio em silêncio.',
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
        name: 'COMANDO SUPREMO', pilot: 'SUPER TRUMP', sprite: 'chefao', tint: '#7a1b1b', w: 330, hp: 8500,
        intro: 'Povos são linhas num mapa. Eu apago linhas. Você é só mais uma.',
        outro: ['O ARQUITETO', 'Impossível... um único... avião...'], r: 110, move: 'sway', speed: 60, alt: 1.7,
        engines: [[-0.36, -0.12], [0.36, -0.12], [-0.12, -0.3], [0.12, -0.3]],
        parts: [ { ox: -0.38, oy: 0.05, r: 26, hp: 800 }, { ox: 0.38, oy: 0.05, r: 26, hp: 800 } ],
        phases: [
            { at: 1.0, patterns: ['partsFire', 'aimedFan', 'drones', 'ring'] },
            { at: 0.66, patterns: ['spiralDouble', 'laserTwin', 'missiles', 'mines'] },
            { at: 0.33, patterns: ['laserSweep', 'spiralDouble', 'drones', 'rocketBarrage', 'minigunDouble'], rage: true }
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
