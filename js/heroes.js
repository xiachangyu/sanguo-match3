// 武将数据：每个武将有独立技能(skillId) 和 专属台词(voice)，并归属一个主故事(story)。
// 玩法：通关故事关解锁该关武将（收集）→ 已解锁武将名字单字成为盘面字块，
// 玩家一笔划过相邻直线、集合恰好为某武将名（顺序不限）即触发该武将的独立技能，
// 并显示其台词 + 播放专属音效。
const HEROES = {
  刘备:   { name: '刘备', story: 'taoyuan', skill: 'blessing', voice: '我二弟天下无敌' },
  关羽:   { name: '关羽', story: 'taoyuan', skill: 'rowClear', voice: '看我温酒斩华雄' },
  张飞:   { name: '张飞', story: 'taoyuan', skill: 'combo3', voice: '俺也一样' },
  华雄:   { name: '华雄', story: 'wenjiu', skill: 'combo7', voice: '谁敢应战' },
  吕布:   { name: '吕布', story: 'sanying', skill: 'combo6', voice: '天下无敌' },
  曹操:   { name: '曹操', story: 'zhujiu', skill: 'clear30', voice: '宁教我负天下人' },
  袁绍:   { name: '袁绍', story: 'guandu', skill: 'addTime10', voice: '我有颜良文丑' },
  诸葛亮: { name: '诸葛亮', story: 'sangu', skill: 'generatePhrase', voice: '鞠躬尽瘁，死而后已' },
  鲁肃:   { name: '鲁肃', story: 'caochuan', skill: 'pause5', voice: '以和为贵' },
  周瑜:   { name: '周瑜', story: 'chibi', skill: 'clearAllStory', voice: '既生瑜，何生亮' },
  孟获:   { name: '孟获', story: 'qinqin', skill: 'combo10', voice: '七纵七擒' },
  司马懿: { name: '司马懿', story: 'kongcheng', skill: 'lowTimeDouble', voice: '鹰视狼顾' },
};

// 每个故事关关联一组武将（按三国剧情/时间线）
const STORY_HEROES = {
  taoyuan: ['刘备', '关羽', '张飞'],
  wenjiu: ['关羽', '华雄'],
  sanying: ['吕布', '刘备', '关羽', '张飞'],
  zhujiu: ['曹操', '刘备'],
  qianli: ['关羽'],
  guandu: ['曹操', '袁绍'],
  sangu: ['刘备', '诸葛亮'],
  caochuan: ['诸葛亮', '鲁肃'],
  chibi: ['周瑜', '诸葛亮', '曹操'],
  huarong: ['关羽', '曹操'],
  qinqin: ['诸葛亮', '孟获'],
  kongcheng: ['诸葛亮', '司马懿'],
};

// 展平唯一武将列表：{ id, name, chars, len, skill, voice, storyId }
const HERO_LIST = Object.keys(HEROES).map((name) => ({
  id: name, name, chars: name.split(''), len: name.length,
  skill: HEROES[name].skill, voice: HEROES[name].voice, storyId: HEROES[name].story,
}));

function getHero(name) {
  return HEROES[name] || null;
}

function heroesForStory(storyId) {
  return (STORY_HEROES[storyId] || []).map((n) => HEROES[n]).filter(Boolean);
}

// 所有武将名的单字（去重）
function allHeroChars() {
  const s = new Set();
  for (const h of HERO_LIST) for (const ch of h.chars) s.add(ch);
  return s;
}

// 判断路径字集合是否恰好==某武将名（不要求顺序）
function matchHero(chars, hero) {
  if (chars.length !== hero.len) return false;
  const set = new Set(chars);
  return hero.chars.every((ch) => set.has(ch));
}

module.exports = { HEROES, STORY_HEROES, HERO_LIST, getHero, heroesForStory, allHeroChars, matchHero };
