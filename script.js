document.addEventListener('DOMContentLoaded', () => {
    // Referências aos Elementos do DOM
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const gameOverScreen = document.getElementById('game-over-screen');
    const rankingScreen = document.getElementById('ranking-screen');
    const playerNameInput = document.getElementById('player-name-input');
    const startGameBtn = document.getElementById('start-game-btn');
    const restartBtn = document.getElementById('restart-btn'); // LINHA CORRIGIDA
    const newPlayerBtn = document.getElementById('new-player-btn');
    const viewRankingBtn = document.getElementById('view-ranking-btn');
    const exportRankingBtn = document.getElementById('export-ranking-btn');
    const backToGameOverBtn = document.getElementById('back-to-game-over-btn');

    // HUD
    const hudPlayerName = document.getElementById('hud-player-name');
    const hudScore = document.getElementById('hud-score');
    const hudHealth = document.getElementById('hud-health');
    const hudLevel = document.getElementById('hud-level');
    const hudTime = document.getElementById('hud-time');
    const hudFeatherLevel = document.getElementById('hud-feather-level');
    const hudCannonLevel = document.getElementById('hud-cannon-level');
    const hudDamage = document.getElementById('hud-damage');
    const hudSpeed = document.getElementById('hud-speed');

    canvas.width = 800;
    canvas.height = 600;

    // --- CARREGADOR DE ASSETS ---
    const assets = {
        player: new Image(),
        player2: new Image(),
        player3: new Image(),
        player4: new Image(),
        aviaoEUA: new Image(),
        aviaoISRAEL: new Image(),
        helicopteroEUA: new Image(),
        helicopteroISRAEL: new Image(),
        cenario: new Image(),
        pwVelocidade: new Image(),
        pwCanhao: new Image(),
        pwBomba: new Image(),
        pwSaude: new Image()
    };
    const assetSources = {
        player: 'assets/jogador.png',
        player2: 'assets/jogador2.png',
        player3: 'assets/jogador3.png',
        player4: 'assets/jogador4.png',
        aviaoEUA: 'assets/aviaoEUA.png',
        aviaoISRAEL: 'assets/aviaoISRAEL.png',
        helicopteroEUA: 'assets/helicopteroEUA.png',
        helicopteroISRAEL: 'assets/helicopteroISRAEL.png',
        cenario: 'assets/cenariojogo.png',
        pwVelocidade: 'assets/PWvelocidade.png',
        pwCanhao: 'assets/PWcanhao.png',
        pwBomba: 'assets/PWbomba.png',
        pwSaude: 'assets/PWsaude.png'
    };
    let assetsLoaded = 0;
    const totalAssets = Object.keys(assetSources).length;

    function onAssetLoad() {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            startGameBtn.disabled = false;
            startGameBtn.textContent = 'Iniciar Missão';
        }
    }

    function loadAssets() {
        startGameBtn.disabled = true;
        startGameBtn.textContent = 'Carregando Recursos...';
        for (const key in assetSources) {
            assets[key].src = assetSources[key];
            assets[key].onload = onAssetLoad;
            assets[key].onerror = () => {
                alert(`Não foi possível carregar a imagem: ${assetSources[key]}`);
            }
        }
    }

    // --- CONFIGURAÇÕES DO JOGO ---
    const ENEMY_STD_WIDTH = 60;
    const ENEMY_STD_HEIGHT = 60;
    const PLAYER_STARTING_HEALTH = 100;
    const ENEMY_LIMIT = 7;
    const SCALING_SCORE_THRESHOLD = 100;

    // --- ESTADO DO JOGO ---
    let gameState = {
        totalKills: 0,
        nextPowerUpKillCount: 0,
        playerName: '',
        score: 0,
        level: 1,
        startTime: null,
        elapsedTime: 0,
        isGameOver: false,
        animationFrameId: null,
        killCounts: { ap: 0, ip: 0, ah: 0, ih: 0 },
        powerupsCollected: { feather: 0, cannon: 0, bomb: 0, health: 0 }
    };
    let player, enemies = [],
        playerBullets = [],
        enemyBullets = [],
        powerUps = [],
        particles = [],
        backgroundY = 0,
        screenFlash = { alpha: 0, duration: 20, timer: 0 };
    const keys = {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        ' ': false
    };

    // --- CLASSES DO JOGO ---

    class Player {
        constructor() {
            this.width = 65;
            this.height = 65;
            this.x = canvas.width / 2 - this.width / 2;
            this.y = canvas.height - this.height - 20;
            this.baseSpeed = 300 / 60;
            this.speed = this.baseSpeed;
            this.health = PLAYER_STARTING_HEALTH;
            this.maxHealth = PLAYER_STARTING_HEALTH;
            this.baseDamage = 25;
            this.shootCooldown = 300;
            this.lastShotTime = 0;
            this.powerUpLevels = { feather: 0, cannon: 0 };

            this.image = assets.player;
            this.shotDamage = this.baseDamage;
            this.bulletWidth = 6;
            this.bulletSpeed = 7;
            this.numShots = 1;
        }

        updatePowerStats() {
            const level = this.powerUpLevels.cannon;

            this.numShots = 1;
            this.bulletWidth = 6;
            this.bulletSpeed = 7;
            this.image = assets.player;

            let calculatedDamage = this.baseDamage;

            if (level >= 1) {
                this.numShots = 2;
                this.image = assets.player2;
                calculatedDamage *= 1.25;
            }
            if (level >= 2) {
                this.bulletWidth = 12;
                this.image = assets.player3;
                calculatedDamage *= 1.30;
            }
            if (level >= 3) {
                this.bulletSpeed = 7 * 1.5;
                this.image = assets.player4;
                calculatedDamage *= 1.25;
            }
            if (level >= 4) {
                this.numShots = 4;
                calculatedDamage *= 1.50;
            }
            if (level > 4) {
                const bonusLevels = level - 4;
                calculatedDamage *= Math.pow(1.50, bonusLevels);
            }

            this.shotDamage = calculatedDamage;
        }

        draw() {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
        update() {
            if (keys.ArrowUp && this.y > 0) this.y -= this.speed;
            if (keys.ArrowDown && this.y < canvas.height - this.height) this.y += this.speed;
            if (keys.ArrowLeft && this.x > 0) this.x -= this.speed;
            if (keys.ArrowRight && this.x < canvas.width - this.width) this.x += this.speed;
            if (keys[' '] && Date.now() - this.lastShotTime > this.shootCooldown) {
                this.shoot();
                this.lastShotTime = Date.now();
            }
        }
        shoot() {
            const bulletHeight = 15;
            const playerBulletColor1 = '#00FF00';
            const playerBulletColor2 = '#FFFF00';
            const playerGlowColor = '#FFFF00';

            if (this.numShots === 1) {
                playerBullets.push(new Bullet(this.x + this.width / 2 - this.bulletWidth / 2, this.y, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
            } else if (this.numShots === 2) {
                playerBullets.push(new Bullet(this.x, this.y + 20, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth, this.y + 20, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
            } else if (this.numShots === 4) {
                const spacing = 15;
                playerBullets.push(new Bullet(this.x - spacing, this.y + 30, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
                playerBullets.push(new Bullet(this.x + spacing, this.y + 20, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth - spacing, this.y + 20, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth + spacing, this.y + 30, this.bulletWidth, bulletHeight, playerBulletColor1, playerBulletColor2, this.bulletSpeed, this.shotDamage, -1, playerGlowColor));
            }
        }
        takeDamage(damage) {
            this.health -= damage;
            screenFlash.timer = screenFlash.duration;
            if (this.health <= 0) {
                this.health = 0;
                gameOver();
            }
        }
    }

    class Bullet {
        constructor(x, y, width, height, color1, color2, speed, damage, direction = 1, glowColor = null) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color1 = color1;
            this.color2 = color2;
            this.speed = speed;
            this.damage = damage;
            this.direction = direction;
            this.glowColor = glowColor;
        }
        draw() {
            if (this.glowColor) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.glowColor;
            }

            const halfWidth = this.width / 2;
            ctx.fillStyle = this.color1;
            ctx.fillRect(this.x, this.y, halfWidth, this.height);
            ctx.fillStyle = this.color2;
            ctx.fillRect(this.x + halfWidth, this.y, halfWidth, this.height);

            if (this.glowColor) {
                ctx.shadowBlur = 0;
            }
        }
        update() {
            this.y += this.speed * this.direction;
        }
    }

    class Enemy {
        constructor(img, width, height, baseHealth, baseSpeed, baseDamage, scoreValue, type) {
            this.x = Math.random() * (canvas.width - width);
            this.y = -height;
            this.image = img;
            this.width = width;
            this.height = height;
            this.baseHealth = baseHealth;
            this.maxHealth = baseHealth;
            this.health = baseHealth;
            this.baseSpeed = baseSpeed / 60;
            this.baseDamage = baseDamage;
            this.scoreValue = scoreValue;
            this.type = type;
            this.minShootInterval = 2000;
            this.nextShotTime = Date.now() + Math.random() * 4000 + this.minShootInterval;
            this.updateStatsForLevel();
        }
        updateStatsForLevel() {
            const levelMultiplier = Math.floor(gameState.score / SCALING_SCORE_THRESHOLD);
            const newMaxHealth = this.baseHealth * Math.pow(1.20, levelMultiplier);
            const healthPercentage = this.health / this.maxHealth;
            this.maxHealth = newMaxHealth;
            this.health = this.maxHealth * (isNaN(healthPercentage) ? 1 : healthPercentage);
            this.speed = this.baseSpeed * Math.pow(1.10, levelMultiplier);
            this.damage = this.baseDamage * Math.pow(1.10, levelMultiplier);
        }
        draw() {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            this.drawHealthBar();
        }
        drawHealthBar() {
            if (this.health < this.maxHealth) {
                const barWidth = this.width;
                const barHeight = 7;
                const yOffset = 10;
                const currentHealthWidth = (this.health / this.maxHealth) * barWidth;
                ctx.fillStyle = '#333';
                ctx.fillRect(this.x, this.y - yOffset, barWidth, barHeight);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(this.x, this.y - yOffset, currentHealthWidth, barHeight);
            }
        }
        update() {
            this.y += this.speed;
            const targetX = player.x + player.width / 2 - this.width / 2;
            const dx = targetX - this.x;
            if (Math.abs(dx) > this.speed) {
                this.x += Math.sign(dx) * this.speed * 0.5;
            }
            this.avoidOverlap();
            this.attemptToShoot();
        }
        avoidOverlap() {
            for (const other of enemies) {
                if (other === this) continue;
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = (this.width + other.width) / 2.5;
                if (distance < minDistance) {
                    const angle = Math.atan2(dy, dx);
                    const pushForce = (minDistance - distance) * 0.1;
                    this.x += Math.cos(angle) * pushForce;
                    this.y += Math.sin(angle) * pushForce;
                }
            }
        }
        attemptToShoot() {
            const now = Date.now();
            if (now > this.nextShotTime) {
                const isAligned = (player.x < this.x + this.width) && (player.x + player.width > this.x);
                if (isAligned) {
                    this.nextShotTime = now + this.minShootInterval + Math.random() * 2000;

                    let color1, color2, glowColor;
                    if (this.type === 'ap' || this.type === 'ah') {
                        color1 = '#FF6347';
                        color2 = '#4169E1';
                        glowColor = '#FF0000';
                    } else {
                        color1 = '#D3D3D3';
                        color2 = '#87CEEB';
                        glowColor = '#00FFFF';
                    }

                    const bulletX = this.x + this.width / 2 - 2;
                    const bulletY = this.y + this.height;
                    enemyBullets.push(new Bullet(bulletX, bulletY, 4, 12, color1, color2, 5, this.damage, 1, glowColor));
                }
            }
        }
        takeDamage(damage) {
            this.health -= damage;
            return this.health <= 0;
        }
    }

    class PowerUp {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.width = 90;
            this.height = 90;
            this.type = type;
            this.speed = 2;
            this.blinkInterval = 300;
            this.lastBlinkTime = Date.now();
            this.isBlinkingOn = true;
        }
        draw() {
            const now = Date.now();
            if (now - this.lastBlinkTime > this.blinkInterval) {
                this.isBlinkingOn = !this.isBlinkingOn;
                this.lastBlinkTime = now;
            }
            let shadowBlur = 0;
            if (this.isBlinkingOn) {
                shadowBlur = 30;
            }
            ctx.shadowBlur = shadowBlur;
            let imageToDraw;
            switch (this.type) {
                case 'feather':
                    imageToDraw = assets.pwVelocidade;
                    ctx.shadowColor = '#00BFFF';
                    break;
                case 'cannon':
                    imageToDraw = assets.pwCanhao;
                    ctx.shadowColor = '#FFA500';
                    break;
                case 'bomb':
                    imageToDraw = assets.pwBomba;
                    ctx.shadowColor = '#FF4500';
                    break;
                case 'health':
                    imageToDraw = assets.pwSaude;
                    ctx.shadowColor = '#32CD32';
                    break;
            }
            if (imageToDraw && imageToDraw.complete) {
                ctx.drawImage(imageToDraw, this.x, this.y, this.width, this.height);
            }
            ctx.shadowBlur = 0;
        }
        update() {
            this.y += this.speed;
        }
    }

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 5 + 2;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.color = color;
            this.life = 50;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life--;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- FUNÇÕES DE LÓGICA DO JOGO ---

    function resetGame() {
        player = new Player();
        player.updatePowerStats();
        enemies = [];
        playerBullets = [];
        enemyBullets = [];
        powerUps = [];
        particles = [];
        backgroundY = 0;
        gameState = {
            ...gameState,
            totalKills: 0,
            nextPowerUpKillCount: Math.floor(Math.random() * 3) + 5,
            score: 0,
            level: 1,
            startTime: Date.now(),
            elapsedTime: 0,
            isGameOver: false,
            killCounts: { ap: 0, ip: 0, ah: 0, ih: 0 },
            powerupsCollected: { feather: 0, cannon: 0, bomb: 0, health: 0 }
        };
    }

    function startGame() {
        const name = playerNameInput.value.trim();
        if (name === '') {
            alert('Por favor, insira um nome de combatente.');
            return;
        }
        gameState.playerName = name;
        hudPlayerName.textContent = name;
        startScreen.classList.remove('active');
        gameContainer.style.display = 'block';
        resetGame();
        gameLoop();
    }

    function gameOver() {
        gameState.isGameOver = true;
        cancelAnimationFrame(gameState.animationFrameId);
        saveScore();
        document.getElementById('final-player-name').textContent = gameState.playerName;
        document.getElementById('final-score').textContent = gameState.score;
        document.getElementById('final-time').textContent = formatTime(gameState.elapsedTime);
        document.getElementById('final-level').textContent = gameState.level;
        document.getElementById('final-kills-ap').textContent = gameState.killCounts.ap;
        document.getElementById('final-kills-ip').textContent = gameState.killCounts.ip;
        document.getElementById('final-kills-ah').textContent = gameState.killCounts.ah;
        document.getElementById('final-kills-ih').textContent = gameState.killCounts.ih;
        document.getElementById('final-powerups').textContent = `Penas: ${gameState.powerupsCollected.feather}, Canhões: ${gameState.powerupsCollected.cannon}, Bombas: ${gameState.powerupsCollected.bomb}, Curas: ${gameState.powerupsCollected.health}`;
        gameContainer.style.display = 'none';
        gameOverScreen.classList.add('active');
    }

    function createExplosion(x, y) {
        for (let i = 0; i < 30; i++) {
            const color = `hsl(${Math.random() * 60}, 100%, 50%)`;
            particles.push(new Particle(x, y, color));
        }
    }

    function spawnEnemy() {
        if (enemies.length >= ENEMY_LIMIT) return;
        const rand = Math.random();
        let newEnemy;
        if (rand < 0.3) {
            newEnemy = new Enemy(assets.aviaoEUA, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 50, 20, 25, 30, 'ap');
        } else if (rand < 0.6) {
            newEnemy = new Enemy(assets.aviaoISRAEL, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 40, 25, 20, 25, 'ip');
        } else if (rand < 0.8) {
            newEnemy = new Enemy(assets.helicopteroEUA, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 100, 10, 20, 20, 'ah');
        } else {
            newEnemy = new Enemy(assets.helicopteroISRAEL, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 80, 8, 16, 15, 'ih');
        }
        enemies.push(newEnemy);
    }

    function spawnRandomPowerUp() {
        const x = Math.random() * (canvas.width - 90);
        const y = -100;
        const rand = Math.random();
        let type = '';
        if (rand < 0.3) type = 'feather';
        else if (rand < 0.6) type = 'cannon';
        else if (rand < 0.8) type = 'health';
        else type = 'bomb';
        powerUps.push(new PowerUp(x, y, type));
    }

    function applyPowerUp(type) {
        switch (type) {
            case 'feather':
                if (player.powerUpLevels.feather < 5) {
                    player.powerUpLevels.feather++;
                    player.speed = player.baseSpeed * (1 + player.powerUpLevels.feather * 0.25);
                    gameState.powerupsCollected.feather++;
                }
                break;
            case 'cannon':
                player.powerUpLevels.cannon++;
                player.updatePowerStats();
                gameState.powerupsCollected.cannon++;
                break;
            case 'bomb':
                enemies.forEach(enemy => createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
                enemies = [];
                gameState.powerupsCollected.bomb++;
                break;
            case 'health':
                player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.25);
                gameState.powerupsCollected.health++;
                break;
        }
    }

    function checkCollisions() {
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (playerBullets[i] && enemies[j] && isColliding(playerBullets[i], enemies[j])) {
                    if (enemies[j].takeDamage(playerBullets[i].damage)) {
                        gameState.score += enemies[j].scoreValue;
                        gameState.killCounts[enemies[j].type]++;
                        gameState.totalKills++;
                        createExplosion(enemies[j].x + enemies[j].width / 2, enemies[j].y + enemies[j].height / 2);
                        if (gameState.totalKills >= gameState.nextPowerUpKillCount) {
                            spawnRandomPowerUp();
                            gameState.nextPowerUpKillCount = gameState.totalKills + Math.floor(Math.random() * 3) + 5;
                        }
                        enemies.splice(j, 1);
                    }
                    playerBullets.splice(i, 1);
                    break;
                }
            }
        }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            if (isColliding(enemyBullets[i], player)) {
                player.takeDamage(enemyBullets[i].damage);
                enemyBullets.splice(i, 1);
            }
        }
        for (let i = powerUps.length - 1; i >= 0; i--) {
            if (isColliding(powerUps[i], player)) {
                applyPowerUp(powerUps[i].type);
                powerUps.splice(i, 1);
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (isColliding(enemies[i], player)) {
                player.takeDamage(enemies[i].damage * 2);
                createExplosion(enemies[i].x + enemies[i].width / 2, enemies[i].y + enemies[i].height / 2);
                enemies.splice(i, 1);
            }
        }
    }

    function isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    }

    function updateGame() {
        if (gameState.isGameOver) return;
        player.update();
        playerBullets.forEach(b => b.update());
        playerBullets = playerBullets.filter(b => b.y > -b.height);
        enemies.forEach(e => e.update());
        enemies = enemies.filter(e => e.y < canvas.height + 50);
        enemyBullets.forEach(b => b.update());
        enemyBullets = enemyBullets.filter(b => b.y < canvas.height);
        powerUps.forEach(p => p.update());
        powerUps = powerUps.filter(p => p.y < canvas.height + p.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
        if (screenFlash.timer > 0) {
            screenFlash.timer--;
            screenFlash.alpha = (screenFlash.timer / screenFlash.duration) * 0.7;
        } else {
            screenFlash.alpha = 0;
        }
        if (Math.random() < 0.025) spawnEnemy();
        checkCollisions();
        const newLevel = 1 + Math.floor(gameState.score / SCALING_SCORE_THRESHOLD);
        if (newLevel > gameState.level) {
            gameState.level = newLevel;
            enemies.forEach(e => e.updateStatsForLevel());
        }
        gameState.elapsedTime = Date.now() - gameState.startTime;
        updateHUD();
        backgroundY += 2;
        if (backgroundY >= canvas.height) backgroundY = 0;
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.cenario, 0, backgroundY, canvas.width, canvas.height);
        ctx.drawImage(assets.cenario, 0, backgroundY - canvas.height, canvas.width, canvas.height);
        player.draw();
        playerBullets.forEach(b => b.draw());
        enemies.forEach(e => e.draw());
        enemyBullets.forEach(b => b.draw());
        powerUps.forEach(p => p.draw());
        particles.forEach(p => p.draw());
        if (screenFlash.alpha > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${screenFlash.alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    function gameLoop() {
        if (gameState.isGameOver) return;
        updateGame();
        drawGame();
        gameState.animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- FUNÇÕES DE HUD, RANKING, ETC ---

    function updateHUD() {
        hudScore.textContent = gameState.score;
        hudHealth.textContent = `${Math.ceil(player.health)}%`;
        hudLevel.textContent = gameState.level;
        hudTime.textContent = formatTime(gameState.elapsedTime);
        hudFeatherLevel.textContent = `x${player.powerUpLevels.feather}`;
        hudCannonLevel.textContent = `x${player.powerUpLevels.cannon}`;
        hudDamage.textContent = Math.round(player.shotDamage);
        hudSpeed.textContent = Math.round(player.speed * 10);
    }

    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const min = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    }

    function saveScore() {
        const scoreData = {
            name: gameState.playerName,
            score: gameState.score,
            level: gameState.level,
            time: formatTime(gameState.elapsedTime),
            kills: gameState.killCounts,
            powerups: Object.values(gameState.powerupsCollected).reduce((a, b) => a + b, 0)
        };
        const rankings = JSON.parse(localStorage.getItem('gameRankings')) || [];
        rankings.push(scoreData);
        rankings.sort((a, b) => b.score - a.score);
        if (rankings.length > 10) rankings.length = 10;
        localStorage.setItem('gameRankings', JSON.stringify(rankings));
    }

    function displayRanking() {
        gameOverScreen.classList.remove('active');
        rankingScreen.classList.add('active');
        const rankings = JSON.parse(localStorage.getItem('gameRankings')) || [];
        const tableBody = document.getElementById('ranking-table').querySelector('tbody');
        tableBody.innerHTML = '';
        if (rankings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7">Nenhum recorde ainda.</td></tr>`;
            return;
        }
        rankings.forEach((entry, index) => {
            const row = document.createElement('tr');
            const killString = `A:${entry.kills.ap+entry.kills.ah} I:${entry.kills.ip+entry.kills.ih}`;
            row.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td>${entry.score}</td><td>${entry.level}</td><td>${entry.time}</td><td>${killString}</td><td>${entry.powerups}</td>`;
            tableBody.appendChild(row);
        });
    }

    // --- EVENT LISTENERS ---
    startGameBtn.addEventListener('click', startGame);

    restartBtn.addEventListener('click', () => {
        gameOverScreen.classList.remove('active');
        gameContainer.style.display = 'block';
        resetGame();
        gameLoop();
    });

    newPlayerBtn.addEventListener('click', () => {
        gameOverScreen.classList.remove('active');
        rankingScreen.classList.remove('active');
        startScreen.classList.add('active');
        playerNameInput.value = '';
        playerNameInput.focus();
    });

    viewRankingBtn.addEventListener('click', displayRanking);

    backToGameOverBtn.addEventListener('click', () => {
        rankingScreen.classList.remove('active');
        gameOverScreen.classList.add('active');
    });

    exportRankingBtn.addEventListener('click', () => {
        const rankingScreenElement = document.getElementById('ranking-screen');
        const rankingContainer = document.getElementById('ranking-table-container');

        const originalMaxHeight = rankingContainer.style.maxHeight;
        const originalOverflowY = rankingContainer.style.overflowY;

        rankingContainer.style.maxHeight = 'none';
        rankingContainer.style.overflowY = 'visible';

        const options = {
            backgroundColor: '#344e41',
            scale: 2
        };

        html2canvas(rankingScreenElement, options).then(canvas => {
            rankingContainer.style.maxHeight = originalMaxHeight;
            rankingContainer.style.overflowY = originalOverflowY;

            const link = document.createElement('a');
            link.download = 'ranking-guerra-nos-ceus.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    });

    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.key)) {
            keys[e.key] = false;
        }
    });

    // --- INICIALIZAÇÃO ---
    loadAssets();
});