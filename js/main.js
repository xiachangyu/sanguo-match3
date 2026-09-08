const config = require('./config');
const board = require('./board');
const match3 = require('./match3');
const story = require('./story');
const skills = require('./skills');
const levels = require('./levels');
const props = require('./props');
const storage = require('./storage');
const ads = require('./ads');
const sound = require('./sound');
const ui = require('./ui');
const heroes = require('./heroes');
const { tile, chOf, specialOf } = require('./tile');

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
  anim: null, // 当前动画：swap | swapBack | clear | clearCells | fall
  lastRender: 0, // LOBBY 降帧用
  // 关卡目标：score | collect | phrase
  goalType: 'score',
  goalChar: null,
  goalCount: 0,
  goalProgress: 0,
  floatTexts: [], // 得分飘字/连击反馈 {text,x,y,color,size,t0,dur}
  particles: [], // 消除粒子 {x,y,vx,vy,color,size,t0,dur}
  tutorial: false, // 新手引导遮罩
  lobbyEnter: null, // 大厅入场动画 {t0,dur}
  startBanner: null, // 关卡开场横幅 {t0,dur,text}
  storyIntro: null, // 故事关开场剧情 { story }
  codexOpen: null, // 图鉴详情当前展开的故事 id（null 为列表）
  voiceBanner: null, // 武将台词横幅 {text,t0,dur}
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

// 圆角矩形（main.js 内部绘制用，与 ui.js 的实现一致）
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 对局初始化 ----------
function startLevel(level, mode) {
  const cfg = levels.getLevelConfig(level, mode);
  const save = GAME.save;
  const unlocked = Object.keys(save.unlocked);
  // 未解锁的故事不上场：只有已解锁的故事字块才会出现在盘面（通关对应故事关后才解锁）
  const required = cfg.storyId && save.unlocked[cfg.storyId] ? cfg.storyId : null;
  const boardStories = story.pickStoriesForBoard(unlocked, required);
  GAME.storyRateMult = cfg.goalType === 'phrase' ? config.PHRASE_STORY_MULT : 1; // 短语目标关提高故事字出现率
  // 已解锁武将：每局随机挑 few 个上场（其绝技词字块进本局盘面），故事关保证当前关武将上场
  const heroSet = new Set();
  {
    const seen = new Set();
    const avail = [];
    for (const id of unlocked) {
      for (const hero of heroes.heroesForStory(id)) {
        if (!seen.has(hero.name)) { seen.add(hero.name); avail.push(hero); }
      }
    }
    const requiredNames = new Set((cfg.storyId ? heroes.heroesForStory(cfg.storyId) : []).map(h => h.name));
    const must = avail.filter(h => requiredNames.has(h.name));
    const rest = avail.filter(h => !requiredNames.has(h.name));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const picked = must.slice();
    const max = config.HEROS_PER_BOARD_MAX;
    while (picked.length < max && rest.length) picked.push(rest.pop());
    for (const h of picked) for (const ch of h.chars) heroSet.add(ch);
  }
  const pool = story.buildPool(boardStories, GAME.storyRateMult, [...heroSet]);
  GAME.level = level;
  GAME.mode = mode;
  GAME.grid = board.createBoard(config.BOARD_ROWS, config.BOARD_COLS, pool);
  GAME.pool = pool;
  GAME.boardStories = boardStories;
  GAME.score = 0;
  GAME.target = cfg.targetScore;
  GAME.timeLeft = cfg.time;
  GAME.goalType = cfg.goalType || 'score';
  GAME.goalChar = cfg.goalChar || null;
  GAME.goalCount = cfg.goalCount || 0;
  GAME.goalProgress = 0;
  GAME.floatTexts = [];
  GAME.particles = [];
  GAME.voiceBanner = null;
  // 故事关开场剧情：普通模式故事关（非第 1 关，第 1 关留给新手引导）
  const showStory = mode === 'normal' && cfg.storyId && level !== 1 ? story.getStory(cfg.storyId) : null;
  GAME.storyIntro = showStory;
  // 关卡开场横幅：非剧情关进入对局时短暂显示关卡/目标
  GAME.startBanner = showStory ? null : { t0: performance.now(), dur: 1300, text: bannerText(cfg) };
  // 第 1 关首次进入显示新手引导（存档记住已看）
  GAME.tutorial = mode === 'normal' && level === 1 && !(GAME.save.settings && GAME.save.settings.tutorialDone);
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
    // 解锁本关武将（收集）
    if (cfg.storyId) {
      for (const hero of heroes.heroesForStory(cfg.storyId)) save.heroes[hero.name] = true;
    }
  } else {
    save.eliteLevel = Math.max(save.eliteLevel, GAME.level + 1);
    if (cfg.storyId && save.unlocked[cfg.storyId]) {
      save.unlocked[cfg.storyId].awakened = true;
    }
  }
  storage.save(save);
  sound.win();
  GAME.result = { win: true, score: GAME.score, target: GAME.target, unlocked: cfg.storyId, goalText: goalText() };
  GAME.state = 'RESULT';
  GAME.anim = null;
}

