# 三国消消乐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable WeChat mini-game "三国消消乐" — an 8×8 swap match-3 with Three Kingdoms story-phrase swipe mechanics, ladder story unlocks, skills, elite mode, stamina, props, rewarded ads and sharing.

**Architecture:** Native WeChat mini-game (JavaScript + Canvas, zero third-party deps). Core game logic (board, match3, story, skills, levels, props) is written as pure CommonJS modules tested in Node with `node --test`; the WeChat platform layer (storage, ads, ui, main) is thin and manually tested in WeChat DevTools. State machine: LOBBY → PLAYING → RESULT, with separate normal/elite progress tracks.

**Tech Stack:** WeChat mini-game runtime (`wx.*` API, Canvas), Node.js v24 + built-in `node --test` for unit tests. No npm dependencies.

---

## File Structure

```
zizouqi/
├── game.js                 # 微信小游戏入口 (调用 main.init)
├── game.json               # 微信小游戏配置 (竖屏)
├── project.config.json     # 微信开发者工具项目配置
├── package.json            # 仅测试脚本用
├── js/
│   ├── config.js           # 全局数值配置 (纯数据)
│   ├── board.js            # 棋盘生成/互换/下落/补字/连锁 (纯逻辑, 依赖 match3)
│   ├── match3.js           # 三/四/五连判定/计分/无解检测 (纯逻辑, 无依赖)
│   ├── story.js            # 12个故事数据 + 划线短语判定 + 字池 (纯逻辑, 依赖 board)
│   ├── skills.js           # 技能定义与执行 (纯逻辑, 依赖 board/story)
│   ├── levels.js           # 关卡配置解析 (普通/精英, 解锁表) (纯逻辑, 依赖 config/story)
│   ├── props.js            # 道具定义与执行 (纯逻辑, 依赖 board/config)
│   ├── storage.js          # wx.setStorageSync 存档封装 (可注入 mock 测试)
│   ├── ads.js              # 激励视频广告封装 (手动测试)
│   ├── ui.js               # Canvas 渲染 (大厅/棋盘/HUD/结算/道具栏)
│   └── main.js             # 状态机/游戏循环/输入/装配
├── test/
│   ├── match3.test.js
│   ├── board.test.js
│   ├── story.test.js
│   ├── skills.test.js
│   ├── levels.test.js
│   ├── props.test.js
│   └── storage.test.js
└── docs/superpowers/...    # 既有 spec/plan
```

**核心类型约定（全项目一致）：**
- `grid`：二维数组 `grid[r][c]`，值为单字符字符串或 `null`。
- `Cell`：`{ r, c }`。
- `MatchGroup`：`{ cells: Cell[], char, kind: 'row'|'col' }`。
- `Pool`：`{ [char]: weight }` 加权表。
- **技能/道具执行结果**：`{ grid, cleared: Cell[], score, buffs: [{type,value,seconds}], timeDelta, timeFreeze, storyRateMult, notes }`；`cleared` 供上层计分，`grid` 为新盘面。
- 依赖方向（避免循环）：`match3` 无依赖；`board → match3`；`story → board`；`skills → board, story`；`levels → config, story`；`props → board, config`。

---

## Phase 0：项目骨架与测试基础

### Task 1: 微信小游戏项目骨架

**Files:**
- Create: `game.js`
- Create: `game.json`
- Create: `project.config.json`
- Create: `package.json`

- [ ] **Step 1: 写入口与配置**

`game.js`:
```js
// 微信小游戏入口
require('./js/main').init();
```

`game.json`:
```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false,
  "networkTimeout": { "request": 10000 }
}
```

`project.config.json`:
```json
{
  "appid": "touristappid",
  "projectname": "sanguo-match3",
  "compileType": "game",
  "libVersion": "latest",
  "setting": {
    "es6": true,
    "minified": true
  }
}
```

`package.json`:
```json
{
  "name": "sanguo-match3",
  "version": "1.0.0",
  "private": true,
  "scripts": { "test": "node --test test/" }
}
```

- [ ] **Step 2: 创建 js/ 与 test/ 目录**

Run: `mkdir -p js test`
Expected: 两个目录创建成功。

- [ ] **Step 3: 冒烟验证**

Run: `node -e "console.log('skeleton ok')"`
Expected: 输出 `skeleton ok`。

- [ ] **Step 4: Commit**

```bash
git add game.js game.json project.config.json package.json
git commit -m "chore: scaffold WeChat mini-game project skeleton"
```

---

### Task 2: 测试基础设施 + config.js

**Files:**
- Create: `test/match3.test.js`（占位冒烟测试，Task 3 起真实填充）
- Create: `js/config.js`
- Modify: `package.json`（已就绪）

- [ ] **Step 1: 写冒烟测试**

`test/match3.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const match3 = require('../js/match3');

test('smoke: match3 module loads', () => {
  assert.ok(typeof match3.findMatches === 'function');
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/`
Expected: FAIL，报 `Cannot find module '../js/match3'`。

- [ ] **Step 3: 写 config.js**

`js/config.js`:
```js
module.exports = {
  BOARD_ROWS: 8,
  BOARD_COLS: 8,
  BASE_TILES: ['兵', '弓', '车', '枪', '骑'],
  BASE_WEIGHT: 100,
  STORY_WEIGHT: 15,
  STORY_PER_BOARD_MIN: 2,
  STORY_PER_BOARD_MAX: 3,
  SCORE_MATCH3: 30,
  SCORE_MATCH4: 60,
  SCORE_MATCH5: 100,
  CASCADE_MULT: 1.5,
  PHRASE_SCORE: 500,
  NORMAL_TIME: 60,
  NORMAL_SCORE_BASE: 800,
  NORMAL_SCORE_STEP: 150,
  ELITE_TIME: 40,
  ELITE_SCORE_MULT: 1.5,
  STAMINA_INITIAL: 30,
  STAMINA_MAX: 30,
  STAMINA_COST: 5,
  STAMINA_REFILL_MS: 10 * 60 * 1000,
  AD_STAMINA_AMOUNT: 10,
  AD_STAMINA_DAILY_LIMIT: 5,
  AD_CONTINUE_SECONDS: 15,
  AD_CONTINUE_PER_LEVEL: 1,
  AD_PROP_DAILY_LIMIT: 3,
  PROP_TIME_SECONDS: 10,
  PROPS: ['hammer', 'swap', 'shuffle', 'time']
};
```

- [ ] **Step 4: 写 match3.js 骨架**

`js/match3.js`:
```js
function findMatches() {}
function applyMatch() {}
function scoreMatch() {}
function hasValidMove() {}
module.exports = { findMatches, applyMatch, scoreMatch, hasValidMove };
```

- [ ] **Step 5: 运行确认通过**

Run: `node --test test/`
Expected: PASS，1 个测试通过。

- [ ] **Step 6: Commit**

```bash
git add test/match3.test.js js/config.js js/match3.js
git commit -m "chore: add test infra and game config"
```

---

## Phase 1：核心棋盘与三消

### Task 3: match3.js — 连消判定与计分

**Files:**
- Modify: `test/match3.test.js`
- Modify: `js/match3.js`

- [ ] **Step 1: 写失败测试**

`test/match3.test.js`（整体替换）:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const match3 = require('../js/match3');

test('findMatches detects horizontal and vertical 3+ runs', () => {
  const grid = [
    ['兵', '兵', '兵', '弓'],
    ['车', '骑', '枪', '弓'],
    ['骑', '枪', '兵', '弓'],
  ];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 2); // 横排3个兵 + 竖排3个弓
  const horizontal = groups.find(g => g.kind === 'row');
  const vertical = groups.find(g => g.kind === 'col');
  assert.ok(horizontal && horizontal.cells.length === 3);
  assert.ok(vertical && vertical.cells.length === 3);
});

