const config = require('./config');
const board = require('./board');
const match3 = require('./match3');
const story = require('./story');
const skills = require('./skills');
const levels = require('./levels');
const props = require('./props');
const storage = require('./storage');
const ads = require('./ads');
const ui = require('./ui');

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const info = wx.getSystemInfoSync();
const W = canvas.width;
const H = canvas.height;

const GAME = {
  state: 'LOBBY', // LOBBY | PLAYING | RESULT
  save: null,
  // 对局内状态
  level: 1,
  mode: 'normal',
  grid: null,
  pool: null,
  boardStories: [],
  storyRateMult: 1,
  score: 0,
  target: 0,
  timeLeft: 0,
  freeze: 0,
  buffs: [], // {type,value,seconds,endAt}
  pendingPath: [], // 划短语的路径
  selected: null,
  result: null,
  reviveUsed: false,
  elapsed: 0,
  lastTs: 0,
};

// ---------- 布局 ----------
const BOARD_PX = Math.floor(Math.min(W, H * 0.66));
const TILE = Math.floor(BOARD_PX / config.BOARD_COLS);
const BOARD_X = Math.floor((W - TILE * config.BOARD_COLS) / 2);
const BOARD_Y = 90;

function cellAt(tx, ty) {
  const r = Math.floor((ty - BOARD_Y) / TILE);
  const c = Math.floor((tx - BOARD_X) / TILE);
  if (r < 0 || r >= config.BOARD_ROWS || c < 0 || c >= config.BOARD_COLS) return null;
  return { r, c };
}

// ---------- 对局初始化 ----------
function startLevel(level, mode) {
  const cfg = levels.getLevelConfig(level, mode);
  const save = GAME.save;
  const unlocked = Object.keys(save.unlocked);
  const required = cfg.storyId && !save.unlocked[cfg.storyId] ? cfg.storyId : null;
  const boardStories = story.pickStoriesForBoard(unlocked, required);
  GAME.storyRateMult = 1; // 每关重置故事字出现率加成
  const pool = story.buildPool(boardStories, GAME.storyRateMult);
  GAME.level = level;
  GAME.mode = mode;
  GAME.grid = board.createBoard(config.BOARD_ROWS, config.BOARD_COLS, pool);
  GAME.pool = pool;
  GAME.boardStories = boardStories;
  GAME.score = 0;
  GAME.target = cfg.targetScore;
  GAME.timeLeft = cfg.time;
  GAME.freeze = 0;
  GAME.buffs = [];
  GAME.pendingPath = [];
  GAME.selected = null;
  GAME.reviveUsed = false;
  GAME.result = null;
  GAME.state = 'PLAYING';
  GAME.elapsed = 0;
}

function onWin() {
  const save = GAME.save;
  const cfg = levels.getLevelConfig(GAME.level, GAME.mode);
  save.highScores[GAME.mode + '_' + GAME.level] = Math.max(save.highScores[GAME.mode + '_' + GAME.level] || 0, GAME.score);
  if (GAME.mode === 'normal') {
    save.currentLevel = Math.max(save.currentLevel, GAME.level + 1);
    if (cfg.storyId && !save.unlocked[cfg.storyId]) {
      save.unlocked[cfg.storyId] = { awakened: false };
    }
  } else {
    save.eliteLevel = Math.max(save.eliteLevel, GAME.level + 1);
    if (cfg.storyId && save.unlocked[cfg.storyId]) {
      save.unlocked[cfg.storyId].awakened = true;
    }
  }
  storage.save(save);
  GAME.result = { win: true, score: GAME.score, target: GAME.target, unlocked: cfg.storyId };
  GAME.state = 'RESULT';
}

function onLose() {
  GAME.result = { win: false, score: GAME.score, target: GAME.target };
  GAME.state = 'RESULT';
}

// 划短语处理
function resolvePhrase() {
  const hit = story.checkPhrasePath(GAME.grid, GAME.pendingPath);
  if (!hit) return;
  const save = GAME.save;
  const awoken = save.unlocked[hit.storyId] && save.unlocked[hit.storyId].awakened;
  const skillId = skills.getSkillId(hit.storyId, awoken);
  // 1) 划掉的短语字块先清空
  const grid = GAME.grid.map(row => row.slice());
  for (const cell of hit.cells) grid[cell.r][cell.c] = null;
  // 2) 短语得分（× 当前 buff）
  GAME.score += config.PHRASE_SCORE * scoreMult();
  // 3) 触发技能（在短语清除后的盘面上执行）
  const res = skills.activate(skillId, {
    grid,
    pool: GAME.pool,
    origin: GAME.pendingPath[GAME.pendingPath.length - 1],
    storyId: hit.storyId,
  });
  GAME.grid = res.grid;
  GAME.score += res.score;
  applyBuffs(res);
  if (res.timeDelta) GAME.timeLeft += res.timeDelta;
  if (res.timeFreeze) GAME.freeze = res.timeFreeze;
  if (res.storyRateMult) {
    GAME.storyRateMult = res.storyRateMult;
    GAME.pool = story.buildPool(GAME.boardStories, GAME.storyRateMult);
  }
  GAME.pendingPath = [];
  // 4) 技能清除后的下落/连锁
  const chain = board.resolveCascade(GAME.grid, GAME.pool);
  GAME.grid = chain.grid;
  GAME.score += chain.score;
  checkGoal();
}

function scoreMult() {
  let mult = 1;
  for (const b of GAME.buffs) {
    if (b.type === 'scoreMult' && performance.now() < b.endAt) mult *= b.value;
    if (b.type === 'lowTimeDouble' && GAME.timeLeft < 10) mult *= b.value;
  }
  return mult;
}