function onLose() {
  sound.lose();
  GAME.result = { win: false, score: GAME.score, target: GAME.target, goalText: goalText() };
  GAME.state = 'RESULT';
  GAME.anim = null;
}

// 划短语处理
function resolvePhrase() {
  const hit = story.checkPhrasePath(GAME.grid, GAME.pendingPath);
  if (!hit) return;
  sound.phrase(); // 故事短语：五声音阶上行
  if (hit.heroId) {
    // 武姓名触发：专属台词 + 专属音效 + 飘字（显示绝技词）
    const org = GAME.pendingPath[GAME.pendingPath.length - 1];
    const hero = heroes.getHero(hit.heroId);
    pushFloat(hero ? hero.skillWord : hit.heroId, BOARD_X + (org.c + 0.5) * TILE, BOARD_Y + (org.r + 0.5) * TILE - 22, '#ff8f00', 24);
  }
  if (GAME.goalType === 'phrase') GAME.goalProgress += 1;
  const save = GAME.save;
  const awoken = save.unlocked[hit.storyId] && save.unlocked[hit.storyId].awakened;
  // 武将触发：已觉醒且按顺序划 → 觉醒技能；否则（未觉醒或乱序）→ 初始技能。故事用 story 技能。
  const hero = hit.heroId ? heroes.getHero(hit.heroId) : null;
  const skillId = hero
    ? (awoken && hit.heroOrdered ? hero.awakenedSkill : hero.skill)
    : skills.getSkillId(hit.storyId, awoken);
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
  // 武将触发：显示专属台词横幅 + 播放专属音效；否则播通用技能音效
  if (hero) {
    GAME.voiceBanner = { text: hero.voice, t0: performance.now(), dur: 1600 };
    sound.heroVoice(hero.name, hero.audio);
  } else {
    sound.skill(); // 技能触发音效
  }
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
  const done = GAME.goalType === 'collect' || GAME.goalType === 'phrase'
    ? GAME.goalProgress >= GAME.goalCount
    : GAME.score >= GAME.target;
  if (done) onWin();
}

// 当前目标文案（结算界面复用）
function goalText() {
  if (GAME.goalType === 'collect') return '收集「' + GAME.goalChar + '」 ' + GAME.goalProgress + '/' + GAME.goalCount;
  if (GAME.goalType === 'phrase') return '故事短语 ' + GAME.goalProgress + '/' + GAME.goalCount;
  return '得分 ' + GAME.score + ' / ' + GAME.target;
}

// 关卡开场横幅文案
function bannerText(cfg) {
  const lv = (cfg.mode === 'elite' ? '精英 ' : '') + '第' + cfg.level + '关';
  if (cfg.goalType === 'collect') return lv + ' · 收集「' + cfg.goalChar + '」' + cfg.goalCount;
  if (cfg.goalType === 'phrase') return lv + ' · 触发故事短语 ' + cfg.goalCount + ' 次';
  return lv + ' · 目标 ' + cfg.targetScore + ' 分';
}

// 进入大厅：触发入场动画
function enterLobby() {
  GAME.lobbyEnter = { t0: performance.now(), dur: 900 };
}

// 大厅入场动画进度（smoothstep eases 到 0~1）
function enterProgress() {
  if (GAME.lobbyEnter) {
    const p = (performance.now() - GAME.lobbyEnter.t0) / GAME.lobbyEnter.dur;
    if (p >= 1) { GAME.lobbyEnter = null; return 1; }
    const t = Math.max(0, Math.min(1, p));
    return t * t * (3 - 2 * t);
  }
  return 1;
}

