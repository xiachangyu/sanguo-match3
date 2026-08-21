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
  const milestone = storyLevelFor(level);
  const storyId = milestone ? milestone.storyId : null;
  const target = config.NORMAL_SCORE_BASE + (level - 1) * config.NORMAL_SCORE_STEP;
  if (mode === 'elite') {
    return {
      level, mode: 'elite', storyId, goalType: 'score',
      time: config.ELITE_TIME,
      targetScore: Math.round(target * config.ELITE_SCORE_MULT),
    };
  }
  const cfg = { level, mode: 'normal', storyId, goalType: 'score', time: config.NORMAL_TIME, targetScore: target };
  // 目标轮换：分数 → 收集某基础字 → 触发短语（按解锁阶段递增数值）
  const cycle = config.GOAL_TYPES.length;
  const stage = Math.floor((level - 1) / cycle);
  cfg.goalType = config.GOAL_TYPES[(level - 1) % cycle];
  if (cfg.goalType === 'collect') {
    cfg.goalChar = config.BASE_TILES[(level - 1) % config.BASE_TILES.length];
    cfg.goalCount = config.COLLECT_BASE + stage * config.COLLECT_STEP;
  } else if (cfg.goalType === 'phrase') {
    cfg.goalCount = config.PHRASE_BASE + stage * config.PHRASE_STEP;
  }
  return cfg;
}

// 右上角预告：下一个要解锁的故事
function getUnlockPreview(level) {
  for (const u of UNLOCK) {
    if (u.level > level) return { level: u.level, storyId: u.storyId };
  }
  return null;
}

module.exports = { UNLOCK, storyLevelFor, getLevelConfig, getUnlockPreview, STORIES };
