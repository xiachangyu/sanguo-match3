const { test } = require('node:test');
const assert = require('node:assert');
const heroes = require('../js/heroes');
const story = require('../js/story');

test('heroes data: every story maps to at least one hero', () => {
  const storyIds = Object.keys(require('../js/story').STORIES);
  assert.strictEqual(storyIds.length, 12);
  for (const sid of storyIds) {
    assert.ok(heroes.STORY_HEROES[sid] && heroes.STORY_HEROES[sid].length > 0, sid + ' should have heroes');
  }
});

test('hero list is flattened with storyId and skill-word chars', () => {
  const liubei = heroes.HERO_LIST.find(h => h.id === '刘备');
  assert.ok(liubei);
  assert.strictEqual(liubei.storyId, 'taoyuan');
  // 划线单位是绝技词（4字），而非 2 字名，避免太容易
  assert.deepStrictEqual(liubei.chars, ['仁', '德', '天', '下']);
  const zhuge = heroes.HERO_LIST.find(h => h.id === '诸葛亮');
  assert.deepStrictEqual(zhuge.chars, ['鞠', '躬', '尽', '瘁']);
});

test('matchHeroOrdered requires sequence (forward or reverse), rejects scrambled', () => {
  const liubei = heroes.HERO_LIST.find(h => h.id === '刘备');
  assert.ok(heroes.matchHeroOrdered(['仁', '德', '天', '下'], liubei)); // 正序
  assert.ok(heroes.matchHeroOrdered(['下', '天', '德', '仁'], liubei)); // 逆序
  assert.ok(!heroes.matchHeroOrdered(['仁', '天', '德', '下'], liubei)); // 乱序
  assert.ok(!heroes.matchHeroOrdered(['仁', '德', '天'], liubei)); // 长度不符
});

test('checkPhrasePath matches hero skill word in order, rejects scrambled', () => {
  // 正序
  let grid = [['仁', '德', '天', '下']];
  let path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }];
  let res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.heroId, '刘备');
  // 逆序（从右到左）
  grid = [['下', '天', '德', '仁']];
  res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.heroId, '刘备');
  // 乱序（顺序被打乱）应不命中
  grid = [['德', '天', '仁', '下']];
  res = story.checkPhrasePath(grid, path);
  assert.strictEqual(res, null);
});

test('every hero has an awakenedSkill that exists in SKILL_INFO', () => {
  const skills = require('../js/skills');
  for (const h of heroes.HERO_LIST) {
    assert.ok(skills.SKILL_INFO[h.awakenedSkill], h.name + ' awakenedSkill ' + h.awakenedSkill + ' missing');
  }
});

test('buildPool includes unlocked hero chars and keeps base weight', () => {
  const pool = story.buildPool([], 1, ['刘', '备']);
  assert.strictEqual(pool['刘'], require('../js/config').HERO_WEIGHT);
  assert.strictEqual(pool['兵'], 100);
});

test('every hero has a distinct skill (exists in SKILL_INFO) and a voice line', () => {
  const skills = require('../js/skills');
  for (const h of heroes.HERO_LIST) {
    assert.ok(skills.SKILL_INFO[h.skill], h.name + ' skill ' + h.skill + ' missing');
    assert.ok(h.voice && h.voice.length > 0, h.name + ' voice missing');
  }
  // 刘备/关羽/张飞 的台词
  assert.strictEqual(heroes.getHero('刘备').voice, '我二弟天下无敌');
  assert.strictEqual(heroes.getHero('关羽').voice, '看我温酒斩华雄');
  assert.strictEqual(heroes.getHero('张飞').voice, '俺也一样');
});