test('findMatches returns empty for no matches', () => {
  const grid = [
    ['兵', '弓', '车'],
    ['枪', '骑', '兵'],
    ['弓', '车', '枪'],
  ];
  assert.deepStrictEqual(match3.findMatches(grid), []);
});

test('findMatches handles run of 4', () => {
  const grid = [['兵', '兵', '兵', '兵']];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].cells.length, 4);
});

test('applyMatch nulls matched cells', () => {
  const grid = [['兵', '兵', '兵'], ['弓', '车', '枪']];
  const groups = match3.findMatches(grid);
  const out = match3.applyMatch(grid, groups[0]);
  assert.strictEqual(out[0][0], null);
  assert.strictEqual(out[0][1], null);
  assert.strictEqual(out[0][2], null);
  assert.strictEqual(out[1][0], '弓');
});

test('scoreMatch scales with size and cascade level', () => {
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3] }, 0), 30);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3, 4] }, 0), 60);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3, 4, 5] }, 0), 100);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3] }, 1), 45);
});

test('hasValidMove true when a swap creates a match', () => {
  // 交换 (0,1)弓 与 (1,1)兵 → 第0行 兵兵兵 成三连
  const grid = [
    ['兵', '弓', '兵'],
    ['车', '兵', '骑'],
  ];
  assert.strictEqual(match3.hasValidMove(grid), true);
});

test('hasValidMove false for dead board', () => {
  const grid = [
    ['兵', '弓', '车'],
    ['枪', '骑', '兵'],
    ['弓', '车', '枪'],
  ];
  assert.strictEqual(match3.hasValidMove(grid), false);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/match3.test.js`
Expected: FAIL（函数都是空实现）。

- [ ] **Step 3: 实现 match3.js**

`js/match3.js`（整体替换）:
```js
const config = require('./config');

// 找出所有横/竖 3 连及以上分组
function findMatches(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const groups = [];
  // 横向
  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      if (c < cols && grid[r][c] !== null && grid[r][c] === grid[r][start]) continue;
      if (c - start >= 3 && grid[r][start] !== null) {
        const cells = [];
        for (let k = start; k < c; k++) cells.push({ r, c: k });
        groups.push({ cells, char: grid[r][start], kind: 'row' });
      }
      start = c;
    }
  }
  // 纵向
  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      if (r < rows && grid[r][c] !== null && grid[r][c] === grid[start][c]) continue;
      if (r - start >= 3 && grid[start][c] !== null) {
        const cells = [];
        for (let k = start; k < r; k++) cells.push({ r: k, c });
        groups.push({ cells, char: grid[start][c], kind: 'col' });
      }
      start = r;
    }
  }
  return groups;
}

// 将分组内格子置空，返回新棋盘
function applyMatch(grid, group) {
  const out = grid.map(row => row.slice());
  for (const cell of group.cells) out[cell.r][cell.c] = null;
  return out;
}

// 计分：3/4/5 连基础分 × 连锁倍率
function scoreMatch(group, cascadeLevel = 0) {
  const n = group.cells.length;
  const base = n >= 5 ? config.SCORE_MATCH5 : n === 4 ? config.SCORE_MATCH4 : config.SCORE_MATCH3;
  return Math.round(base * Math.pow(config.CASCADE_MULT, cascadeLevel));
}

// 是否存在一次可交换能形成三连
function hasValidMove(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && swapCreatesMatch(grid, r, c, r, c + 1)) return true;
      if (r + 1 < rows && swapCreatesMatch(grid, r, c, r + 1, c)) return true;
    }
  }
  return false;
}

function swapCreatesMatch(grid, r1, c1, r2, c2) {
  const g = grid.map(row => row.slice());
  [g[r1][c1], g[r2][c2]] = [g[r2][c2], g[r1][c1]];
  return cellInMatch(g, r1, c1) || cellInMatch(g, r2, c2);
}

function cellInMatch(grid, r, c) {
  const ch = grid[r][c];
  if (ch === null) return false;
  const rows = grid.length;
  const cols = grid[0].length;
  let n = 1;
  for (let cc = c - 1; cc >= 0 && grid[r][cc] === ch; cc--) n++;
  for (let cc = c + 1; cc < cols && grid[r][cc] === ch; cc++) n++;
  if (n >= 3) return true;
  n = 1;
  for (let rr = r - 1; rr >= 0 && grid[rr][c] === ch; rr--) n++;
  for (let rr = r + 1; rr < rows && grid[rr][c] === ch; rr++) n++;
  return n >= 3;
}

module.exports = { findMatches, applyMatch, scoreMatch, hasValidMove };
```

- [ ] **Step 4: 按 Step 1 备注修正第 6 个测试的实际断言后运行**

Run: `node --test test/match3.test.js`
Expected: PASS 全部测试。

- [ ] **Step 5: Commit**

```bash
git add js/match3.js test/match3.test.js
git commit -m "feat: match-3 detection and scoring"
```

---

### Task 4: board.js — 生成/下落/补字/连锁

**Files:**
- Create: `test/board.test.js`
- Create: `js/board.js`

- [ ] **Step 1: 写失败测试**

`test/board.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const board = require('../js/board');

const pool = { 兵: 1, 弓: 1, 车: 1, 枪: 1, 骑: 1 };

test('createBoard has no initial matches and valid move', () => {
  const match3 = require('../js/match3');
  for (let i = 0; i < 20; i++) {
    const grid = board.createBoard(8, 8, pool);
    assert.strictEqual(grid.length, 8);
    assert.strictEqual(grid[0].length, 8);
    assert.deepStrictEqual(match3.findMatches(grid), []);
    assert.ok(match3.hasValidMove(grid));
  }
});

test('isAdjacent only for orthogonal neighbors', () => {
  assert.ok(board.isAdjacent({ r: 0, c: 0 }, { r: 0, c: 1 }));
  assert.ok(board.isAdjacent({ r: 2, c: 3 }, { r: 1, c: 3 }));
  assert.ok(!board.isAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 }));
  assert.ok(!board.isAdjacent({ r: 0, c: 0 }, { r: 0, c: 0 }));
});

test('applyGravity drops tiles down and nulls top', () => {
  const grid = [
    ['兵', null],
    [null, '弓'],
    ['车', null],
  ];
  const out = board.applyGravity(grid);
  assert.deepStrictEqual(out, [
    [null, null],
    ['兵', null],
    ['车', '弓'],
  ]);
});

test('refill replaces nulls with pool chars', () => {
  const grid = [
    [null, '弓'],
    ['车', null],
  ];
  const out = board.refill(grid, pool);
  assert.ok(pool[out[0][0]] !== undefined);
  assert.strictEqual(out[0][1], '弓');
  assert.strictEqual(out[1][0], '车');
  assert.ok(pool[out[1][1]] !== undefined);
});

test('resolveCascade clears matches and scores cascade', () => {
  const grid = [
    ['兵', '兵', '兵', '弓', '车', '枪', '骑', '兵'],
    ['弓', '车', '枪', '骑', '兵', '弓', '车', '枪'],
  ];
  const { grid: out, score, cascade } = board.resolveCascade(grid, pool);
  assert.ok(score >= 30);
  assert.ok(cascade >= 1);
  assert.ok(match3FindMatches(out).length === 0);
});

function match3FindMatches(grid) {
  return require('../js/match3').findMatches(grid);
}
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/board.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 board.js**

