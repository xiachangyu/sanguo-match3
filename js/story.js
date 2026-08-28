const config = require('./config');
const board = require('./board');
const heroes = require('./heroes');
const { chOf } = require('./tile');

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

// 校验一笔路径：相邻、在一条直线上，且路径字块恰好组成某个故事短语（不要求顺序）
function checkPhrasePath(grid, path) {
  if (!path || path.length < 2) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  for (const p of path) {
    if (p.r < 0 || p.r >= rows || p.c < 0 || p.c >= cols) return null;
  }
  for (let i = 1; i < path.length; i++) {
    if (!board.isAdjacent(path[i - 1], path[i])) return null;
  }
  // 必须连成一条直线（同行或同列）
  const sameRow = path.every(p => p.r === path[0].r);
  const sameCol = path.every(p => p.c === path[0].c);
  if (!sameRow && !sameCol) return null;
  // 不要求顺序：路径字块集合 == 故事字块集合（故事内无重复字，长度相等 + 全部包含即集合相等）
  const chars = path.map(p => chOf(grid[p.r][p.c]));
  const set = new Set(chars);
  for (const s of Object.values(STORIES)) {
    if (s.chars.length === chars.length && s.chars.every(ch => set.has(ch))) {
      return { storyId: s.id, chars: s.chars.slice(), cells: path.slice() };
    }
  }
  // 武将绝技词（须按顺序：正序或逆序，对应直线顺/逆行；故事短语保持集合匹配）
  for (const h of heroes.HERO_LIST) {
    if (heroes.matchHeroOrdered(chars, h)) {
      return { storyId: h.storyId, heroId: h.id, chars: h.chars.slice(), cells: path.slice() };
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

// 构造本盘字池：基础字高权重 + 上场故事字低权重 + 已解锁武将字低权重
function buildPool(boardStories, storyRateMult = 1, heroChars = []) {
  const pool = {};
  for (const ch of config.BASE_TILES) pool[ch] = config.BASE_WEIGHT;
  for (const id of boardStories) {
    const s = STORIES[id];
    if (!s) continue;
    for (const ch of s.chars) {
      pool[ch] = Math.round(config.STORY_WEIGHT * storyRateMult);
    }
  }
  // 武将字：解锁该武将后其名字单字入池（不与故事字冲突，取较大权重）
  for (const ch of heroChars) {
    pool[ch] = Math.max(pool[ch] || 0, config.HERO_WEIGHT);
  }
  return pool;
}

module.exports = { STORIES, getStory, isStoryChar, checkPhrasePath, pickStoriesForBoard, buildPool };