// 无解自动洗牌：洗牌重排后可能直接形成匹配，须消除；仍无解则重生成（错误处理，见设计文档）
function ensureValidMove() {
  if (match3.hasValidMove(GAME.grid)) return;
  GAME.grid = board.shuffleGrid(GAME.grid);
  // 洗牌可能直接形成三连，需连锁消除并计分
  const chain = board.resolveCascade(GAME.grid, GAME.pool);
  GAME.grid = chain.grid;
  GAME.score += chain.score * scoreMult();
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
  sound.prop();
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
  if (GAME.anim) return; // 动画播放中锁定输入
  if (GAME.storyIntro) {
    GAME.storyIntro = null; // 点击进入战场
    return;
  }
  if (GAME.tutorial) {
    // 新手引导：点击任意处关闭（存档记住）
    GAME.tutorial = false;
    GAME.save.settings.tutorialDone = true;
    storage.save(GAME.save);
    return;
  }
  if (GAME.state === 'LOBBY') {
    const btns = ui.lobbyButtons(W, H);
    if (inRect(tx, ty, btns.normal)) {
      sound.tap();
      startNormal();
    } else if (inRect(tx, ty, btns.elite)) {
      sound.tap();
      startElite();
    } else if (inRect(tx, ty, btns.codex)) {
      sound.tap();
      GAME.state = 'CODEX';
      GAME.codexOpen = null;
    }
    return;
  }
  if (GAME.state === 'CODEX') {
    if (GAME.codexOpen) {
      GAME.codexOpen = null; // 点击关闭详情
      return;
    }
    const layout = ui.codexLayout(W, H);
    if (inRect(tx, ty, layout.back)) {
      sound.tap();
      GAME.state = 'LOBBY';
      enterLobby();
      return;
    }
    const idx = ui.codexCardAt(tx, ty, layout);
    if (idx >= 0) {
      const hero = heroes.HERO_LIST[idx];
      if (GAME.save.heroes && GAME.save.heroes[hero.name]) {
        sound.tap();
        GAME.codexOpen = hero.name; // 打开武将详情
      } else {
        const lv = levels.UNLOCK.find(u => u.storyId === hero.storyId);
        showToast('通关第 ' + (lv ? lv.level : '?') + ' 关招募 ' + hero.name);
      }
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
          enterLobby();
        }
      });
      return;
    }
    GAME.state = 'LOBBY';
    GAME.save = storage.load();
    enterLobby();
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
  if (detonateSpecial(cell)) return; // 点击特殊块：直接引爆
  if (GAME.selected) {
    if (board.isAdjacent(GAME.selected, cell)) {
      startSwap(GAME.selected, cell); // 播放交换滑动动画，动画结束再判定消除或回弹
      GAME.selected = null;
    } else {
      GAME.selected = cell;
    }
  } else {
    GAME.selected = cell;
  }
}

function onDrag(tx, ty) {
  if (GAME.state !== 'PLAYING' || GAME.anim) return;
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
  if (GAME.state === 'PLAYING' && !GAME.anim && GAME.pendingPath.length >= 2) {
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

// ---------- 动画（消消乐式动作：滑动交换 / 无效回弹 / 消除缩放 / 下落） ----------
const ANIM = { swap: 150, swapBack: 120, clear: 160, fall: 220 };

// 点击相邻两格：预判匹配后播放交换滑动动画（逻辑盘面暂不变，视觉上两格互换位置）
function startSwap(a, b) {
  const swapped = board.swapTiles(GAME.grid, a, b);
  sound.swap();
  GAME.anim = {
    type: 'swap',
    start: performance.now(),
    duration: ANIM.swap,
    a, b,
    swapped,
    valid: match3.findMatches(swapped).length > 0,
  };
}

// 飘字：得分 / 连击反馈文案
function pushFloat(text, x, y, color, size) {
  GAME.floatTexts.push({ text, x, y, color, size, t0: performance.now(), dur: 800 });
}

// 消除粒子：从格子中心飞散彩色碎片
function spawnParticles(cells, colorOf) {
  for (const c of cells) {
    const cx = BOARD_X + (c.c + 0.5) * TILE;
    const cy = BOARD_Y + (c.r + 0.5) * TILE;
    const color = colorOf(c);
    for (let i = 0; i < 3; i++) {
      GAME.particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 240,
        vy: -Math.random() * 180 - 30,
        color,
        size: 3 + Math.random() * 4,
        t0: performance.now(),
        dur: 450 + Math.random() * 250,
      });
    }
  }
}