`js/board.js`:
```js
const match3 = require('./match3');

function copy(grid) {
  return grid.map(row => row.slice());
}

function get(grid, r, c) {
  return grid[r][c];
}

function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

// 加权随机抽一个字符
function weightedPick(pool) {
  const entries = Object.entries(pool);
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [ch, w] of entries) {
    r -= w;
    if (r <= 0) return ch;
  }
  return entries[entries.length - 1][0];
}

// 生成无初始三连、且有可行步的棋盘
function createBoard(rows, cols, pool) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let ch;
      do {
        ch = weightedPick(pool);
      } while (
        (c >= 2 && row[c - 1] === ch && row[c - 2] === ch) ||
        (r >= 2 && grid[r - 1][c] === ch && grid[r - 2][c] === ch)
      );
      row.push(ch);
    }
    grid.push(row);
  }
  if (!match3.hasValidMove(grid)) return createBoard(rows, cols, pool);
  return grid;
}

// 字块下落：非空下沉，顶部补 null
function applyGravity(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    let wr = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c] !== null) {
        out[wr][c] = grid[r][c];
        wr--;
      }
    }
  }
  return out;
}

// 从字池随机补满 null 格
function refill(grid, pool) {
  const out = copy(grid);
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out[0].length; c++) {
      if (out[r][c] === null) out[r][c] = weightedPick(pool);
    }
  }
  return out;
}

// 连锁结算：消→落→补→再消，返回最终盘面/总分/连锁数/各轮消除格
function resolveCascade(grid, pool) {
  let g = grid;
  let score = 0;
  let cascade = 0;
  const cleared = [];
  while (cascade < 50) {
    const groups = match3.findMatches(g);
    if (!groups.length) break;
    const roundCells = [];
    for (const grp of groups) {
      g = match3.applyMatch(g, grp);
      score += match3.scoreMatch(grp, cascade);
      for (const cell of grp.cells) roundCells.push(cell);
    }
    cleared.push(roundCells);
    g = applyGravity(g);
    g = refill(g, pool);
    cascade++;
  }
  return { grid: g, score, cascade, cleared };
}

module.exports = { copy, get, isAdjacent, weightedPick, createBoard, applyGravity, refill, resolveCascade };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/board.test.js`
Expected: PASS 全部测试。

- [ ] **Step 5: Commit**

```bash
git add js/board.js test/board.test.js
git commit -m "feat: board generation, gravity, refill, cascade"
```

---

### Task 5: 互换操作集成

**Files:**
- Modify: `js/board.js`（新增 `swapTiles`）
- Modify: `test/board.test.js`

- [ ] **Step 1: 写失败测试（追加到 board.test.js）**

```js
test('swapTiles returns new grid with swapped cells', () => {
  const grid = [['兵', '弓'], ['车', '枪']];
  const out = board.swapTiles(grid, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.strictEqual(out[0][0], '弓');
  assert.strictEqual(out[0][1], '兵');
  assert.strictEqual(grid[0][0], '兵'); // 原棋盘不被修改
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/board.test.js`
Expected: FAIL（`swapTiles is not a function`）。

- [ ] **Step 3: 在 board.js 的 exports 前添加实现**

```js
// 互换两个格子，返回新棋盘（不修改原棋盘）
function swapTiles(grid, a, b) {
  const out = copy(grid);
  [out[a.r][a.c], out[b.r][b.c]] = [out[b.r][b.c], out[a.r][a.c]];
  return out;
}
```

并把 `swapTiles` 加入 `module.exports`：
```js
module.exports = { copy, get, isAdjacent, weightedPick, createBoard, applyGravity, refill, resolveCascade, swapTiles };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/board.js test/board.test.js
git commit -m "feat: tile swap"
```

---

## Phase 2：故事短语与技能

### Task 6: story.js — 故事数据/划线判定/字池

**Files:**
- Create: `test/story.test.js`
- Create: `js/story.js`

- [ ] **Step 1: 写失败测试**

`test/story.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const story = require('../js/story');

test('story data has 12 stories with unlock order', () => {
  const ids = Object.keys(story.STORIES);
  assert.strictEqual(ids.length, 12);
  assert.deepStrictEqual(story.STORIES.taoyuan.chars, ['桃', '园', '三', '结', '义']);
});

test('checkPhrasePath accepts adjacent correct-order path', () => {
  // 修正：原棋盘 结 在(1,0)不可达，改为 (1,2)=结、(1,1)=义，路径 (0,0)(0,1)(0,2)(1,2)(1,1) = 桃园三结义
  const grid = [
    ['桃', '园', '三'],
    ['兵', '义', '结'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 1 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.storyId, 'taoyuan');
});

test('checkPhrasePath rejects non-adjacent path', () => {
  const grid = [
    ['桃', '园', '三'],
    ['结', '义', '兵'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }];
  assert.strictEqual(story.checkPhrasePath(grid, path), null);
});

test('pickStoriesForBoard includes required story', () => {
  const unlocked = ['taoyuan', 'wenjiu', 'sanying'];
  for (let i = 0; i < 30; i++) {
    const picked = story.pickStoriesForBoard(unlocked, 'taoyuan');
    assert.ok(picked.includes('taoyuan'));
    assert.ok(picked.length >= 2 && picked.length <= 3);
  }
});

test('buildPool weights base high and story low', () => {
  const pool = story.buildPool(['taoyuan'], 1);
  assert.strictEqual(pool['兵'], 100);
  assert.strictEqual(pool['桃'], 15);
  assert.strictEqual(pool['弓'], 100);
});

test('buildPool respects storyRateMult', () => {
  const pool = story.buildPool(['taoyuan'], 2);
  assert.strictEqual(pool['桃'], 30);
});

test('isStoryChar works', () => {
  assert.ok(story.isStoryChar('桃'));
  assert.ok(!story.isStoryChar('兵'));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/story.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 story.js**

`js/story.js`:
```js
const config = require('./config');
const board = require('./board');

// 12 个故事：id / 名称 / 字块 / 剧情一句话 / 初始技能 / 觉醒技能
const STORIES = {
  taoyuan: { id: 'taoyuan', name: '桃园三结义', chars: ['桃', '园', '三', '结', '义'], intro: '刘备、关羽、张飞桃园结义', initialSkill: 'blessing', awakenedSkill: 'brotherhood' },
  wenjiu: { id: 'wenjiu', name: '温酒斩华雄', chars: ['温', '酒', '斩', '华', '雄'], intro: '关羽温酒斩华雄', initialSkill: 'rowClear', awakenedSkill: 'crossClear' },
  sanying: { id: 'sanying', name: '三英战吕布', chars: ['三', '英', '战', '吕', '布'], intro: '虎牢关三英合力', initialSkill: 'combo3', awakenedSkill: 'combo6' },
  zhujiu: { id: 'zhujiu', name: '煮酒论英雄', chars: ['煮', '酒', '论', '英', '雄'], intro: '青梅煮酒论英雄', initialSkill: 'addTime10', awakenedSkill: 'addTime20' },
  qianli: { id: 'qianli', name: '千里走单骑', chars: ['千', '里', '走', '单', '骑'], intro: '关羽千里寻兄', initialSkill: 'shuffle', awakenedSkill: 'shuffleGenerate' },
  guandu: { id: 'guandu', name: '官渡之战', chars: ['官', '渡', '之', '战'], intro: '火烧乌巢定官渡', initialSkill: 'clearColor', awakenedSkill: 'clearTwoColors' },
  sangu: { id: 'sangu', name: '三顾茅庐', chars: ['三', '顾', '茅', '庐'], intro: '三顾茅庐请卧龙', initialSkill: 'generatePhrase', awakenedSkill: 'generateAndTrigger' },
  caochuan: { id: 'caochuan', name: '草船借箭', chars: ['草', '船', '借', '箭'], intro: '草船借箭十万支', initialSkill: 'boostStoryRate', awakenedSkill: 'clearAllStory' },
  chibi: { id: 'chibi', name: '赤壁之战', chars: ['赤', '壁', '之', '战'], intro: '火烧赤壁定三分', initialSkill: 'clear30', awakenedSkill: 'clearAll' },
  huarong: { id: 'huarong', name: '华容道', chars: ['华', '容', '道'], intro: '关云长义释曹操', initialSkill: 'pause5', awakenedSkill: 'pause8' },
  qinqin: { id: 'qinqin', name: '七擒孟获', chars: ['七', '擒', '孟', '获'], intro: '七擒七纵服南中', initialSkill: 'combo7', awakenedSkill: 'combo10' },
  kongcheng: { id: 'kongcheng', name: '空城计', chars: ['空', '城', '计'], intro: '空城抚琴退司马', initialSkill: 'lowTimeDouble', awakenedSkill: 'clearAll' },
};

