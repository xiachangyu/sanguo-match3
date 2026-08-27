// 武将数据：每个故事关关联一组武将。
// 玩法：通关故事关解锁对应武将（收集）→ 武者名字的单字成为盘面字块，
// 玩家一笔划过相邻直线、集合恰好为某武将名（顺序不限）即触发作该武将所属故事的技能。
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

// 展平所有武将：{ id, name, storyId, chars, len }
const HERO_LIST = Object.keys(STORY_HEROES).reduce((acc, storyId) => {
  for (const name of STORY_HEROES[storyId]) {
    const chars = name.split('');
    acc.push({ id: name, name, storyId, chars, len: chars.length });
  }
  return acc;
}, []);

function heroesForStory(storyId) {
  return STORY_HEROES[storyId] || [];
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
  return hero.chars.every(ch => set.has(ch));
}

module.exports = { STORY_HEROES, HERO_LIST, heroesForStory, allHeroChars, matchHero };