// 消除区域中心（屏幕坐标，用于飘字）
function cellCenter(cells) {
  let r = 0, c = 0;
  for (const p of cells) { r += p.r; c += p.c; }
  const n = cells.length || 1;
  return { x: BOARD_X + (c / n + 0.5) * TILE, y: BOARD_Y + (r / n + 0.5) * TILE };
}

// 特殊块生成规则：5连→全屏彩虹；4连→横/纵线炸弹（与连线方向一致）；T/L形(≥5格)→3x3炸弹
function makeSpecialFromGroups(groups) {
  let maxLen = 0, best = null;
  for (const g of groups) {
    if (g.cells.length > maxLen) { maxLen = g.cells.length; best = g; }
  }
  if (maxLen >= 5) return { cell: best.cells[Math.floor(best.cells.length / 2)], ch: best.char, special: 'rainbow' };
  if (maxLen === 4) return { cell: best.cells[1], ch: best.char, special: best.kind === 'row' ? 'row' : 'col' };
  const seen = new Set();
  let count = 0;
  for (const g of groups) for (const c of g.cells) {
    const k = c.r + ',' + c.c;
    if (!seen.has(k)) { seen.add(k); count++; }
  }
  if (count >= 5) {
    return { cell: groups[0].cells[Math.floor(groups[0].cells.length / 2)], ch: groups[0].char, special: 'bomb' };
  }
  return null;
}

// 消除动画：匹配消除（可生成特殊块）+ 白闪缩放 + 得分飘字
function startClearMatch(cascadeLevel) {
  const groups = match3.findMatches(GAME.grid);
  if (!groups.length) return;
  let maxLen = 0;
  for (const grp of groups) maxLen = Math.max(maxLen, grp.cells.length);
  const cells = [];
  const seen = new Set();
  for (const grp of groups) for (const c of grp.cells) {
    const k = c.r + ',' + c.c;
    if (!seen.has(k)) { seen.add(k); cells.push(c); }
  }
  const unionCount = cells.length;
  // 生成特殊块（替换一个本应消除的格子）
  const sp = makeSpecialFromGroups(groups);
  let specialCell = null;
  if (sp) {
    const idx = cells.findIndex(c => c.r === sp.cell.r && c.c === sp.cell.c);
    if (idx >= 0) { cells.splice(idx, 1); specialCell = sp; }
  }
  // 音效
  if (maxLen >= 5) sound.match5();
  else if (maxLen === 4) sound.match4();
  else sound.match3();
  if (cascadeLevel > 0) sound.cascade(cascadeLevel);
  // 飘字：该轮得分 + 连击反馈
  let roundScore = 0;
  for (const grp of groups) roundScore += match3.scoreMatch(grp, cascadeLevel);
  const center = cellCenter(cells);
  if (roundScore > 0) pushFloat('+' + roundScore, center.x, center.y, '#ffd54f', 22);
  if (maxLen >= 5) pushFloat('太棒了！', center.x, center.y - 26, '#ff7043', 26);
  else if (maxLen === 4) pushFloat('好！', center.x, center.y - 26, '#ffca28', 24);
  else if (unionCount >= 5) pushFloat('神了！', center.x, center.y - 26, '#ff7043', 24);
  if (cascadeLevel >= 1) pushFloat('连击 ×' + (cascadeLevel + 1), center.x, center.y - 50, '#ff5252', 24);
  // 粒子：按消除组字块颜色飞散
  for (const grp of groups) spawnParticles(grp.cells, () => ui.tileColor(grp.char));
  GAME.anim = { type: 'clear', start: performance.now(), duration: ANIM.clear, groups, cells, cascadeLevel, specialCell };
}