function getStory(id) {
  return STORIES[id] || null;
}

function isStoryChar(ch) {
  for (const s of Object.values(STORIES)) {
    if (s.chars.includes(ch)) return true;
  }
  return false;
}

// 校验一笔路径：相邻且顺序拼出某个故事短语
function checkPhrasePath(grid, path) {
  if (!path || path.length < 2) return null;
  for (let i = 1; i < path.length; i++) {
    if (!board.isAdjacent(path[i - 1], path[i])) return null;
  }
  const word = path.map(p => grid[p.r][p.c]).join('');
  for (const s of Object.values(STORIES)) {
    if (word === s.chars.join('')) {
      return { storyId: s.id, chars: s.chars.slice(), cells: path.slice() };
    }
  }
  return null;
}

// 为本盘挑选上场的故事（保证故事关当前故事在场）
function pickStoriesForBoard(unlockedIds, requiredStoryId) {
  const picked = requiredStoryId ? [requiredStoryId] : [];
  const rest = unlockedIds.filter(id => id !== requiredStoryId);
  // 洗牌
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const max = config.STORY_PER_BOARD_MAX;
  const min = Math.min(config.STORY_PER_BOARD_MIN, max);
  const target = min + Math.floor(Math.random() * (max - min + 1));
  while (picked.length < target && rest.length) picked.push(rest.pop());
  return picked;
}

// 构造本盘字池：基础字高权重 + 上场故事字低权重
function buildPool(boardStories, storyRateMult = 1) {
  const pool = {};
  for (const ch of config.BASE_TILES) pool[ch] = config.BASE_WEIGHT;
  for (const id of boardStories) {
    const s = STORIES[id];
    if (!s) continue;
    for (const ch of s.chars) {
      pool[ch] = Math.round(config.STORY_WEIGHT * storyRateMult);
    }
  }
  return pool;
}

module.exports = { STORIES, getStory, isStoryChar, checkPhrasePath, pickStoriesForBoard, buildPool };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/story.test.js`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/story.js test/story.test.js
git commit -m "feat: story data, phrase path check, tile pool"
```

---

### Task 7: skills.js — 技能定义与执行

**Files:**
- Create: `test/skills.test.js`
- Create: `js/skills.js`

- [ ] **Step 1: 写失败测试**

`test/skills.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const skills = require('../js/skills');
const story = require('../js/story');
const board = require('../js/board');

const POOL = story.buildPool(['taoyuan'], 1);

function makeGrid() {
  return board.createBoard(4, 4, POOL);
}

test('blessing returns score multiplier buff', () => {
  const res = skills.activate('blessing', { grid: makeGrid(), pool: POOL, origin: { r: 0, c: 0 } });
  assert.strictEqual(res.buffs.length, 1);
  assert.strictEqual(res.buffs[0].type, 'scoreMult');
  assert.strictEqual(res.buffs[0].seconds, 10);
});

test('rowClear clears an entire row', () => {
  const grid = makeGrid();
  const res = skills.activate('rowClear', { grid, pool: POOL, origin: { r: 3, c: 0 } });
  assert.strictEqual(res.cleared.length, 4);
  assert.ok(res.cleared.every(cell => cell.r === 3));
});

test('clearColor clears all of one base char', () => {
  const grid = makeGrid();
  const res = skills.activate('clearColor', { grid, pool: POOL, origin: { r: 0, c: 0 } });
  const clearedChars = res.cleared.map(c => grid[c.r][c.c]);
  const target = new Set(clearedChars);
  assert.strictEqual(target.size, 1); // 全部同一字
  assert.ok(configBASE().includes([...target][0]));
});

test('shuffle preserves tile multiset', () => {
  const grid = makeGrid();
  const before = countChars(grid);
  const res = skills.activate('shuffle', { grid, pool: POOL, origin: { r: 0, c: 0 } });
  assert.deepStrictEqual(countChars(res.grid), before);
});

test('addTime10 adds time delta', () => {
  const res = skills.activate('addTime10', { grid: makeGrid(), pool: POOL, origin: { r: 0, c: 0 } });
  assert.strictEqual(res.timeDelta, 10);
});

test('generatePhrase places story chars contiguously', () => {
  const grid = makeGrid();
  const res = skills.activate('generatePhrase', { grid, pool: POOL, origin: { r: 0, c: 0 }, storyId: 'sangu' });
  const word = res.grid[0].slice(0, 4).join('');
  assert.strictEqual(word, '三顾茅庐');
});

function countChars(grid) {
  const map = {};
  for (const row of grid) for (const ch of row) map[ch] = (map[ch] || 0) + 1;
  return map;
}
function configBASE() {
  return require('../js/config').BASE_TILES;
}
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/skills.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 skills.js**

`js/skills.js`:
```js
const board = require('./board');
const story = require('./story');
const config = require('./config');

// 随机清除 count 个 1×3 / 3×1 块
function clearRandomBlocks(grid, count) {
  const rows = grid.length;
  const cols = grid[0].length;
  const g = grid.map(row => row.slice());
  const cleared = [];
  const seen = new Set();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 2000) {
    const horizontal = Math.random() < 0.5;
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    let cells;
    if (horizontal) {
      if (c + 2 >= cols) continue;
      cells = [{ r, c }, { r, c: c + 1 }, { r, c: c + 2 }];
    } else {
      if (r + 2 >= rows) continue;
      cells = [{ r, c }, { r: r + 1, c }, { r: r + 2, c }];
    }
    const key = cells.map(p => p.r + ',' + p.c).join(';');
    if (seen.has(key)) continue;
    seen.add(key);
    for (const p of cells) g[p.r][p.c] = null;
    cleared.push(...cells);
    placed++;
  }
  return { grid: g, cleared };
}

function shuffleGrid(grid) {
  const g = grid.map(row => row.slice());
  const cells = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) cells.push({ r, c });
  const chars = cells.map(p => g[p.r][p.c]).filter(ch => ch !== null);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  let k = 0;
  for (const p of cells) {
    if (g[p.r][p.c] !== null) g[p.r][p.c] = chars[k++];
  }
  return g;
}

// 生成短语：把故事字按顺序放到原点的同一行（从 c=0 起），覆盖原字
function placePhrase(grid, chars, origin) {
  const g = grid.map(row => row.slice());
  const row = Math.min(origin.r, g.length - 1);
  for (let i = 0; i < chars.length && i < g[0].length; i++) {
    g[row][i] = chars[i];
  }
  return g;
}