function applyBuffs(res) {
  for (const b of res.buffs) {
    if (b.seconds > 0) GAME.buffs.push({ type: b.type, value: b.value, seconds: b.seconds, endAt: performance.now() + b.seconds * 1000 });
    else GAME.buffs.push({ type: b.type, value: b.value, seconds: 0, endAt: Infinity });
  }
  GAME.buffs = GAME.buffs.filter(b => b.endAt > performance.now());
}

function checkGoal() {
  if (GAME.score >= GAME.target) onWin();
}

// ---------- 输入 ----------
function onTap(tx, ty) {
  if (GAME.state === 'LOBBY') {
    const by = H * 0.4, bh = 70;
    if (ty >= by && ty <= by + bh) {
      const s = GAME.save;
      if (s.stamina < config.STAMINA_COST) {
        // 体力不足：优先看广告补
        ads.showStaminaAd().then(r => {
          if (!r.ok) showToast('体力不足，等待恢复或看广告');
          GAME.save = storage.load();
        });
        return;
      }
      s.stamina -= config.STAMINA_COST;
      s.staminaTs = Date.now();
      storage.save(s);
      GAME.save = s;
      startLevel(s.currentLevel, 'normal');
    }
    return;
  }
  if (GAME.state === 'RESULT') {
    if (!GAME.result.win && !GAME.reviveUsed) {
      ads.showReviveAd().then(r => {
        if (r.ok) {
          GAME.timeLeft += r.seconds;
          GAME.reviveUsed = true;
          GAME.state = 'PLAYING';
        } else {
          GAME.state = 'LOBBY';
          GAME.save = storage.load();
        }
      });
      return;
    }
    GAME.state = 'LOBBY';
    GAME.save = storage.load();
    return;
  }
  // PLAYING：点击选中/交换
  const cell = cellAt(tx, ty);
  if (!cell) return;
  if (GAME.selected) {
    if (board.isAdjacent(GAME.selected, cell)) {
      const g = board.swapTiles(GAME.grid, GAME.selected, cell);
      const groups = match3.findMatches(g);
      if (groups.length) {
        GAME.grid = g;
        const chain = board.resolveCascade(GAME.grid, GAME.pool);
        GAME.grid = chain.grid;
        GAME.score += chain.score;
        checkGoal();
      }
      GAME.selected = null;
    } else {
      GAME.selected = cell;
    }
  } else {
    GAME.selected = cell;
  }
}

function onDrag(tx, ty) {
  if (GAME.state !== 'PLAYING') return;
  const cell = cellAt(tx, ty);
  if (!cell) return;
  const last = GAME.pendingPath[GAME.pendingPath.length - 1];
  if (!last) {
    GAME.pendingPath = [cell];
    return;
  }
  if (board.isAdjacent(last, cell)) {
    GAME.pendingPath.push(cell);
  }
}

function onDragEnd() {
  if (GAME.state === 'PLAYING' && GAME.pendingPath.length >= 2) {
    resolvePhrase();
  }
  GAME.pendingPath = [];
}

// ---------- 体力恢复 ----------
function tickStamina() {
  const s = GAME.save;
  if (s.stamina >= config.STAMINA_MAX) {
    s.staminaTs = Date.now();
    return;
  }
  const now = Date.now();
  const gained = Math.floor((now - s.staminaTs) / config.STAMINA_REFILL_MS);
  if (gained > 0) {
    s.stamina = Math.min(config.STAMINA_MAX, s.stamina + gained);
    s.staminaTs = s.stamina >= config.STAMINA_MAX ? now : s.staminaTs + gained * config.STAMINA_REFILL_MS;
    storage.save(s);
  }
}

// ---------- 游戏循环 ----------
let toast = null;
function showToast(msg) {
  toast = { msg, until: performance.now() + 1600 };
}

function render() {
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, W, H);
  if (GAME.state === 'LOBBY') {
    ui.drawLobby(ctx, W, H, GAME.save);
  } else if (GAME.state === 'PLAYING') {
    ui.drawHUD(ctx, { level: GAME.level, mode: GAME.mode, targetScore: GAME.target, timeLeft: GAME.timeLeft, score: GAME.score }, W);
    ui.drawBoard(ctx, GAME.grid, BOARD_X, BOARD_Y, TILE);
    ui.drawPropBar(ctx, GAME.save.props, 16, H - 56, 46);
    ui.drawStamina(ctx, GAME.save.stamina, 20, H - 12);
    if (GAME.selected) {
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 3;
      const x = BOARD_X + GAME.selected.c * TILE, y = BOARD_Y + GAME.selected.r * TILE;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }
  } else {
    ui.drawResult(ctx, W, H, GAME.result);
  }
  if (toast && performance.now() < toast.until) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 130, H - 120, 260, 44);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(toast.msg, W / 2, H - 93);
  }
}

function loop(ts) {
  if (!GAME.lastTs) GAME.lastTs = ts;
  const dt = (ts - GAME.lastTs) / 1000;
  GAME.lastTs = ts;
  if (GAME.state === 'PLAYING') {
    if (GAME.freeze > 0) {
      GAME.freeze -= dt;
    } else {
      GAME.timeLeft -= dt;
      if (GAME.timeLeft <= 0) {
        GAME.timeLeft = 0;
        onLose();
      }
    }
    GAME.buffs = GAME.buffs.filter(b => b.endAt > ts);
  }
  if (GAME.state === 'LOBBY') tickStamina();
  render();
  requestAnimationFrame(loop);
}

function init() {
  GAME.save = storage.load();
  wx.onTouchStart(e => onTap(e.touches[0].clientX, e.touches[0].clientY));
  wx.onTouchMove(e => onDrag(e.touches[0].clientX, e.touches[0].clientY));
  wx.onTouchEnd(() => onDragEnd());
  requestAnimationFrame(loop);
}

module.exports = { init };
