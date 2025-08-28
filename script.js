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
    const restartBtn = document.getElementById('restart-btn');
    const newPlayerBtn = document.getElementById('new-player-btn');
    const viewRankingBtn = document.getElementById('view-ranking-btn');
    const exportRankingBtn = document.getElementById('export-ranking-btn');
    const backToGameOverBtn = document.getElementById('back-to-game-over-btn');
    const resetRankingBtn = document.getElementById('reset-ranking-btn');

    // HUD
    const hudElement = document.getElementById('hud');
    const hudPlayerName = document.getElementById('hud-player-name');
    const hudScore = document.getElementById('hud-score');
    const hudHealth = document.getElementById('hud-health');
    const hudLevel = document.getElementById('hud-level');
    const hudTime = document.getElementById('hud-time');
    const hudFeatherLevel = document.getElementById('hud-feather-level');
    const hudCannonLevel = document.getElementById('hud-cannon-level');
    const hudDamage = document.getElementById('hud-damage');
    const hudSpeed = document.getElementById('hud-speed');
    const finalBossesDefeated = document.getElementById('final-bosses-defeated');

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
        cenario1: new Image(),
        cenario2: new Image(),
        cenario3: new Image(),
        cenario4: new Image(),
        cenario5: new Image(),
        pwVelocidade: new Image(),
        pwCanhao: new Image(),
        pwBomba: new Image(),
        pwSaude: new Image(),
        chefao: new Image()
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
        cenario1: 'assets/cenariojogo.png',
        cenario2: 'assets/cenariojogo2.png',
        cenario3: 'assets/cenariojogo3.png',
        cenario4: 'assets/cenariojogo4.png',
        cenario5: 'assets/cenariojogo5.png',
        pwVelocidade: 'assets/PWvelocidade.png',
        pwCanhao: 'assets/PWcanhao.png',
        pwBomba: 'assets/PWbomba.png',
        pwSaude: 'assets/PWsaude.png',
        chefao: 'assets/chefao.png'
    };
    let assetsLoaded = 0;
    const totalAssets = Object.keys(assetSources).length;
    let backgroundImages = [];

    function onAssetLoad() {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            backgroundImages = [assets.cenario1, assets.cenario2, assets.cenario3, assets.cenario4, assets.cenario5];
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
            assets[key].onerror = () => alert(`Não foi possível carregar a imagem: ${assetSources[key]}`);
        }
    }

    // --- CONFIGURAÇÕES DO JOGO ---
    const ENEMY_STD_WIDTH = 60;
    const ENEMY_STD_HEIGHT = 60;
    const PLAYER_STARTING_HEALTH = 100;
    const ENEMY_LIMIT = 7;
    const SCALING_SCORE_THRESHOLD = 100;
    const KILLS_TO_SPAWN_BOSS_BASE = 40;
    const KILLS_TO_SPAWN_BOSS_INCREMENT = 20;

    // --- ESTADO DO JOGO ---
    let gameState = {};
    let player, boss = null,
        enemies = [],
        playerBullets = [],
        enemyBullets = [],
        bossBullets = [],
        powerUps = [],
        particles = [],
        floatingTexts = [],
        backgroundY = 0,
        currentBackground,
        screenFlash = {
            alpha: 0,
            duration: 20,
            timer: 0
        },
        whiteoutFlash = {
            timer: 0,
            duration: 4000
        },
        phaseMessage = {
            text: '',
            timer: 0,
            duration: 3000
        };
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
            this.powerUpLevels = {
                feather: 0,
                cannon: 0
            };
            this.hitboxWidth = 30;
            this.hitboxHeight = 30;
            this.isInvincible = false;
            this.invincibilityDuration = 1000;
            this.invincibilityEndTime = 0;
            this.image = assets.player;
            this.shotDamage = this.baseDamage;
            this.bulletWidth = 6;
            this.bulletSpeed = 7;
            this.numShots = 1;
        }

        updatePowerStats() {
            const level = this.powerUpLevels.cannon;
            let calculatedDamage = this.baseDamage;
            let currentBulletSpeed = 7;
            this.numShots = 1;
            this.bulletWidth = 6;
            this.image = assets.player;
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
                currentBulletSpeed = 7 * 1.5;
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
                currentBulletSpeed *= Math.pow(1.20, bonusLevels);
            }
            this.shotDamage = calculatedDamage;
            this.bulletSpeed = currentBulletSpeed;
        }

        draw() {
            if (this.isInvincible && Math.floor(Date.now() / 100) % 2 === 0) return;
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }

        handleDamageSmoke() {
            if (this.health <= this.maxHealth / 3 && Math.random() < 0.5) {
                particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, `rgba(100, 100, 100, ${Math.random() * 0.5 + 0.2})`, true));
                if (Math.random() < 0.3) {
                    particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, `rgba(${255}, ${Math.random() * 150}, 0, ${Math.random() * 0.5 + 0.5})`, true));
                }
            }
        }

        update() {
            if (this.isInvincible && Date.now() > this.invincibilityEndTime) this.isInvincible = false;
            this.handleDamageSmoke();
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
            const bulletHeight = 15,
                pColor1 = '#00FF00',
                pColor2 = '#FFFF00',
                pGlow = '#FFFF00';
            if (this.numShots === 1) {
                playerBullets.push(new Bullet(this.x + this.width / 2 - this.bulletWidth / 2, this.y, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
            } else if (this.numShots === 2) {
                playerBullets.push(new Bullet(this.x, this.y + 20, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth, this.y + 20, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
            } else if (this.numShots === 4) {
                const s = 15;
                playerBullets.push(new Bullet(this.x - s, this.y + 30, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
                playerBullets.push(new Bullet(this.x + s, this.y + 20, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth - s, this.y + 20, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
                playerBullets.push(new Bullet(this.x + this.width - this.bulletWidth + s, this.y + 30, this.bulletWidth, bulletHeight, pColor1, pColor2, this.bulletSpeed, this.shotDamage, -1, pGlow));
            }
        }
        takeDamage(damage) {
            if (this.isInvincible) return;
            this.health -= damage;
            floatingTexts.push(new FloatingText(this.x + this.width / 2, this.y, Math.round(damage), '#FF4500'));
            screenFlash.timer = screenFlash.duration;
            this.isInvincible = true;
            this.invincibilityEndTime = Date.now() + this.invincibilityDuration;
            if (this.health <= 0) {
                this.health = 0;
                gameOver();
            }
        }
    }

    class Bullet {
        constructor(x, y, width, height, bodyColor, tipColor, speed, damage, direction = 1, glowColor = null, isHoming = false) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.bodyColor = bodyColor;
            this.tipColor = tipColor;
            this.speed = speed;
            this.damage = damage;
            this.direction = direction;
            this.glowColor = glowColor;
            this.isHoming = isHoming;
        }
        draw() {
            if (this.glowColor) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.glowColor;
            }
            const tipHeight = this.height * 0.3,
                bodyHeight = this.height * 0.7;
            ctx.fillStyle = this.bodyColor;
            if (this.direction === -1) {
                ctx.fillRect(this.x, this.y + tipHeight, this.width, bodyHeight);
            } else {
                ctx.fillRect(this.x, this.y, this.width, bodyHeight);
            }
            ctx.fillStyle = this.tipColor;
            if (this.direction === -1) {
                ctx.fillRect(this.x, this.y, this.width, tipHeight);
            } else {
                ctx.fillRect(this.x, this.y + bodyHeight, this.width, tipHeight);
            }
            if (this.glowColor) {
                ctx.shadowBlur = 0;
            }
        }
        update() {
            if (this.isHoming && player) {
                const targetX = player.x + player.width / 2 - this.width / 2;
                const dx = targetX - this.x;
                this.x += dx * 0.05;
            }
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
            const newMaxHealth = this.baseHealth * Math.pow(1.04, levelMultiplier);
            const healthPercentage = this.health / this.maxHealth;
            this.maxHealth = newMaxHealth;
            this.health = this.maxHealth * (isNaN(healthPercentage) ? 1 : healthPercentage);
            this.speed = this.baseSpeed * Math.pow(1.05, levelMultiplier);
            this.damage = this.baseDamage * Math.pow(1.06, levelMultiplier);
        }
        draw() {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            this.drawHealthBar();
        }
        drawHealthBar() {
            if (this.health < this.maxHealth) {
                const barWidth = this.width,
                    barHeight = 7,
                    yOffset = 10;
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
            if (Math.abs(dx) > this.speed) this.x += Math.sign(dx) * this.speed * 0.5;
            this.avoidOverlap();
            this.attemptToShoot();
        }
        avoidOverlap() {
            for (const other of enemies) {
                if (other === this) continue;
                const dx = this.x - other.x,
                    dy = this.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = (this.width + other.width) / 2.5;
                if (distance < minDistance) {
                    const angle = Math.atan2(dy, dx);
                    this.x += Math.cos(angle) * (minDistance - distance) * 0.1;
                    this.y += Math.sin(angle) * (minDistance - distance) * 0.1;
                }
            }
        }
        attemptToShoot() {
            const now = Date.now();
            if (now > this.nextShotTime) {
                if ((player.x < this.x + this.width) && (player.x + player.width > this.x)) {
                    this.nextShotTime = now + this.minShootInterval + Math.random() * 2000;
                    let bodyColor = 'white',
                        tipColor, glowColor, bulletSpeed;
                    if (this.type === 'ah' || this.type === 'ih') {
                        bulletSpeed = 3.5;
                    } else {
                        bulletSpeed = 6;
                    }
                    if (this.type === 'ap' || this.type === 'ah') {
                        tipColor = '#FF0000';
                        glowColor = '#FF0000';
                    } else {
                        tipColor = '#00FFFF';
                        glowColor = '#00FFFF';
                    }
                    enemyBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y + this.height, 4, 12, bodyColor, tipColor, bulletSpeed, this.damage, 1, glowColor));
                }
            }
        }
        takeDamage(damage) {
            this.health -= damage;
            floatingTexts.push(new FloatingText(this.x + this.width / 2, this.y, Math.round(damage), '#FFFF00'));
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
            if (this.isBlinkingOn) shadowBlur = 30;
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
            if (imageToDraw && imageToDraw.complete) ctx.drawImage(imageToDraw, this.x, this.y, this.width, this.height);
            ctx.shadowBlur = 0;
        }
        update() {
            this.y += this.speed;
        }
    }

    class Particle {
        constructor(x, y, color, isSmoke = false) {
            this.x = x;
            this.y = y;
            if (isSmoke) {
                this.size = Math.random() * 4 + 3;
                this.speedX = Math.random() * 2 - 1;
                this.speedY = Math.random() * 0.5 + 0.2;
                this.lifespan = 40;
            } else {
                this.size = Math.random() * 5 + 2;
                this.speedX = Math.random() * 8 - 4;
                this.speedY = Math.random() * 8 - 4;
                this.lifespan = 50;
            }
            this.color = color;
            this.initialLifespan = this.lifespan;
            this.opacity = 1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.lifespan--;
            this.opacity = this.lifespan / this.initialLifespan;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    class FloatingText {
        constructor(x, y, text, color) {
            this.x = x;
            this.y = y;
            this.text = text;
            this.color = color;
            this.lifespan = 60;
            this.initialLifespan = 60;
            this.opacity = 1;
        }
        update() {
            this.y -= 0.5;
            this.lifespan--;
            this.opacity = this.lifespan / this.initialLifespan;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.font = '20px Staatliches';
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    class Boss {
        constructor() {
            this.width = 180;
            this.height = 180;
            this.x = canvas.width / 2 - this.width / 2;
            this.y = 50;
            this.image = assets.chefao;
            this.creationTime = Date.now();
            const levelMultiplier = Math.floor(gameState.score / SCALING_SCORE_THRESHOLD);
            const baseHeliHealth = 100 * Math.pow(1.04, levelMultiplier);
            this.maxHealth = baseHeliHealth * 12;
            this.health = this.maxHealth;
            this.speed = ((20 / 60) * 2.5) * 1.35;
            this.scoreValue = 300;
            const basePlaneDamage = 25 * Math.pow(1.06, levelMultiplier);
            this.bulletDamage = basePlaneDamage * 2;
            this.shootCooldown = 1500;
            this.lastShotTime = Date.now();
            this.battleStartTime = Date.now();
            this.nextSuperShotTime = 0;
        }
        draw() {
            const pulse = Math.sin((Date.now() - this.creationTime) / 400) * 10 + 20;
            ctx.shadowBlur = pulse;
            ctx.shadowColor = 'red';
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            ctx.shadowBlur = 0;
            this.drawHealthBar();
        }
        drawHealthBar() {
            const barWidth = this.width * 0.8,
                barHeight = 15;
            const x = this.x + (this.width - barWidth) / 2,
                y = this.y - barHeight - 5;
            const currentHealthWidth = (this.health / this.maxHealth) * barWidth;
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, barWidth, barHeight);
            ctx.fillStyle = 'red';
            ctx.fillRect(x, y, currentHealthWidth, barHeight);
        }
        update() {
            const targetX = player.x + player.width / 2 - this.width / 2;
            const dx = targetX - this.x;
            if (Math.abs(dx) > this.speed) this.x += Math.sign(dx) * this.speed;
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;
            this.attemptToShoot();
            this.attemptSuperShot();
        }
        attemptToShoot() {
            if (Date.now() - this.lastShotTime > this.shootCooldown) {
                this.lastShotTime = Date.now();
                const rG = ctx.createLinearGradient(0, 0, 0, 12);
                rG.addColorStop(0, "red");
                rG.addColorStop(1, "purple");
                const oS = 12,
                    oW = 8;
                bossBullets.push(new Bullet(this.x + 10, this.y + 100, oW, 12, 'white', rG, oS, this.bulletDamage, 1, 'white', false));
                bossBullets.push(new Bullet(this.x + this.width - 10 - oW, this.y + 100, oW, 12, 'white', rG, oS, this.bulletDamage, 1, 'white', false));
                const iS = 3.5,
                    iW = 12;
                bossBullets.push(new Bullet(this.x + 50, this.y + 120, iW, 12, 'white', rG, iS, this.bulletDamage, 1, 'white', true));
                bossBullets.push(new Bullet(this.x + this.width - 50 - iW, this.y + 120, iW, 12, 'white', rG, iS, this.bulletDamage, 1, 'white', true));
            }
        }
        attemptSuperShot() {
            if (gameState.phase < 3 || Date.now() - this.battleStartTime < 10000) return;
            if (this.nextSuperShotTime === 0) this.nextSuperShotTime = Date.now() + Math.random() * 5000 + 3000;
            if (Date.now() > this.nextSuperShotTime) {
                const lM = Math.floor(gameState.score / SCALING_SCORE_THRESHOLD);
                const sD = (25 * Math.pow(1.06, lM)) * 4,
                    sW = 60;
                const rG = ctx.createLinearGradient(0, 0, sW, 0);
                rG.addColorStop(0, "red");
                rG.addColorStop(0.2, "orange");
                rG.addColorStop(0.4, "yellow");
                rG.addColorStop(0.6, "green");
                rG.addColorStop(0.8, "blue");
                rG.addColorStop(1, "purple");
                bossBullets.push(new Bullet(this.x + this.width / 2 - sW / 2, this.y + 140, sW, 20, rG, rG, 2.5, sD, 1, 'white', false));
                this.nextSuperShotTime = Date.now() + Math.random() * 5000 + 4000;
            }
        }
        takeDamage(damage) {
            this.health -= damage;
            floatingTexts.push(new FloatingText(this.x + Math.random() * this.width, this.y + Math.random() * this.height, Math.round(damage), '#FFFF00'));
            return this.health <= 0;
        }
    }

    // --- FUNÇÕES DE LÓGICA DO JOGO ---

    function resetGame() {
        player = new Player();
        player.updatePowerStats();
        enemies = [];
        boss = null;
        playerBullets = [];
        enemyBullets = [];
        bossBullets = [];
        powerUps = [];
        particles = [];
        floatingTexts = [];
        backgroundY = 0;
        gameState = {
            ...gameState,
            killsSinceBoss: 0,
            bossActive: false,
            bossesDefeated: 0,
            phase: 1,
            killsNeededForNextBoss: KILLS_TO_SPAWN_BOSS_BASE,
            totalKills: 0,
            nextPowerUpKillCount: Math.floor(Math.random() * 3) + 5,
            score: 0,
            level: 1,
            startTime: Date.now(),
            elapsedTime: 0,
            isGameOver: false,
            killCounts: {
                ap: 0,
                ip: 0,
                ah: 0,
                ih: 0
            },
            powerupsCollected: {
                feather: 0,
                cannon: 0,
                bomb: 0,
                health: 0
            }
        };
        updateHudColor();
        updateCurrentBackground();
    }

    function startGame() {
        const name = playerNameInput.value.trim();
        if (name === '') return alert('Por favor, insira um nome de combatente.');
        gameState.playerName = name;
        hudPlayerName.textContent = name;
        startScreen.classList.remove('active');
        gameContainer.style.display = 'block';
        resetGame();
        gameLoop();
    }

    function spawnBoss() {
        gameState.bossActive = true;
        enemies = [];
        boss = new Boss();
    }

    function handleBossDefeat() {
        gameState.score += boss.scoreValue;
        gameState.bossesDefeated++;
        gameState.phase++;
        for (let i = 0; i < 10; i++) createExplosion(boss.x + Math.random() * boss.width, boss.y + Math.random() * boss.height);
        whiteoutFlash.timer = whiteoutFlash.duration;
        phaseMessage.text = `Fase ${gameState.phase}`;
        phaseMessage.timer = phaseMessage.duration;
        updateHudColor();
        updateCurrentBackground();
        boss = null;
        gameState.bossActive = false;
        gameState.killsSinceBoss = 0;
        gameState.killsNeededForNextBoss += KILLS_TO_SPAWN_BOSS_INCREMENT;
    }

    function gameOver() {
        gameState.isGameOver = true;
        cancelAnimationFrame(gameState.animationFrameId);
        saveScore();
        finalBossesDefeated.textContent = gameState.bossesDefeated;
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
        for (let i = 0; i < 30; i++) particles.push(new Particle(x, y, `hsl(${Math.random() * 60}, 100%, 50%)`));
    }

    function spawnEnemy() {
        if (gameState.bossActive || enemies.length >= ENEMY_LIMIT) return;
        const rand = Math.random();
        let newEnemy;
        if (rand < 0.3) newEnemy = new Enemy(assets.aviaoEUA, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 50, 20, 25, 30, 'ap');
        else if (rand < 0.6) newEnemy = new Enemy(assets.aviaoISRAEL, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 40, 25, 20, 25, 'ip');
        else if (rand < 0.8) newEnemy = new Enemy(assets.helicopteroEUA, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 100, 10, 20, 20, 'ah');
        else newEnemy = new Enemy(assets.helicopteroISRAEL, ENEMY_STD_WIDTH, ENEMY_STD_HEIGHT, 80, 8, 16, 15, 'ih');
        enemies.push(newEnemy);
    }

    function spawnRandomPowerUp() {
        const rand = Math.random();
        let type = '';
        if (rand < 0.35) type = 'cannon';
        else if (rand < 0.60) type = 'feather';
        else if (rand < 0.80) type = 'health';
        else type = 'bomb';
        powerUps.push(new PowerUp(Math.random() * (canvas.width - 90), -100, type));
    }

    function updateCurrentBackground() {
        const bgIndex = (gameState.phase - 1) % backgroundImages.length;
        currentBackground = backgroundImages[bgIndex];
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
                if (boss) {
                    boss.health -= boss.maxHealth * 0.1;
                    if (boss.health <= 0) {
                        boss.health = 0;
                        handleBossDefeat();
                    }
                }
                gameState.powerupsCollected.bomb++;
                break;
            case 'health':
                player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.25);
                gameState.powerupsCollected.health++;
                break;
        }
    }

    function checkCollisions() {
        const playerHitbox = {
            x: player.x + (player.width - player.hitboxWidth) / 2,
            y: player.y + (player.height - player.hitboxHeight) / 2,
            width: player.hitboxWidth,
            height: player.hitboxHeight
        };
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                if (playerBullets[i] && enemies[j] && isColliding(playerBullets[i], enemies[j])) {
                    if (enemies[j].takeDamage(playerBullets[i].damage)) {
                        gameState.score += enemies[j].scoreValue;
                        gameState.killCounts[enemies[j].type]++;
                        gameState.totalKills++;
                        gameState.killsSinceBoss++;
                        createExplosion(enemies[j].x + enemies[j].width / 2, enemies[j].y + enemies[j].height / 2);
                        if (gameState.totalKills >= gameState.nextPowerUpKillCount) {
                            spawnRandomPowerUp();
                            gameState.nextPowerUpKillCount = gameState.totalKills + Math.floor(Math.random() * 3) + 5;
                        }
                        if (!gameState.bossActive && gameState.killsSinceBoss >= gameState.killsNeededForNextBoss) spawnBoss();
                        enemies.splice(j, 1);
                    }
                    playerBullets.splice(i, 1);
                    break;
                }
            }
        }
        if (gameState.bossActive && boss) {
            for (let i = playerBullets.length - 1; i >= 0; i--) {
                if (isColliding(playerBullets[i], boss)) {
                    if (boss.takeDamage(playerBullets[i].damage)) handleBossDefeat();
                    playerBullets.splice(i, 1);
                    if (!boss) break;
                }
            }
        }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            if (isColliding(enemyBullets[i], playerHitbox)) {
                player.takeDamage(enemyBullets[i].damage);
                enemyBullets.splice(i, 1);
            }
        }
        for (let i = bossBullets.length - 1; i >= 0; i--) {
            if (isColliding(bossBullets[i], playerHitbox)) {
                player.takeDamage(bossBullets[i].damage);
                bossBullets.splice(i, 1);
            }
        }
        for (let i = powerUps.length - 1; i >= 0; i--) {
            if (isColliding(powerUps[i], player)) {
                applyPowerUp(powerUps[i].type);
                powerUps.splice(i, 1);
            }
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (isColliding(enemies[i], playerHitbox)) {
                player.takeDamage(enemies[i].damage * 2);
                createExplosion(enemies[i].x + enemies[i].width / 2, enemies[i].y + enemies[i].height / 2);
                enemies.splice(i, 1);
            }
        }
    }

    function isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    }

    function updateGame() {
        if (gameState.isGameOver) return;
        player.update();
        if (gameState.bossActive && boss) boss.update();
        playerBullets.forEach(b => b.update());
        playerBullets = playerBullets.filter(b => b.y > -b.height);
        enemies.forEach(e => e.update());
        enemies = enemies.filter(e => e.y < canvas.height + 50);
        enemyBullets.forEach(b => b.update());
        enemyBullets = enemyBullets.filter(b => b.y < canvas.height);
        bossBullets.forEach(b => b.update());
        bossBullets = bossBullets.filter(b => b.y < canvas.height);
        powerUps.forEach(p => p.update());
        powerUps = powerUps.filter(p => p.y < canvas.height + p.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].lifespan <= 0) particles.splice(i, 1);
        }
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update();
            if (floatingTexts[i].lifespan <= 0) floatingTexts.splice(i, 1);
        }
        if (whiteoutFlash.timer > 0) whiteoutFlash.timer -= 1000 / 60;
        if (phaseMessage.timer > 0) phaseMessage.timer -= 1000 / 60;
        if (screenFlash.timer > 0) {
            screenFlash.timer--;
            screenFlash.alpha = (screenFlash.timer / screenFlash.duration) * 0.7;
        } else {
            screenFlash.alpha = 0;
        }
        spawnEnemy();
        checkCollisions();
        const newLevel = 1 + Math.floor(gameState.score / SCALING_SCORE_THRESHOLD);
        if (newLevel > gameState.level) {
            gameState.level = newLevel;
            player.maxHealth = PLAYER_STARTING_HEALTH * (1 + (gameState.level - 1) * 0.10);
            player.health = Math.min(player.maxHealth, player.health + PLAYER_STARTING_HEALTH * 0.10);
            enemies.forEach(e => e.updateStatsForLevel());
        }
        gameState.elapsedTime = Date.now() - gameState.startTime;
        updateHUD();
        backgroundY += 2;
        if (backgroundY >= canvas.height) backgroundY = 0;
    }

    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentBackground && currentBackground.complete) {
            ctx.drawImage(currentBackground, 0, backgroundY, canvas.width, canvas.height);
            ctx.drawImage(currentBackground, 0, backgroundY - canvas.height, canvas.width, canvas.height);
        }
        player.draw();
        if (gameState.bossActive && boss) boss.draw();
        playerBullets.forEach(b => b.draw());
        enemies.forEach(e => e.draw());
        enemyBullets.forEach(b => b.draw());
        bossBullets.forEach(b => b.draw());
        powerUps.forEach(p => p.draw());
        particles.forEach(p => p.draw());
        floatingTexts.forEach(text => text.draw());
        if (whiteoutFlash.timer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${whiteoutFlash.timer / whiteoutFlash.duration})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (phaseMessage.timer > 0) {
            ctx.save();
            ctx.globalAlpha = phaseMessage.timer / phaseMessage.duration;
            ctx.fillStyle = `white`;
            ctx.font = '80px Staatliches';
            ctx.textAlign = 'center';
            ctx.fillText(phaseMessage.text, canvas.width / 2, canvas.height / 2);
            ctx.restore();
        }
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

    function updateHUD() {
        hudScore.textContent = gameState.score;
        hudHealth.textContent = `${Math.ceil(player.health)} / ${Math.round(player.maxHealth)}`;
        hudLevel.textContent = gameState.level;
        hudTime.textContent = formatTime(gameState.elapsedTime);
        hudFeatherLevel.textContent = `x${player.powerUpLevels.feather}`;
        hudCannonLevel.textContent = `x${player.powerUpLevels.cannon}`;
        hudDamage.textContent = Math.round(player.shotDamage);
        hudSpeed.textContent = Math.round(player.speed * 10);
    }

    function updateHudColor() {
        hudElement.classList.remove('phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5');
        const phaseClass = `phase-${Math.min(gameState.phase, 5)}`;
        hudElement.classList.add(phaseClass);
    }

    function formatTime(ms) {
        const s = Math.floor(ms / 1000);
        return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    }

    function saveScore() {
        const scoreData = {
            name: gameState.playerName,
            score: gameState.score,
            level: gameState.level,
            bosses: gameState.bossesDefeated,
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
            tableBody.innerHTML = `<tr><td colspan="8">Nenhum recorde ainda.</td></tr>`;
            return;
        }
        rankings.forEach((entry, index) => {
            const row = document.createElement('tr');
            const killString = `A:${entry.kills.ap+entry.kills.ah} I:${entry.kills.ip+entry.kills.ih}`;
            row.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td>${entry.score}</td><td>${entry.level}</td><td>${entry.bosses || 0}</td><td>${entry.time}</td><td>${killString}</td><td>${entry.powerups}</td>`;
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
    resetRankingBtn.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja apagar todos os recordes? Esta ação não pode ser desfeita.')) {
            localStorage.removeItem('gameRankings');
            displayRanking();
        }
    });
    exportRankingBtn.addEventListener('click', () => {
        const rankingScreenElement = document.getElementById('ranking-screen');
        const rankingContainer = document.getElementById('ranking-table-container');
        const originalMaxHeight = rankingContainer.style.maxHeight,
            originalOverflowY = rankingContainer.style.overflowY;
        rankingContainer.style.maxHeight = 'none';
        rankingContainer.style.overflowY = 'visible';
        html2canvas(rankingScreenElement, {
            backgroundColor: '#344e41',
            scale: 2
        }).then(canvas => {
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