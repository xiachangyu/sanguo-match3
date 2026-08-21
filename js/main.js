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
  activeProp: null, // 当前待选目标的道具：'hammer' | 'swap' | null
  propPending: null, // swap 道具已选的第一个格
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
  // 未解锁的故事不上场：只有已解锁的故事字块才会出现在盘面（通关对应故事关后才解锁）
  const required = cfg.storyId && save.unlocked[cfg.storyId] ? cfg.storyId : null;
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
  GAME.activeProp = null;
  GAME.propPending = null;
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
  GAME.score += res.score * scoreMult();
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
  GAME.score += chain.score * scoreMult();
  ensureValidMove();
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

// 无解自动洗牌：棋盘无可行步时洗牌，仍无解则重生成（错误处理，见设计文档）
function ensureValidMove() {
  if (match3.hasValidMove(GAME.grid)) return;
  GAME.grid = board.shuffleGrid(GAME.grid);
  if (!match3.hasValidMove(GAME.grid)) {
    GAME.grid = board.createBoard(config.BOARD_ROWS, config.BOARD_COLS, GAME.pool);
  }
  showToast('自动洗牌');
}

// ---------- 输入 ----------
const PROP_LABELS = { hammer: '铁锤', swap: '置换', shuffle: '洗牌', time: '加时' };
function propLabel(id) {
  return PROP_LABELS[id] || id;
}

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 扣除道具并应用效果（含连锁）
function consumeProp(id, res) {
  GAME.save.props[id] -= 1;
  storage.save(GAME.save);
  GAME.grid = res.grid;
  if (res.timeDelta) GAME.timeLeft += res.timeDelta;
  const chain = board.resolveCascade(GAME.grid, GAME.pool);
  GAME.grid = chain.grid;
  GAME.score += chain.score * scoreMult();
  ensureValidMove();
  checkGoal();
}

function startNormal() {
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

function startElite() {
  const s = GAME.save;
  const e = s.eliteLevel;
  if (s.currentLevel <= e) {
    showToast('先通关普通第' + e + '关');
    return;
  }
  if (s.stamina < config.STAMINA_COST) {
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
  startLevel(e, 'elite');
}

// 道具栏点击：洗牌/加时立即用；锤/换进入待选（再点取消）
function tapProp(i) {
  const id = config.PROPS[i];
  if (GAME.activeProp === id) {
    GAME.activeProp = null;
    GAME.propPending = null;
    showToast('已取消');
    return;
  }
  if (GAME.save.props[id] <= 0) { showToast('道具不足'); return; }
  if (id === 'shuffle' || id === 'time') {
    const res = props.use(id, { grid: GAME.grid, pool: GAME.pool });
    consumeProp(id, res);
  } else {
    GAME.activeProp = id;
    GAME.propPending = null;
    showToast(id === 'hammer' ? '点击要砸的字块' : '点击两个相邻字块交换');
  }
}

// 道具待选状态下点击棋盘格
function tapCellWithProp(cell) {
  const id = GAME.activeProp;
  if (id === 'hammer') {
    const res = props.use('hammer', { grid: GAME.grid, pool: GAME.pool }, cell);
    if (!res) { showToast('无效目标'); return; }
    GAME.activeProp = null;
    consumeProp(id, res);
  } else if (id === 'swap') {
    if (!GAME.propPending) {
      GAME.propPending = cell;
      showToast('再点相邻的第二个字块');
      return;
    }
    const res = props.use('swap', { grid: GAME.grid, pool: GAME.pool }, GAME.propPending, cell);
    if (!res) { showToast('需相邻'); return; }
    GAME.activeProp = null;
    GAME.propPending = null;
    consumeProp(id, res);
  }
}

function onTap(tx, ty) {
  if (GAME.state === 'LOBBY') {
    const btns = ui.lobbyButtons(W, H);
    if (inRect(tx, ty, btns.normal)) {
      startNormal();
    } else if (inRect(tx, ty, btns.elite)) {
      startElite();
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
  // PLAYING：先命中棋盘下方广告/分享按钮，再命中道具栏
  const adBtns = ui.playingAdBtns(W, H);
  if (!adBtns.hidden) {
    if (inRect(tx, ty, adBtns.adProp)) {
      ads.showPropAd().then(r => {
        if (r.ok) showToast('获得道具：' + propLabel(r.prop));
        else showToast(r.reason === 'limit' ? '今日广告得道具已达上限' : '未完整观看');
        GAME.save = storage.load();
      });
      return;
    }
    if (inRect(tx, ty, adBtns.share)) {
      const r = ads.showShare();
      if (r.ok) {
        showToast('获得道具：' + propLabel(r.prop));
        GAME.save = storage.load();
      } else if (r.reason === 'limit') {
        showToast('今日已分享过');
      } else {
        showToast('分享不可用');
      }
      return;
    }
  }
  for (let i = 0; i < config.PROPS.length; i++) {
    if (inRect(tx, ty, ui.propBarRect(i, H))) {
      tapProp(i);
      return;
    }
  }
  const cell = cellAt(tx, ty);
  if (!cell) return;
  if (GAME.activeProp) {
    tapCellWithProp(cell);
    return;
  }
  if (GAME.selected) {
    if (board.isAdjacent(GAME.selected, cell)) {
      // 先交换过去（无论是否成三连，玩家能明确看到操作生效），再判断消除
      GAME.grid = board.swapTiles(GAME.grid, GAME.selected, cell);
      const groups = match3.findMatches(GAME.grid);
      if (groups.length) {
        const chain = board.resolveCascade(GAME.grid, GAME.pool);
        GAME.grid = chain.grid;
        GAME.score += chain.score * scoreMult();
        ensureValidMove();
        checkGoal();
      } else {
        showToast('没有可消除的组合');
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
    GAME.selected = null;
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
    ui.drawPlayingAdBtns(ctx, W, H);
    ui.drawStamina(ctx, GAME.save.stamina, 20, H - 12);
    if (GAME.selected) {
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 3;
      const x = BOARD_X + GAME.selected.c * TILE, y = BOARD_Y + GAME.selected.r * TILE;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }
    if (GAME.activeProp) {
      const idx = config.PROPS.indexOf(GAME.activeProp);
      if (idx >= 0) {
        const r = ui.propBarRect(idx, H);
        ctx.strokeStyle = '#ffca28';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      }
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
    GAME.buffs = GAME.buffs.filter(b => b.endAt > performance.now());
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