function nullAll(grid) {
  const g = grid.map(row => row.slice());
  const cleared = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) { cleared.push({ r, c }); g[r][c] = null; }
  return { grid: g, cleared };
}

function nullColor(grid, targetChar) {
  const g = grid.map(row => row.slice());
  const cleared = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
    if (g[r][c] === targetChar) { cleared.push({ r, c }); g[r][c] = null; }
  }
  return { grid: g, cleared };
}

function nullRandomRatio(grid, ratio) {
  const g = grid.map(row => row.slice());
  const cleared = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
    if (Math.random() < ratio) { cleared.push({ r, c }); g[r][c] = null; }
  }
  return { grid: g, cleared };
}

function pickBaseChar() {
  return config.BASE_TILES[Math.floor(Math.random() * config.BASE_TILES.length)];
}

const SKILLS = {
  blessing: {
    name: '结义祝福',
    activate(state) {
      return { grid: state.grid, score: 0, cleared: [], buffs: [{ type: 'scoreMult', value: 2, seconds: 10 }], timeDelta: 0, notes: '10秒内消除×2' };
    },
  },
  brotherhood: {
    name: '兄弟同心',
    activate(state) {
      return { grid: state.grid, score: 0, cleared: [], buffs: [{ type: 'scoreMult', value: 3, seconds: 15 }], timeDelta: 0, notes: '15秒内×3' };
    },
  },
  rowClear: {
    name: '一刀两断',
    activate(state) {
      const grid = state.grid.map(row => row.slice());
      const cleared = [];
      const r = Math.min(state.origin.r, grid.length - 1);
      for (let c = 0; c < grid[0].length; c++) { cleared.push({ r, c }); grid[r][c] = null; }
      return { grid, score: 0, cleared, timeDelta: 0, notes: '清除一整行' };
    },
  },
  crossClear: {
    name: '温酒未凉',
    activate(state) {
      const grid = state.grid.map(row => row.slice());
      const cleared = [];
      const r = Math.min(state.origin.r, grid.length - 1);
      const c = Math.min(state.origin.c, grid[0].length - 1);
      for (let cc = 0; cc < grid[0].length; cc++) { cleared.push({ r, c: cc }); grid[r][cc] = null; }
      for (let rr = 0; rr < grid.length; rr++) { cleared.push({ r: rr, c }); grid[rr][c] = null; }
      return { grid, score: 0, cleared, timeDelta: 0, notes: '清除整行+整列' };
    },
  },
  combo3: { name: '三英合力', activate: s => ({ ...clearRandomBlocks(s.grid, 3), score: 0, timeDelta: 0, notes: '随机3处消除' }) },
  combo6: { name: '虎牢关决战', activate: s => ({ ...clearRandomBlocks(s.grid, 6), score: 0, timeDelta: 0, notes: '随机6处消除' }) },
  combo7: { name: '七擒七纵', activate: s => ({ ...clearRandomBlocks(s.grid, 7), score: 0, timeDelta: 0, notes: '随机7处消除' }) },
  combo10: { name: '南中归心', activate: s => ({ ...clearRandomBlocks(s.grid, 10), score: 0, timeDelta: 0, notes: '随机10处消除' }) },
  addTime10: { name: '青梅煮酒', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 10, notes: '时间+10秒' }) },
  addTime20: { name: '论尽天下', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 20, notes: '时间+20秒' }) },
  shuffle: { name: '单骑奔袭', activate: s => ({ grid: shuffleGrid(s.grid), score: 0, cleared: [], timeDelta: 0, notes: '洗牌重排' }) },
  shuffleGenerate: {
    name: '过五关斩六将',
    activate(s) {
      const shuffled = shuffleGrid(s.grid);
      const grid = placePhrase(shuffled, story.STORIES.qianli.chars, s.origin);
      return { grid, score: 0, cleared: [], timeDelta: 0, notes: '洗牌+生成千里走单骑' };
    },
  },
  clearColor: {
    name: '火烧乌巢',
    activate(s) {
      const target = pickBaseChar();
      const res = nullColor(s.grid, target);
      return { ...res, score: 0, timeDelta: 0, notes: '清除所有「' + target + '」' };
    },
  },
  clearTwoColors: {
    name: '官渡决胜',
    activate(s) {
      let g = s.grid;
      let cleared = [];
      const seen = new Set();
      for (let i = 0; i < 2; i++) {
        let target = pickBaseChar();
        while (seen.has(target)) target = pickBaseChar();
        seen.add(target);
        const res = nullColor(g, target);
        g = res.grid;
        cleared = cleared.concat(res.cleared);
      }
      return { grid: g, score: 0, cleared, timeDelta: 0, notes: '清除所有两种基础字块' };
    },
  },
  generatePhrase: {
    name: '三顾之恩',
    activate(s) {
      const grid = placePhrase(s.grid, story.STORIES.sangu.chars, s.origin);
      return { grid, score: 0, cleared: [], timeDelta: 0, notes: '生成三顾茅庐字块' };
    },
  },
  generateAndTrigger: {
    name: '卧龙出山',
    activate(s) {
      const grid = placePhrase(s.grid, story.STORIES.sangu.chars, s.origin);
      const cells = [];
      for (let c = 0; c < story.STORIES.sangu.chars.length && c < grid[0].length; c++) cells.push({ r: Math.min(s.origin.r, grid.length - 1), c });
      return { grid, score: config.PHRASE_SCORE, cleared: cells, timeDelta: 0, notes: '生成并触发三顾茅庐' };
    },
  },
  boostStoryRate: { name: '借箭', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 0, storyRateMult: 2, notes: '故事字出现率翻倍' }) },
  clearAllStory: {
    name: '万箭齐发',
    activate(s) {
      const g = s.grid.map(row => row.slice());
      const cleared = [];
      for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
        if (story.isStoryChar(g[r][c])) { cleared.push({ r, c }); g[r][c] = null; }
      }
      return { grid: g, score: 0, cleared, timeDelta: 0, notes: '清除所有故事字块' };
    },
  },
  clear30: { name: '火烧赤壁', activate: s => ({ ...nullRandomRatio(s.grid, 0.3), score: 0, timeDelta: 0, notes: '清除盘面30%' }) },
  clearAll: { name: '东风乍起', activate: s => ({ ...nullAll(s.grid), score: 0, timeDelta: 0, notes: '全屏清除' }) },
  pause5: { name: '华容义释', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 0, timeFreeze: 5, notes: '时间暂停5秒' }) },
  pause8: { name: '义释千古', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 0, timeFreeze: 8, buffs: [{ type: 'scoreMult', value: 2, seconds: 8 }], notes: '暂停8秒+得分×2' }) },
  lowTimeDouble: { name: '空城退敌', activate: s => ({ grid: s.grid, score: 0, cleared: [], timeDelta: 0, buffs: [{ type: 'lowTimeDouble', value: 2, seconds: 0 }], notes: '剩余<10秒时消除×2' }) },
};

function activate(skillId, state) {
  const skill = SKILLS[skillId];
  if (!skill) throw new Error('unknown skill: ' + skillId);
  return skill.activate(state);
}

function getSkillId(storyId, awakened) {
  const s = story.getStory(storyId);
  if (!s) return null;
  return awakened ? s.awakenedSkill : s.initialSkill;
}

module.exports = { SKILLS, activate, getSkillId };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/skills.test.js`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/skills.js test/skills.test.js
git commit -m "feat: skill definitions and execution"
```

---

## Phase 3：关卡与精英

### Task 8: levels.js — 关卡配置/解锁表/精英

**Files:**
- Create: `test/levels.test.js`
- Create: `js/levels.js`

- [ ] **Step 1: 写失败测试**

