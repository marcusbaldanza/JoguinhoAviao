# Guerra nos Céus — v2 "Operação Corredor"

Shoot'em up vertical em HTML5 Canvas, sem dependências nem build. Abra `index.html` no navegador (funciona com duplo clique ou em qualquer servidor estático).

A versão anterior (`index.html`, `script.js`, `style.css`) está guardada em `_versao_antiga/`. Os arquivos `script.js` e `style.css` da raiz não são mais usados e podem ser apagados.

## Estrutura

```
index.html          telas + HUD
css/style.css       visual da interface
js/config.js        TODOS os números de balanceamento, fases, história, chefes e perks
js/utils.js         matemática e helpers
js/assets.js        carregamento + texturas geradas (sombras, queimaduras, nuvens, crateras, drones, SAM, lanchas)
js/audio.js         efeitos sonoros procedurais (Web Audio, sem arquivos)
js/music.js         trilha de cada fase (versões calma / fase / remix de chefe) + tema do chefe final
js/input.js         teclado, controle (gamepad) e toque
js/fx.js            partículas, explosões em camadas, iluminação dinâmica, clima, tremor de câmera
js/projectiles.js   traçantes, mísseis, foguetes, flak, minas, lasers
js/aircraft.js      HANGAR: 12 aeronaves brasileiras desenhadas por código (1 por nível de canhão)
js/player.js        jogador, evolução por XP (canhão 12, motor 8, mísseis 6) e desenho de sprite
js/enemies.js       inimigos e suas IAs
js/bosses.js        chefes, padrões de ataque, partes destrutíveis
js/powerups.js      power-ups com sorteio adaptativo
js/stages.js        diretor de fase (ondas, mini-chefe, rádio, holofotes)
js/hud.js / ui.js   HUD e telas
js/ranking.js       ranking online (JSONBin) + local
js/game.js          estado, laço principal, colisões e renderização em camadas
assets/opt/         imagens otimizadas (~2 MB no total, antes ~26 MB)
```

## Dificuldade

O jogo escala por "progressão global" (fase + 5 × ciclo): vida, dano, cadência, velocidade dos tiros e volume de inimigos crescem a cada fase e de forma composta a cada ciclo. Há também uma **pressão adaptativa**: quanto mais evoluído o avião, mais inimigos aparecem e mais resistentes eles ficam. Tudo em `SCALING` dentro de `js/config.js`.

## Para ajustar o jogo

Quase tudo se ajusta em `js/config.js`: vida e dano dos inimigos, níveis do canhão, chance de cada power-up, duração das fases, falas de rádio, briefings e padrões de ataque dos chefes.

## Observação de segurança

A chave do JSONBin fica visível no código do navegador. Qualquer pessoa pode usá-la para editar ou apagar o ranking. No painel do JSONBin, crie uma **Access Key** com permissão só para este bin e troque em `RANKING_CONFIG`. Para esconder o botão "Zerar ranking", use `allowReset: false`.
