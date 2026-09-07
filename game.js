// 呪力バトル -CURSE BATTLE-
// オリジナルの呪術師 vs 呪霊 トップダウン・アクションバトルゲーム
// キャラクター名・敵設定はすべてオリジナル創作です。

(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // データ定義
  // ---------------------------------------------------------------------

  const CHARACTERS = [
    {
      id: "haruma",
      name: "朧井 陽真",
      role: "均衡型 呪術師",
      emoji: "🥋",
      color: "#7c3aed",
      desc: "攻撃・速度のバランスに優れた万能タイプ。",
      hp: 100,
      speed: 220,
      atk: 14,
      atkRange: 56,
      atkCooldown: 0.35,
      ceGainPerHit: 9,
      specialName: "秘奥義・紫電一閃",
      specialDamage: 60,
      specialRadius: 230,
    },
    {
      id: "ruka",
      name: "氷室 瑠花",
      role: "速攻型 呪術師",
      emoji: "❄️",
      color: "#38bdf8",
      desc: "高速移動と手数で敵を翻弄する。HPはやや低め。",
      hp: 80,
      speed: 280,
      atk: 10,
      atkRange: 50,
      atkCooldown: 0.24,
      ceGainPerHit: 7,
      specialName: "秘奥義・氷輪絶界",
      specialDamage: 48,
      specialRadius: 260,
    },
    {
      id: "gou",
      name: "巌流 剛",
      role: "重装型 呪術師",
      emoji: "🛡️",
      color: "#e11d48",
      desc: "圧倒的なHPと一撃の重さを誇る前衛タイプ。",
      hp: 140,
      speed: 175,
      atk: 20,
      atkRange: 62,
      atkCooldown: 0.5,
      ceGainPerHit: 11,
      specialName: "秘奥義・破岩崩撃",
      specialDamage: 80,
      specialRadius: 210,
    },
  ];

  const ENEMY_TYPES = {
    small: {
      label: "雑魚呪霊",
      emoji: "👺",
      r: 14,
      hp: 18,
      speed: 110,
      damage: 8,
      color: "#f87171",
      score: 10,
    },
    medium: {
      label: "中級呪霊",
      emoji: "👹",
      r: 20,
      hp: 46,
      speed: 85,
      damage: 14,
      color: "#c084fc",
      score: 25,
    },
    boss: {
      label: "特級呪霊",
      emoji: "👿",
      r: 40,
      hp: 420,
      speed: 60,
      damage: 24,
      color: "#f43f5e",
      score: 300,
    },
  };

  const TOTAL_WAVES = 5;
  const CANVAS_W = 800;
  const CANVAS_H = 480;

  // ---------------------------------------------------------------------
  // DOM 参照
  // ---------------------------------------------------------------------

  const screens = {
    title: document.getElementById("screen-title"),
    select: document.getElementById("screen-select"),
    game: document.getElementById("screen-game"),
    result: document.getElementById("screen-result"),
  };

  const characterListEl = document.getElementById("character-list");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const hpFillEl = document.getElementById("player-hp-fill");
  const ceFillEl = document.getElementById("player-ce-fill");
  const waveLabelEl = document.getElementById("wave-label");
  const scoreLabelEl = document.getElementById("score-label");

  const resultTitleEl = document.getElementById("result-title");
  const resultDetailEl = document.getElementById("result-detail");

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle("active", key === name);
    });
  }

  // ---------------------------------------------------------------------
  // キャラクター選択UI構築
  // ---------------------------------------------------------------------

  function buildCharacterList() {
    characterListEl.innerHTML = "";
    CHARACTERS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "character-card";
      card.style.borderColor = "#262a35";
      card.innerHTML = `
        <div class="emoji">${c.emoji}</div>
        <h3>${c.name}</h3>
        <div class="role">${c.role}</div>
        <div class="desc">${c.desc}</div>
        <div class="stat-row"><span>HP</span><span>${c.hp}</span></div>
        <div class="stat-row"><span>攻撃力</span><span>${c.atk}</span></div>
        <div class="stat-row"><span>秘奥義</span><span>${c.specialName}</span></div>
      `;
      card.addEventListener("click", () => startGame(c));
      characterListEl.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------
  // 入力管理
  // ---------------------------------------------------------------------

  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  function isDown(...names) {
    return names.some((n) => keys.has(n));
  }

  // ---------------------------------------------------------------------
  // ゲーム状態
  // ---------------------------------------------------------------------

  let game = null;
  let rafId = null;

  function startGame(characterDef) {
    game = {
      char: characterDef,
      player: {
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        r: 18,
        hp: characterDef.hp,
        maxHp: characterDef.hp,
        ce: 0,
        maxCe: 100,
        speed: characterDef.speed,
        atkCooldown: 0,
        invuln: 0,
        facing: { x: 0, y: -1 },
        flashTimer: 0,
      },
      enemies: [],
      slashEffects: [],
      hitEffects: [],
      wave: 1,
      waveEnemiesRemaining: 0,
      waveTransitionTimer: 1.2,
      inWaveTransition: true,
      score: 0,
      elapsed: 0,
      ended: false,
      specialFlashTimer: 0,
    };

    spaceWasDown = false;
    xWasDown = false;

    showScreen("game");
    updateHud();
    if (rafId) cancelAnimationFrame(rafId);
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function spawnWave(wave) {
    const enemies = [];
    if (wave === TOTAL_WAVES) {
      enemies.push(makeEnemy("boss"));
    } else {
      const smallCount = 3 + wave;
      const mediumCount = Math.max(0, wave - 1);
      for (let i = 0; i < smallCount; i++) enemies.push(makeEnemy("small"));
      for (let i = 0; i < mediumCount; i++) enemies.push(makeEnemy("medium"));
    }
    return enemies;
  }

  function makeEnemy(type) {
    const def = ENEMY_TYPES[type];
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = -30; y = Math.random() * CANVAS_H; }
    else if (edge === 1) { x = CANVAS_W + 30; y = Math.random() * CANVAS_H; }
    else if (edge === 2) { x = Math.random() * CANVAS_W; y = -30; }
    else { x = Math.random() * CANVAS_W; y = CANVAS_H + 30; }

    return {
      type,
      x, y,
      r: def.r,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      damage: def.damage,
      color: def.color,
      emoji: def.emoji,
      atkCooldown: 0,
      hitFlash: 0,
    };
  }

  // ---------------------------------------------------------------------
  // メインループ
  // ---------------------------------------------------------------------

  let lastTime = 0;
  let spaceWasDown = false;
  let xWasDown = false;

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    if (game && !game.ended) {
      update(dt);
    }
    render();

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    game.elapsed += dt;

    if (game.inWaveTransition) {
      game.waveTransitionTimer -= dt;
      if (game.waveTransitionTimer <= 0) {
        game.inWaveTransition = false;
        game.enemies = spawnWave(game.wave);
        game.waveEnemiesRemaining = game.enemies.length;
      }
      updateHud();
      return;
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateEffects(dt);
    checkWaveClear();
    updateHud();
  }

  function updatePlayer(dt) {
    const p = game.player;
    let dx = 0, dy = 0;
    if (isDown("arrowleft", "a")) dx -= 1;
    if (isDown("arrowright", "d")) dx += 1;
    if (isDown("arrowup", "w")) dy -= 1;
    if (isDown("arrowdown", "s")) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      p.facing = { x: dx, y: dy };
      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
    }

    p.x = clamp(p.x, p.r, CANVAS_W - p.r);
    p.y = clamp(p.y, p.r, CANVAS_H - p.r);

    if (p.atkCooldown > 0) p.atkCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.flashTimer > 0) p.flashTimer -= dt;
    if (game.specialFlashTimer > 0) game.specialFlashTimer -= dt;

    const spaceDown = isDown(" ");
    if (spaceDown && !spaceWasDown && p.atkCooldown <= 0) {
      performAttack();
    }
    spaceWasDown = spaceDown;

    const xDown = isDown("x");
    if (xDown && !xWasDown && p.ce >= p.maxCe) {
      performSpecial();
    }
    xWasDown = xDown;
  }

  function performAttack() {
    const p = game.player;
    const c = game.char;
    p.atkCooldown = c.atkCooldown;

    const cx = p.x + p.facing.x * 24;
    const cy = p.y + p.facing.y * 24;
    game.slashEffects.push({ x: cx, y: cy, r: c.atkRange, life: 0.15, maxLife: 0.15 });

    let hitAny = false;
    for (const e of game.enemies) {
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist <= c.atkRange + e.r) {
        damageEnemy(e, c.atk);
        hitAny = true;
      }
    }
    if (hitAny) {
      p.ce = Math.min(p.maxCe, p.ce + c.ceGainPerHit);
    } else {
      p.ce = Math.min(p.maxCe, p.ce + c.ceGainPerHit * 0.25);
    }
  }

  function performSpecial() {
    const p = game.player;
    const c = game.char;
    p.ce = 0;
    game.specialFlashTimer = 0.4;
    game.slashEffects.push({ x: p.x, y: p.y, r: c.specialRadius, life: 0.4, maxLife: 0.4, special: true });

    for (const e of game.enemies) {
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist <= c.specialRadius + e.r) {
        damageEnemy(e, c.specialDamage);
      }
    }
    p.invuln = Math.max(p.invuln, 0.5);
  }

  function damageEnemy(e, amount) {
    e.hp -= amount;
    e.hitFlash = 0.12;
    game.hitEffects.push({ x: e.x, y: e.y, life: 0.25, maxLife: 0.25 });
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];

      if (e.hp <= 0) {
        const def = ENEMY_TYPES[e.type];
        game.score += def.score;
        game.enemies.splice(i, 1);
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.x += (dx / dist) * e.speed * dt;
      e.y += (dy / dist) * e.speed * dt;

      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.atkCooldown > 0) e.atkCooldown -= dt;

      const touchDist = e.r + p.r;
      if (dist <= touchDist && e.atkCooldown <= 0) {
        e.atkCooldown = 0.8;
        if (p.invuln <= 0) {
          p.hp -= e.damage;
          p.invuln = 0.5;
          p.flashTimer = 0.3;
          if (p.hp <= 0) {
            p.hp = 0;
            endGame(false);
          }
        }
      }
    }
  }

  function updateEffects(dt) {
    for (let i = game.slashEffects.length - 1; i >= 0; i--) {
      game.slashEffects[i].life -= dt;
      if (game.slashEffects[i].life <= 0) game.slashEffects.splice(i, 1);
    }
    for (let i = game.hitEffects.length - 1; i >= 0; i--) {
      game.hitEffects[i].life -= dt;
      if (game.hitEffects[i].life <= 0) game.hitEffects.splice(i, 1);
    }
  }

  function checkWaveClear() {
    if (game.ended || game.inWaveTransition) return;
    if (game.enemies.length === 0) {
      if (game.wave >= TOTAL_WAVES) {
        endGame(true);
      } else {
        game.wave += 1;
        game.inWaveTransition = true;
        game.waveTransitionTimer = 1.4;
      }
    }
  }

  function endGame(won) {
    game.ended = true;
    showScreen("result");
    if (won) {
      resultTitleEl.textContent = "呪霊掃討完了";
      resultDetailEl.textContent =
        `全${TOTAL_WAVES}ウェーブを制圧した!\nスコア: ${game.score}`;
    } else {
      resultTitleEl.textContent = "GAME OVER";
      resultDetailEl.textContent =
        `WAVE ${game.wave} で力尽きた…\nスコア: ${game.score}`;
    }
  }

  // ---------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------

  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    drawBackground();

    if (!game) return;

    for (const eff of game.slashEffects) {
      const t = eff.life / eff.maxLife;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.r * (1 - t * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = eff.special
        ? `rgba(56, 189, 248, ${t})`
        : `rgba(255, 255, 255, ${t * 0.8})`;
      ctx.lineWidth = eff.special ? 4 : 2;
      ctx.stroke();
    }

    for (const eff of game.hitEffects) {
      const t = eff.life / eff.maxLife;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, 10 * (1 - t) + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248, 113, 113, ${t})`;
      ctx.fill();
    }

    for (const e of game.enemies) {
      drawEnemy(e);
    }

    drawPlayer();

    if (game.inWaveTransition) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      const label = game.wave === TOTAL_WAVES ? "特級呪霊 出現" : `WAVE ${game.wave}`;
      ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2);
      ctx.restore();
    }
  }

  function drawBackground() {
    ctx.save();
    ctx.strokeStyle = "rgba(124, 58, 237, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    const c = game.char;
    ctx.save();

    if (game.specialFlashTimer > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, c.specialRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      ctx.fill();
    }

    ctx.globalAlpha = p.invuln > 0 ? 0.5 + 0.5 * Math.sin(performance.now() / 40) : 1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.flashTimer > 0 ? "#fff" : c.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.emoji, p.x, p.y - 2);

    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = e.hitFlash > 0 ? "#fff" : e.color;
    ctx.fill();

    ctx.font = `${Math.floor(e.r * 1.2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(e.emoji, e.x, e.y - 1);

    const barW = e.r * 2;
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(e.x - barW / 2, e.y - e.r - 10, barW, 4);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(e.x - barW / 2, e.y - e.r - 10, barW * hpRatio, 4);

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // HUD更新
  // ---------------------------------------------------------------------

  function updateHud() {
    if (!game) return;
    const p = game.player;
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    hpFillEl.style.width = `${hpRatio * 100}%`;
    hpFillEl.classList.toggle("low", hpRatio <= 0.3);

    const ceRatio = p.ce / p.maxCe;
    ceFillEl.style.width = `${ceRatio * 100}%`;
    ceFillEl.classList.toggle("full", ceRatio >= 1);

    waveLabelEl.textContent = game.wave === TOTAL_WAVES
      ? "BOSS WAVE"
      : `WAVE ${game.wave} / ${TOTAL_WAVES}`;
    scoreLabelEl.textContent = `SCORE: ${game.score}`;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ---------------------------------------------------------------------
  // 画面遷移ボタン
  // ---------------------------------------------------------------------

  document.getElementById("btn-start").addEventListener("click", () => {
    showScreen("select");
  });

  document.getElementById("btn-back-title").addEventListener("click", () => {
    showScreen("title");
  });

  document.getElementById("btn-retry").addEventListener("click", () => {
    if (game) startGame(game.char);
  });

  document.getElementById("btn-title").addEventListener("click", () => {
    if (rafId) cancelAnimationFrame(rafId);
    game = null;
    showScreen("title");
  });

  buildCharacterList();
  render();
})();