`test/levels.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const levels = require('../js/levels');

test('storyLevelFor maps milestones', () => {
  assert.strictEqual(levels.storyLevelFor(1).storyId, 'taoyuan');
  assert.strictEqual(levels.storyLevelFor(5).storyId, 'wenjiu');
  assert.strictEqual(levels.storyLevelFor(10).storyId, 'sanying');
  assert.strictEqual(levels.storyLevelFor(100).storyId, 'kongcheng');
  assert.strictEqual(levels.storyLevelFor(6), null);
});

test('getLevelConfig normal scales target and time', () => {
  const c1 = levels.getLevelConfig(1, 'normal');
  assert.strictEqual(c1.time, 60);
  assert.strictEqual(c1.targetScore, 800);
  assert.strictEqual(c1.storyId, 'taoyuan');
  const c3 = levels.getLevelConfig(3, 'normal');
  assert.strictEqual(c3.targetScore, 1100); // 800 + (3-1)*150
});

test('getLevelConfig elite shorter time and higher target', () => {
  const c1 = levels.getLevelConfig(1, 'elite');
  assert.strictEqual(c1.time, 40);
  assert.strictEqual(c1.targetScore, 1200); // 800 * 1.5
});

test('getUnlockPreview shows next milestone after current level', () => {
  assert.deepStrictEqual(levels.getUnlockPreview(3), { level: 5, storyId: 'wenjiu' });
  assert.deepStrictEqual(levels.getUnlockPreview(40), { level: 50, storyId: 'sangu' });
  assert.strictEqual(levels.getUnlockPreview(100), null);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/levels.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 levels.js**

`js/levels.js`:
```js
const config = require('./config');
const { STORIES } = require('./story');

// 阶梯解锁表（三国时间线）
const UNLOCK = [
  { level: 1, storyId: 'taoyuan' },
  { level: 5, storyId: 'wenjiu' },
  { level: 10, storyId: 'sanying' },
  { level: 20, storyId: 'zhujiu' },
  { level: 30, storyId: 'qianli' },
  { level: 40, storyId: 'guandu' },
  { level: 50, storyId: 'sangu' },
  { level: 60, storyId: 'caochuan' },
  { level: 70, storyId: 'chibi' },
  { level: 80, storyId: 'huarong' },
  { level: 90, storyId: 'qinqin' },
  { level: 100, storyId: 'kongcheng' },
];

function storyLevelFor(level) {
  return UNLOCK.find(u => u.level === level) || null;
}

function getLevelConfig(level, mode = 'normal') {
  const storyId = storyLevelFor(level) ? storyLevelFor(level).storyId : null;
  const target = config.NORMAL_SCORE_BASE + (level - 1) * config.NORMAL_SCORE_STEP;
  if (mode === 'elite') {
    return {
      level, mode: 'elite', storyId,
      time: config.ELITE_TIME,
      targetScore: Math.round(target * config.ELITE_SCORE_MULT),
    };
  }
  return { level, mode: 'normal', storyId, time: config.NORMAL_TIME, targetScore: target };
}

// 右上角预告：下一个要解锁的故事
function getUnlockPreview(level) {
  for (const u of UNLOCK) {
    if (u.level > level) return { level: u.level, storyId: u.storyId };
  }
  return null;
}

module.exports = { UNLOCK, storyLevelFor, getLevelConfig, getUnlockPreview, STORIES };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/levels.test.js`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/levels.js test/levels.test.js
git commit -m "feat: level config and unlock ladder"
```

---

## Phase 4：道具

### Task 9: props.js — 道具执行

**Files:**
- Create: `test/props.test.js`
- Create: `js/props.js`

- [ ] **Step 1: 写失败测试**

`test/props.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');
const props = require('../js/props');
const board = require('../js/board');
const story = require('../js/story');

const POOL = story.buildPool(['taoyuan'], 1);

test('hammer nulls target cell', () => {
  const grid = board.createBoard(4, 4, POOL);
  const res = props.use('hammer', { grid, pool: POOL }, { r: 0, c: 0 });
  assert.strictEqual(res.grid[0][0], null);
  assert.deepStrictEqual(res.cleared, [{ r: 0, c: 0 }]);
});

test('swap prop requires adjacent and returns swapped grid', () => {
  const grid = [
    ['兵', '弓'],
    ['车', '枪'],
  ];
  const res = props.use('swap', { grid, pool: POOL }, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.strictEqual(res.grid[0][0], '弓');
  assert.strictEqual(res.grid[0][1], '兵');
  assert.strictEqual(props.use('swap', { grid, pool: POOL }, { r: 0, c: 0 }, { r: 1, c: 1 }), null);
});

test('shuffle prop preserves tile multiset', () => {
  const grid = board.createBoard(4, 4, POOL);
  const before = count(grid);
  const res = props.use('shuffle', { grid, pool: POOL });
  assert.deepStrictEqual(count(res.grid), before);
});

test('time prop adds configured seconds', () => {
  const grid = board.createBoard(4, 4, POOL);
  const res = props.use('time', { grid, pool: POOL });
  assert.strictEqual(res.timeDelta, 10);
});

function count(grid) {
  const map = {};
  for (const row of grid) for (const ch of row) map[ch] = (map[ch] || 0) + 1;
  return map;
}
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/props.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 props.js**

`js/props.js`:
```js
const board = require('./board');
const config = require('./config');

function shuffleGrid(grid) {
  const g = grid.map(row => row.slice());
  const cells = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) cells.push({ r, c });
  const chars = cells.map(p => g[p.r][p.c]).filter(ch => ch !== null);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  let k = 0;
  for (const p of cells) {
    if (g[p.r][p.c] !== null) g[p.r][p.c] = chars[k++];
  }
  return g;
}

