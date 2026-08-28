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

test('matchHero matches skill-word set equality regardless of order', () => {
  const liubei = heroes.HERO_LIST.find(h => h.id === '刘备');
  assert.ok(heroes.matchHero(['天', '下', '仁', '德'], liubei));
  assert.ok(!heroes.matchHero(['天', '下', '仁'], liubei)); // 长度不符
  assert.ok(!heroes.matchHero(['天', '下', '仁', '义'], liubei));
});

test('checkPhrasePath matches hero skill word (order-free straight line)', () => {
  const grid = [
    ['德', '天', '仁', '下'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.heroId, '刘备');
  assert.strictEqual(res.storyId, 'taoyuan');
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
