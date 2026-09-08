// 每个武将有独立技能(skill)、觉醒技能(awakenedSkill)、台词(voice)、绝技词(skillWord)。
// 名字(name)用于收集/展示；绝技词(3~5字)作为盘面划线激活单位，须按顺序划（正序/逆序、四方向直线）。
// 每个武将其所属主故事(story)为一对一：每关（故事关）只解锁 1 个武将。
const HEROES = {
  刘备:   { name: '刘备', story: 'taoyuan', skill: 'blessing', awakenedSkill: 'brotherhood', voice: '我二弟天下无敌', skillWord: '仁德天下', audio: 'liubei.wav' },
  华雄:   { name: '华雄', story: 'wenjiu', skill: 'combo7', awakenedSkill: 'combo10', voice: '谁敢应战', skillWord: '谁敢应战', audio: 'huaxiong.wav' },
  吕布:   { name: '吕布', story: 'sanying', skill: 'combo6', awakenedSkill: 'combo10', voice: '天下无敌', skillWord: '人中吕布', audio: 'lvbu.wav' },
  曹操:   { name: '曹操', story: 'zhujiu', skill: 'clear30', awakenedSkill: 'clearAll', voice: '宁教我负天下人', skillWord: '宁负天下', audio: 'caocao.wav' },
  关羽:   { name: '关羽', story: 'qianli', skill: 'rowClear', awakenedSkill: 'crossClear', voice: '看我温酒斩华雄', skillWord: '温酒斩雄', audio: 'guanyu.wav' },
  袁绍:   { name: '袁绍', story: 'guandu', skill: 'addTime10', awakenedSkill: 'addTime20', voice: '我有颜良文丑', skillWord: '颜良文丑', audio: 'yuanshao.wav' },
  诸葛亮: { name: '诸葛亮', story: 'sangu', skill: 'generatePhrase', awakenedSkill: 'generateAndTrigger', voice: '鞠躬尽瘁，死而后已', skillWord: '鞠躬尽瘁', audio: 'zhugeliang.wav' },
  鲁肃:   { name: '鲁肃', story: 'caochuan', skill: 'pause5', awakenedSkill: 'pause8', voice: '以和为贵', skillWord: '以和为贵', audio: 'lusu.wav' },
  周瑜:   { name: '周瑜', story: 'chibi', skill: 'clearAllStory', awakenedSkill: 'clearAll', voice: '既生瑜，何生亮', skillWord: '既生瑜亮', audio: 'zhouyu.wav' },
  张飞:   { name: '张飞', story: 'huarong', skill: 'combo3', awakenedSkill: 'combo6', voice: '俺也一样', skillWord: '当阳断桥', audio: 'zhangfei.wav' },
  孟获:   { name: '孟获', story: 'qinqin', skill: 'combo7', awakenedSkill: 'combo10', voice: '七纵七擒', skillWord: '七擒七纵', audio: 'menghuo.wav' },
  司马懿: { name: '司马懿', story: 'kongcheng', skill: 'lowTimeDouble', awakenedSkill: 'pause8', voice: '鹰视狼顾', skillWord: '鹰视狼顾', audio: 'simayi.wav' },
};

// 每个故事关只关联 1 个武将（每关解锁 1 个武将，一对一）
const STORY_HEROES = {
  taoyuan: ['刘备'],
  wenjiu: ['华雄'],
  sanying: ['吕布'],
  zhujiu: ['曹操'],
  qianli: ['关羽'],
  guandu: ['袁绍'],
  sangu: ['诸葛亮'],
  caochuan: ['鲁肃'],
  chibi: ['周瑜'],
  huarong: ['张飞'],
  qinqin: ['孟获'],
  kongcheng: ['司马懿'],
};

// 展平唯一武将列表：{ id, name, skillWord, chars(绝技词字), len, skill, awakenedSkill, voice, storyId }
const HERO_LIST = Object.keys(HEROES).map((name) => {
  const sw = HEROES[name].skillWord;
  return {
    id: name, name, skillWord: sw, chars: sw.split(''), len: sw.length,
    skill: HEROES[name].skill, awakenedSkill: HEROES[name].awakenedSkill,
    voice: HEROES[name].voice, storyId: HEROES[name].story,
  };
});

function getHero(name) {
  return HEROES[name] || null;
}

function heroesForStory(storyId) {
  return (STORY_HEROES[storyId] || []).map((n) => {
    const h = HEROES[n];
    return h ? { ...h, chars: h.skillWord.split(''), len: h.skillWord.length } : null;
  }).filter(Boolean);
}

// 所有武将名的单字（去重）
function allHeroChars() {
  const s = new Set();
  for (const h of HERO_LIST) for (const ch of h.chars) s.add(ch);
  return s;
}

// 判断路径字序列是否==绝技词（正序或逆序均可；对应直线四个方向顺/逆行）
function matchHeroOrdered(chars, hero) {
  if (chars.length !== hero.len) return false;
  const direct = chars.every((ch, i) => ch === hero.chars[i]);
  const reversed = chars.every((ch, i) => ch === hero.chars[hero.len - 1 - i]);
  return direct || reversed;
}

// 判断路径字集合是否恰好==绝技词（不要求顺序，乱序也算命中）
function matchHero(chars, hero) {
  if (chars.length !== hero.len) return false;
  const set = new Set(chars);
  return hero.chars.every((ch) => set.has(ch));
}

module.exports = { HEROES, STORY_HEROES, HERO_LIST, getHero, heroesForStory, allHeroChars, matchHeroOrdered, matchHero };