// 引爆动画：直接清除指定格子（特殊块引爆用），不走匹配生成
function startClearCells(cells, cascadeLevel) {
  sound.skill();
  const center = cellCenter(cells);
  pushFloat('引爆！', center.x, center.y - 26, '#ff7043', 26);
  spawnParticles(cells, c => ui.tileColor(chOf(GAME.grid[c.r][c.c])));
  GAME.anim = { type: 'clearCells', start: performance.now(), duration: ANIM.clear, cells, cascadeLevel };
}

// 特殊块引爆区域
function specialArea(special, cell) {
  const rows = GAME.grid.length, cols = GAME.grid[0].length;
  const cells = [];
  const add = (r, c) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols && GAME.grid[r][c] !== null) cells.push({ r, c });
  };
  if (special === 'row') {
    for (let c = 0; c < cols; c++) add(cell.r, c);
  } else if (special === 'col') {
    for (let r = 0; r < rows; r++) add(r, cell.c);
  } else if (special === 'bomb') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(cell.r + dr, cell.c + dc);
  } else if (special === 'rainbow') {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) add(r, c);
  }
  return cells;
}

// 点击特殊块 → 引爆（返回 true 表示已处理）
function detonateSpecial(cell) {
  const sp = specialOf(GAME.grid[cell.r][cell.c]);
  if (!sp) return false;
  const cells = specialArea(sp, cell);
  if (!cells.length) {
    GAME.anim = null;
    return true;
  }
  startClearCells(cells, 0);
  return true;
}

// 下落动画：消除后 applyGravity + refill，各格子（含补字）从原位置滑到新位置
function startFall(fromGrid, cascadeLevel) {
  const fallen = board.applyGravity(fromGrid);
  const toGrid = board.refill(fallen, GAME.pool);
  GAME.grid = toGrid;
  GAME.anim = {
    type: 'fall',
    start: performance.now(),
    duration: ANIM.fall,
    map: buildFallMap(fromGrid, toGrid),
    cascadeLevel,
  };
}

// 计算下落映射：toGrid[r][c] 的内容来自 fromGrid 的哪一行；补字格返回 -1（从顶部外滑入）
function buildFallMap(fromGrid, toGrid) {
  const rows = fromGrid.length, cols = fromGrid[0].length;
  const map = Array.from({ length: rows }, () => Array(cols).fill(-1));
  for (let c = 0; c < cols; c++) {
    const stack = [];
    for (let r = rows - 1; r >= 0; r--) if (fromGrid[r][c] !== null) stack.push(r);
    for (let r = rows - 1; r >= 0; r--) {
      if (toGrid[r][c] !== null) map[r][c] = stack.length ? stack.shift() : -1;
    }
  }
  return map;
}

// 每帧推进动画；动画结束触发下一步（交换→消除→下落→连锁→结算）
function updateAnim() {
  const anim = GAME.anim;
  if (!anim) return;
  const now = performance.now();
  if (now - anim.start < anim.duration) return;
  if (anim.type === 'swap') {
    if (anim.valid) {
      GAME.grid = anim.swapped;
      startClearMatch(0);
    } else {
      // 无效交换：滑回原位
      GAME.anim = { type: 'swapBack', start: now, duration: ANIM.swapBack, a: anim.a, b: anim.b };
    }
  } else if (anim.type === 'swapBack') {
    GAME.anim = null;
  } else if (anim.type === 'clear') {
    // 消除计分（含连锁倍率）+ 收集目标统计，置 null 后写入生成的特殊块，进入下落
    for (const grp of anim.groups) {
      GAME.score += match3.scoreMatch(grp, anim.cascadeLevel) * scoreMult();
      if (GAME.goalType === 'collect' && grp.char === GAME.goalChar) {
        GAME.goalProgress += grp.cells.length;
      }
    }
    const g = GAME.grid.map(row => row.slice());
    for (const c of anim.cells) g[c.r][c.c] = null;
    if (anim.specialCell) {
      const sc = anim.specialCell;
      g[sc.cell.r][sc.cell.c] = tile(sc.ch, sc.special);
    }
    startFall(g, anim.cascadeLevel);
  } else if (anim.type === 'clearCells') {
    // 引爆清除：直接置 null 进入下落
    const g = GAME.grid.map(row => row.slice());
    for (const c of anim.cells) g[c.r][c.c] = null;
    startFall(g, anim.cascadeLevel);
  } else if (anim.type === 'fall') {
    // 下落补字完成：检查连锁（连锁中可再生成特殊块）
    const groups = match3.findMatches(GAME.grid);
    if (groups.length) {
      startClearMatch(anim.cascadeLevel + 1);
    } else {
      ensureValidMove();
      checkGoal();
      GAME.anim = null;
    }
  }
}

