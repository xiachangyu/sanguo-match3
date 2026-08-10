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
