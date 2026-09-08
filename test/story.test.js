const { test } = require('node:test');
const assert = require('node:assert');
const story = require('../js/story');

test('story data has 12 stories with unlock order', () => {
  const ids = Object.keys(story.STORIES);
  assert.strictEqual(ids.length, 12);
  assert.deepStrictEqual(story.STORIES.taoyuan.chars, ['桃', '园', '三', '结', '义']);
});

test('checkPhrasePath no longer matches story phrases, only hero skill words', () => {
  // 桃园三结义故事短语字不再作为划线命中（字池已不含故事字）
  const grid = [
    ['桃', '园', '三', '结', '义'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }];
  assert.strictEqual(story.checkPhrasePath(grid, path), null);
  // 武将绝技词（刘备·仁德天下）仍命中
  const g2 = [
    ['仁', '德', '天', '下'],
  ];
  const res = story.checkPhrasePath(g2, path.slice(0, 4));
  assert.ok(res);
  assert.strictEqual(res.heroId, '刘备');
  assert.strictEqual(res.heroOrdered, true);
});

test('checkPhrasePath rejects L-shaped (non-straight) path', () => {
  const grid = [
    ['桃', '园', '三'],
    ['兵', '义', '结'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 1 }];
  assert.strictEqual(story.checkPhrasePath(grid, path), null);
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

test('buildPool keeps base weight and excludes story-phrase tiles', () => {
  const pool = story.buildPool(['taoyuan'], 1);
  assert.strictEqual(pool['兵'], 100);
  assert.strictEqual(pool['弓'], 100);
  assert.strictEqual(pool['桃'], undefined); // 字池不含故事短语字
});

test('buildPool includes hero skill-word chars', () => {
  const pool = story.buildPool(['taoyuan'], 1, ['仁', '德', '天', '下']);
  assert.strictEqual(pool['仁'], require('../js/config').HERO_WEIGHT);
  assert.strictEqual(pool['兵'], 100);
});

test('isStoryChar works', () => {
  assert.ok(story.isStoryChar('桃'));
  assert.ok(!story.isStoryChar('兵'));
});

test('checkPhrasePath rejects out-of-bounds path cells', () => {
  const grid = [
    ['桃', '园', '三'],
    ['兵', '义', '结'],
  ];
  // 前三格相邻且拼出 桃园三，最后一步 (0,2)→(-1,2) 相邻但越界
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: -1, c: 2 }];
  assert.strictEqual(story.checkPhrasePath(grid, path), null);
});