// 根据当前动画生成绘制状态（位置插值/缩放/白闪），无动画返回 null
function buildAnimDrawState() {
  const anim = GAME.anim;
  if (!anim) return null;
  const t = Math.min(1, (performance.now() - anim.start) / anim.duration);
  const ease = t * t * (3 - 2 * t); // smoothstep
  if (anim.type === 'swap') {
    const a = anim.a, b = anim.b;
    return {
      posMap: {
        [a.r + ',' + a.c]: { r: a.r + (b.r - a.r) * ease, c: a.c + (b.c - a.c) * ease },
        [b.r + ',' + b.c]: { r: b.r + (a.r - b.r) * ease, c: b.c + (a.c - b.c) * ease },
      },
    };
  }
  if (anim.type === 'swapBack') {
    const a = anim.a, b = anim.b;
    return {
      posMap: {
        [a.r + ',' + a.c]: { r: b.r + (a.r - b.r) * ease, c: b.c + (a.c - b.c) * ease },
        [b.r + ',' + b.c]: { r: a.r + (b.r - a.r) * ease, c: a.c + (b.c - a.c) * ease },
      },
    };
  }
  if (anim.type === 'clear' || anim.type === 'clearCells') {
    const flash = new Set();
    const shrink = {};
    for (const c of anim.cells) {
      const k = c.r + ',' + c.c;
      flash.add(k);
      shrink[k] = 1 - ease;
    }
    return { flash, shrink };
  }
  if (anim.type === 'fall') {
    const posMap = {};
    for (let r = 0; r < GAME.grid.length; r++) {
      for (let c = 0; c < GAME.grid[0].length; c++) {
        if (GAME.grid[r][c] === null) continue;
        const from = anim.map[r][c];
        if (from === r) continue;
        posMap[r + ',' + c] = { r: from + (r - from) * ease, c };
      }
    }
    return { posMap };
  }
  return null;
}

