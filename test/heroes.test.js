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

test('hero list is flattened with storyId and chars', () => {
  const liubei = heroes.HERO_LIST.find(h => h.id === '刘备');
  assert.ok(liubei);
  assert.strictEqual(liubei.storyId, 'taoyuan');
  assert.deepStrictEqual(liubei.chars, ['刘', '备']);
  const zhuge = heroes.HERO_LIST.find(h => h.id === '诸葛亮');
  assert.deepStrictEqual(zhuge.chars, ['诸', '葛', '亮']);
});

test('matchHero matches set equality regardless of order', () => {
  const liubei = heroes.HERO_LIST.find(h => h.id === '刘备');
  assert.ok(heroes.matchHero(['备', '刘'], liubei));
  assert.ok(!heroes.matchHero(['备', '关'], liubei));
  assert.ok(!heroes.matchHero(['刘'], liubei)); // 长度不符
});

test('checkPhrasePath matches hero name (order-free straight line)', () => {
  const grid = [
    ['备', '刘'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }];
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