// 道具执行。state: { grid, pool }；返回 { grid, cleared, timeDelta } 或 null（参数无效）
function use(propId, state, ...args) {
  switch (propId) {
    case 'hammer': {
      const cell = args[0];
      if (!cell || cell.r == null || cell.c == null) return null;
      const grid = state.grid.map(row => row.slice());
      grid[cell.r][cell.c] = null;
      return { grid, cleared: [cell], timeDelta: 0 };
    }
    case 'swap': {
      const a = args[0], b = args[1];
      if (!a || !b || !board.isAdjacent(a, b)) return null;
      const grid = state.grid.map(row => row.slice());
      [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
      return { grid, cleared: [], timeDelta: 0 };
    }
    case 'shuffle':
      return { grid: shuffleGrid(state.grid), cleared: [], timeDelta: 0 };
    case 'time':
      return { grid: state.grid, cleared: [], timeDelta: config.PROP_TIME_SECONDS };
    default:
      return null;
  }
}

module.exports = { use };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/props.test.js`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/props.js test/props.test.js
git commit -m "feat: prop execution"
```

---

## Phase 5：微信平台层

> 本阶段代码依赖 `wx.*` API，无法在纯 Node 中自动化测试。执行方式：在微信开发者工具中预览，按 Task 14 的手动清单验证。

### Task 10: storage.js — 存档

**Files:**
- Create: `test/storage.test.js`（注入 mock `wx` 的 Node 测试）
- Create: `js/storage.js`

- [ ] **Step 1: 写失败测试**

`test/storage.test.js`:
```js
const { test } = require('node:test');
const assert = require('node:assert');

const store = {};
global.wx = {
  getStorageSync: k => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: k => { delete store[k]; },
};

const storage = require('../js/storage');

test('load returns defaults on empty storage', () => {
  const s = storage.load();
  assert.strictEqual(s.currentLevel, 1);
  assert.strictEqual(s.stamina, 30);
  assert.deepStrictEqual(s.props, { hammer: 0, swap: 0, shuffle: 0, time: 0 });
});

test('save then load round-trips', () => {
  storage.save({ currentLevel: 7, eliteLevel: 2, stamina: 12, staminaTs: 0, unlocked: { taoyuan: { awakened: true } }, props: { hammer: 2, swap: 0, shuffle: 1, time: 0 }, daily: { date: 'x', adsStamina: 1, adsProp: 0, share: 0 }, highScores: {} });
  const s = storage.load();
  assert.strictEqual(s.currentLevel, 7);
  assert.strictEqual(s.props.hammer, 2);
  assert.strictEqual(s.unlocked.taoyuan.awakened, true);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test test/storage.test.js`
Expected: FAIL（找不到模块）。

- [ ] **Step 3: 实现 storage.js**

`js/storage.js`:
```js
const config = require('./config');

const KEY = 'sanguo_match3_save_v1';

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function defaultState() {
  return {
    currentLevel: 1,
    eliteLevel: 1,
    stamina: config.STAMINA_INITIAL,
    staminaTs: Date.now(),
    unlocked: {}, // storyId -> { awakened: boolean }
    props: { hammer: 0, swap: 0, shuffle: 0, time: 0 },
    daily: { date: today(), adsStamina: 0, adsProp: 0, share: 0, continueLevel: 0 },
    highScores: {},
    settings: { sound: true },
  };
}

// 跨天自动重置每日计数
function normalize(state) {
  const def = defaultState();
  const merged = Object.assign(def, state);
  if (merged.daily.date !== today()) {
    merged.daily = { date: today(), adsStamina: 0, adsProp: 0, share: 0, continueLevel: 0 };
  }
  return merged;
}

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw) return defaultState();
    return normalize(raw);
  } catch (e) {
    return defaultState();
  }
}

function save(state) {
  try {
    wx.setStorageSync(KEY, normalize(state));
  } catch (e) {
    // 存储失败不阻塞游戏
  }
}

module.exports = { load, save, defaultState, normalize, today };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test test/storage.test.js`
Expected: PASS 全部。

- [ ] **Step 5: Commit**

```bash
git add js/storage.js test/storage.test.js
git commit -m "feat: local storage save/load"
```

---

### Task 11: ads.js — 激励视频广告

**Files:**
- Create: `js/ads.js`

- [ ] **Step 1: 实现 ads.js**

`js/ads.js`:
```js
const config = require('./config');
const storage = require('./storage');
const story = require('./story');

// 流量主后台申请后填入 adUnitId
const AD_UNITS = {
  stamina: 'AD_UNIT_STAMINA_PLACEHOLDER',
  prop: 'AD_UNIT_PROP_PLACEHOLDER',
  revive: 'AD_UNIT_REVIVE_PLACEHOLDER',
};

const adCache = {};

function getAd(unitId) {
  if (!wx.createRewardedVideoAd) return null;
  if (!adCache[unitId]) {
    adCache[unitId] = wx.createRewardedVideoAd({ adUnitId: unitId });
    adCache[unitId].onError(() => {
      // 加载失败：静默降级，UI 隐藏对应按钮
    });
  }
  return adCache[unitId];
}

// 播放广告，返回 Promise<boolean>：true=完整看完，false=中途退出或不可用
function watch(unitId) {
  const ad = getAd(unitId);
  if (!ad) return Promise.resolve(false);
  return new Promise(resolve => {
    ad.onClose(res => {
      resolve(res && res.isEnded === true);
    });
    ad.show().catch(() => {
      ad.load().then(() => ad.show()).catch(() => resolve(false));
    });
  });
}

// 看广告补体力（每日限次）
function showStaminaAd() {
  const state = storage.load();
  if (state.daily.adsStamina >= config.AD_STAMINA_DAILY_LIMIT) return Promise.resolve({ ok: false, reason: 'limit' });
  return watch(AD_UNITS.stamina).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    state.daily.adsStamina += 1;
    state.stamina = Math.min(config.STAMINA_MAX, state.stamina + config.AD_STAMINA_AMOUNT);
    storage.save(state);
    return { ok: true, stamina: state.stamina };
  });
}

// 看广告得随机道具（每日限次）
function showPropAd() {
  const state = storage.load();
  if (state.daily.adsProp >= config.AD_PROP_DAILY_LIMIT) return Promise.resolve({ ok: false, reason: 'limit' });
  return watch(AD_UNITS.prop).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    state.daily.adsProp += 1;
    const prop = config.PROPS[Math.floor(Math.random() * config.PROPS.length)];
    state.props[prop] += 1;
    storage.save(state);
    return { ok: true, prop };
  });
}

// 失败续命（每关限一次）
function showReviveAd() {
  const state = storage.load();
  if (state.daily.continueLevel >= config.AD_CONTINUE_PER_LEVEL) return Promise.resolve({ ok: false, reason: 'limit' });
  return watch(AD_UNITS.revive).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    state.daily.continueLevel += 1;
    storage.save(state);
    return { ok: true, seconds: config.AD_CONTINUE_SECONDS };
  });
}

// 分享得随机道具（每日首次）
function showShare() {
  const state = storage.load();
  if (state.daily.share >= 1) return { ok: false, reason: 'limit' };
  if (!wx.shareAppMessage) return { ok: false, reason: 'unsupported' };
  wx.shareAppMessage({ title: '来玩三国消消乐！', imageUrl: '' });
  state.daily.share += 1;
  const prop = config.PROPS[Math.floor(Math.random() * config.PROPS.length)];
  state.props[prop] += 1;
  storage.save(state);
  return { ok: true, prop };
}

module.exports = { AD_UNITS, watch, showStaminaAd, showPropAd, showReviveAd, showShare };
```

> 说明：`showStaminaAd`/`showPropAd`/`showReviveAd` 返回 Promise；`showShare` 同步返回。真机验证需在微信公众平台开通流量主并替换 adUnitId。DevTools 中广告为模拟，`isEnded` 行为可能与真机不同。

- [ ] **Step 2: 语法冒烟**

Run: `node -e "const m=require('./js/ads.js'); console.log(Object.keys(m))"`
Expected: 输出 `[ 'AD_UNITS', 'watch', 'showStaminaAd', 'showPropAd', 'showReviveAd', 'showShare' ]`（Node 中 `wx` 未定义但模块不立即报错）。

- [ ] **Step 3: Commit**

```bash
git add js/ads.js
git commit -m "feat: rewarded video ads and share wrapper"
```

---

### Task 12: ui.js — Canvas 渲染

**Files:**
- Create: `js/ui.js`

- [ ] **Step 1: 实现 ui.js**

`js/ui.js`:
```js
const config = require('./config');
const levels = require('./levels');
const story = require('./story');

// 字块配色：基础字按固定色，故事字用金色
const TILE_COLORS = {
  兵: '#8d6e63', 弓: '#558b2f', 车: '#1565c0', 枪: '#6a1b9a', 骑: '#c62828',
};
const STORY_COLOR = '#e65100';

function tileColor(ch) {
  return TILE_COLORS[ch] || STORY_COLOR;
}

// 圆角矩形
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTile(ctx, x, y, size, ch) {
  const color = tileColor(ch);
  ctx.fillStyle = color;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.floor(size * 0.52) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x + size / 2, y + size / 2 + 2);
}

function drawBoard(ctx, grid, ox, oy, size) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] !== null) drawTile(ctx, ox + c * size, oy + r * size, size, grid[r][c]);
    }
  }
}

function drawHUD(ctx, opts, w) {
  // 顶部：关卡/模式/分数/时间
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  const label = (opts.mode === 'elite' ? '精英 ' : '') + '第' + opts.level + '关';
  ctx.fillText(label, 16, 34);
  ctx.textAlign = 'center';
  ctx.fillText('目标 ' + opts.targetScore, w / 2, 34);
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(opts.timeLeft) + 's', w - 16, 34);

  // 右上角解锁预告
  const preview = levels.getUnlockPreview(opts.level);
  if (preview) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e65100';
    ctx.textAlign = 'right';
    ctx.fillText('第' + preview.level + '关解锁「' + story.getStory(preview.storyId).name + '」', w - 16, 58);
  }

  // 分数
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(String(opts.score), w / 2, 70);
}

function drawStamina(ctx, stamina, x, y) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('体力 ' + stamina + '/30', x, y);
}

function drawPropBar(ctx, props, x, y, size) {
  const labels = ['锤', '换', '洗', '时'];
  const ids = ['hammer', 'swap', 'shuffle', 'time'];
  ctx.font = '14px sans-serif';
  for (let i = 0; i < ids.length; i++) {
    ctx.fillStyle = '#3e2723';
    roundRect(ctx, x + i * (size + 8), y, size, size, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + i * (size + 8) + size / 2, y + size / 2 + 4);
    ctx.font = '12px sans-serif';
    ctx.fillText('x' + (props[ids[i]] || 0), x + i * (size + 8) + size / 2, y + size - 4);
    ctx.font = '14px sans-serif';
  }
}

// 大厅
function drawLobby(ctx, w, h, state) {
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('三国消消乐', w / 2, h * 0.22);
  ctx.font = '20px sans-serif';
  ctx.fillText('第' + state.currentLevel + '关', w / 2, h * 0.3);
  ctx.fillStyle = '#ffca28';
  roundRect(ctx, w / 2 - 110, h * 0.4, 220, 70, 12);
  ctx.fill();
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('开始闯关', w / 2, h * 0.4 + 46);
  drawStamina(ctx, state.stamina, 20, h - 30);
}

// 结算
function drawResult(ctx, w, h, res) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(res.win ? '过关！' : '时间到', w / 2, h * 0.35);
  ctx.font = '22px sans-serif';
  ctx.fillText('得分 ' + res.score + ' / 目标 ' + res.target, w / 2, h * 0.42);
  if (!res.win) {
    ctx.font = '18px sans-serif';
    ctx.fillText('看广告续命 15 秒', w / 2, h * 0.5);
  }
  ctx.font = '18px sans-serif';
  ctx.fillText('点任意处返回', w / 2, h * 0.62);
}

module.exports = { drawTile, drawBoard, drawHUD, drawStamina, drawPropBar, drawLobby, drawResult, tileColor, roundRect };
```

- [ ] **Step 2: 语法冒烟**

Run: `node -e "const u=require('./js/ui.js'); console.log(typeof u.drawBoard)"`
Expected: 输出 `function`。

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: canvas rendering"
```

---

### Task 13: main.js — 状态机/游戏循环/装配

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: 实现 main.js**

`js/main.js`:
```js
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
  const storyRateMult = GAME.storyRateMult;
  const pool = story.buildPool(boardStories, storyRateMult);
  GAME.level = level;
  GAME.mode = mode;
  GAME.storyRateMult = 1;
  GAME.grid = board.createBoard(config.BOARD_ROWS, config.BOARD_COLS, pool);
  GAME.pool = pool;
  GAME.boardStories = boardStories;
  GAME.score = 0;
  GAME.target = cfg.targetScore;
  GAME.timeLeft = cfg.time;
  GAME.freeze = 0;
  GAME.buffs = [];
  GAME.pendingPath = [];
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
```

> 注：`performance.now()` 在微信小游戏可用（同浏览器）。道具栏点击（锤/换/洗/时）的交互在 Task 14 手动清单中按需接入 `props.use`，本任务先渲染图标。

- [ ] **Step 2: 语法冒烟**

Run: `node -e "const m=require('./js/main.js'); console.log(typeof m.init)"`
Expected: 输出 `function`。

- [ ] **Step 3: 在微信开发者工具打开项目，确认能进入大厅并点击「开始闯关」进入对局**

Expected: 大厅渲染正常；点开始后棋盘出现、能点击互换消字、划桃园三结义触发技能；体力从 30 减到 25。

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: game loop, state machine, input"
```

---

### Task 14: 收尾与手动测试清单

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README**

`README.md`:
```markdown
# 三国消消乐

基于微信小游戏的文字三消游戏。8×8 互换三消 + 三国故事短语一笔连字。

## 运行
1. 用微信开发者工具导入本目录（AppID 填 `touristappid` 或自己的）。
2. 编译运行。
3. 真机预览需在微信公众平台开通流量主，并把 `js/ads.js` 中的 adUnitId 占位替换为真实广告位。

## 测试
核心逻辑为纯函数，Node 直接跑：
npm test
```

- [ ] **Step 2: 手动测试清单（微信开发者工具/真机逐项勾选）**

- [ ] 大厅渲染正常，右上角/开始按钮显示正确
- [ ] 体力 30 → 点开始扣 5 → 剩 25；体力不足时提示并弹广告入口
- [ ] 进入第 1 关（桃园三结义），限时 60s，目标 800 分
- [ ] 互换相邻字块能消除；3/4/5 连计分正确；消除后下落补字
- [ ] 一笔划过「桃园三结义」→ 整组 500 分 + 结义祝福（10 秒内得分×2，UI 有提示）
- [ ] 通关第 1 关 → 解锁桃园三结义，右上角预告变为「第 5 关解锁：温酒斩华雄」
- [ ] 后续关卡随机出现桃园字块（低概率）
- [ ] 第 5 关解锁温酒斩华雄；划出触发「一刀两断」清行
- [ ] 第 1 关精英模式（需先通普通第 1 关）：时间 40s、目标 1200，通关后觉醒技「兄弟同心」生效
- [ ] 道具：锤/换/洗/时 图标显示库存，使用时库存 -1 且效果正确
- [ ] 看广告补体力、失败续命、看广告得道具均按每日限额生效
- [ ] 每日首次分享得随机道具
- [ ] 存档：杀掉重开进度/体力/道具/解锁保留；跨天每日计数重置
- [ ] 棋盘无解时自动洗牌（长时间无可行步后触发）
- [ ] 不同分辨率机型棋盘/文字不错位

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: readme and manual test checklist"
```

---

## Self-Review Notes（执行前已自查）

- **Spec 覆盖**：8×8 棋盘✓ 基础字✓ 互换三消✓ 随机补字✓ 短语一笔连✓ 12 故事时间线✓ 阶梯解锁✓ 字池低概率✓ 大厅开始按钮✓ 体力(30上限/5消耗/10分钟恢复1点)✓ 右上角预告✓ 限时达标分✓ 技能(初始+觉醒)✓ 精英模式✓ 道具4种✓ 广告(补体力/续命/给道具)✓ 分享给道具✓ 错误处理(无解洗牌/存档损坏/广告失败)✓ 模块化架构✓
- **占位符**：`AD_UNITS` 的 adUnitId 为明确的配置占位（设计即如此，非计划缺失）。
- **类型一致**：技能/道具统一返回 `{grid, cleared, score, buffs, timeDelta, timeFreeze, storyRateMult, notes}`；`resolveCascade` 返回 `{grid, score, cascade, cleared}`；`checkPhrasePath` 返回 `{storyId, chars, cells}`。各处引用一致。
- **已知待真机确认**：`isEnded` 广告回调、`performance.now()`、Toast 文案等需真机微调。