function render() {
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, W, H);
  if (GAME.state === 'LOBBY') {
    ui.drawLobby(ctx, W, H, GAME.save, enterProgress());
  } else if (GAME.state === 'CODEX') {
    ui.drawCodex(ctx, W, H, GAME.save);
    if (GAME.codexOpen) ui.drawCodexDetail(ctx, W, H, GAME.codexOpen, GAME.save);
  } else if (GAME.state === 'PLAYING') {
    ui.drawHUD(ctx, {
      level: GAME.level, mode: GAME.mode,
      goalType: GAME.goalType, goalChar: GAME.goalChar, goalCount: GAME.goalCount, goalProgress: GAME.goalProgress,
      targetScore: GAME.target, timeLeft: GAME.timeLeft, score: GAME.score,
    }, W);
    ui.drawBoard(ctx, GAME.grid, BOARD_X, BOARD_Y, TILE, buildAnimDrawState());
    // 得分飘字 / 连击反馈
    const nowF = performance.now();
    GAME.floatTexts = GAME.floatTexts.filter(f => nowF - f.t0 < f.dur);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of GAME.floatTexts) {
      const p = (nowF - f.t0) / f.dur;
      ctx.globalAlpha = Math.max(0, p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
      ctx.fillStyle = f.color;
      ctx.font = 'bold ' + f.size + 'px sans-serif';
      ctx.fillText(f.text, f.x, f.y - p * 34);
    }
    ctx.globalAlpha = 1;
    // 消除粒子
    const nowP = performance.now();
    GAME.particles = GAME.particles.filter(p => nowP - p.t0 < p.dur);
    for (const p of GAME.particles) {
      const dt = (nowP - p.t0) / 1000;
      const x = p.x + p.vx * dt;
      const y = p.y + p.vy * dt + 150 * dt * dt;
      ctx.globalAlpha = Math.max(0, 1 - (nowP - p.t0) / p.dur);
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
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
    // 关卡开场横幅：进入对局时短暂显示关卡/目标
    if (GAME.startBanner) {
      const p = (performance.now() - GAME.startBanner.t0) / GAME.startBanner.dur;
      if (p >= 1) {
        GAME.startBanner = null;
      } else {
        const alpha = p < 0.2 ? p / 0.2 : p < 0.8 ? 1 : (1 - p) / 0.2;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const bw2 = Math.min(W - 60, 320), bh2 = 46, bx2 = (W - bw2) / 2, by2 = H * 0.3;
        roundRect(ctx, bx2, by2, bw2, bh2, 10);
        ctx.fill();
        ctx.fillStyle = '#ffca28';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(GAME.startBanner.text, W / 2, by2 + bh2 / 2);
        ctx.globalAlpha = 1;
      }
    }
    // 武将台词横幅（触发武将时显示专属台词）
    if (GAME.voiceBanner) {
      const p = (performance.now() - GAME.voiceBanner.t0) / GAME.voiceBanner.dur;
      if (p >= 1) {
        GAME.voiceBanner = null;
      } else {
        const alpha = p < 0.15 ? p / 0.15 : p < 0.8 ? 1 : (1 - p) / 0.2;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const bw2 = Math.min(W - 40, 340), bh2 = 58, bx2 = (W - bw2) / 2, by2 = H * 0.34;
        roundRect(ctx, bx2, by2, bw2, bh2, 12);
        ctx.fill();
        ctx.fillStyle = '#ffca28';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(GAME.voiceBanner.text, W / 2, by2 + bh2 / 2);
        ctx.globalAlpha = 1;
      }
    }
    // 新手引导遮罩（第 1 关首次进入）
    if (GAME.tutorial) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('欢迎来到三国消消乐', W / 2, H * 0.28);
      ctx.fillStyle = '#fff';
      ctx.font = '17px sans-serif';
      ctx.fillText('· 点相邻两个字块交换，三连消除', W / 2, H * 0.4);
      ctx.fillText('· 一笔划过同行/列的故事字块触发技能', W / 2, H * 0.46);
      ctx.fillText('· 4 连生成炸弹，点击引爆', W / 2, H * 0.52);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#cfd8dc';
      ctx.fillText('点击任意处开始', W / 2, H * 0.68);
    }
    // 故事关开场剧情界面（盖在最上层）
    if (GAME.storyIntro) {
      ui.drawStoryIntro(ctx, W, H, GAME.storyIntro.story, GAME.level, GAME.mode);
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
    updateAnim();
  }
  if (GAME.state === 'LOBBY' || GAME.state === 'CODEX') {
    // 大厅/图鉴是静态画面：降到 ~10fps 渲染；大厅入场动画期间保持 60fps
    const entering = GAME.state === 'LOBBY' && GAME.lobbyEnter && performance.now() - GAME.lobbyEnter.t0 < GAME.lobbyEnter.dur;
    if (!entering && ts - GAME.lastRender < 100) {
      requestAnimationFrame(loop);
      return;
    }
    GAME.lastRender = ts;
    if (GAME.state === 'LOBBY') tickStamina();
  }
  render();
  requestAnimationFrame(loop);
}

function init() {
  GAME.save = storage.load();
  enterLobby(); // 启动进入大厅，播放入场动画
  sound.setEnabled(GAME.save.settings && GAME.save.settings.sound !== false);
  sound.startBgm(); // 五声音阶 BGM（首次触摸后音频上下文就绪即发声）
  // 每日奖励：每日首次进入发放 1 个随机道具
  if (!GAME.save.daily.rewarded) {
    const p = config.PROPS[Math.floor(Math.random() * config.PROPS.length)];
    GAME.save.props[p] += 1;
    GAME.save.daily.rewarded = true;
    storage.save(GAME.save);
    showToast('每日奖励：' + propLabel(p) + ' ×1');
  }
  wx.onTouchStart(e => {
    sound.unlock(); // 首次触摸创建音频上下文
    onTap(e.touches[0].clientX, e.touches[0].clientY);
  });
  wx.onTouchMove(e => onDrag(e.touches[0].clientX, e.touches[0].clientY));
  wx.onTouchEnd(() => onDragEnd());
  requestAnimationFrame(loop);
}

module.exports = { init };
