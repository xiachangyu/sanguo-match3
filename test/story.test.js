const { test } = require('node:test');
const assert = require('node:assert');
const story = require('../js/story');

test('story data has 12 stories with unlock order', () => {
  const ids = Object.keys(story.STORIES);
  assert.strictEqual(ids.length, 12);
  assert.deepStrictEqual(story.STORIES.taoyuan.chars, ['桃', '园', '三', '结', '义']);
});

test('checkPhrasePath accepts adjacent correct-order path', () => {
  const grid = [
    ['桃', '园', '三'],
    ['兵', '义', '结'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 1 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.storyId, 'taoyuan');
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

test('buildPool weights base high and story low', () => {
  const pool = story.buildPool(['taoyuan'], 1);
  assert.strictEqual(pool['兵'], 100);
  assert.strictEqual(pool['桃'], 15);
  assert.strictEqual(pool['弓'], 100);
});

test('buildPool respects storyRateMult', () => {
  const pool = story.buildPool(['taoyuan'], 2);
  assert.strictEqual(pool['桃'], 30);
});

test('isStoryChar works', () => {
  assert.ok(story.isStoryChar('桃'));
  assert.ok(!story.isStoryChar('兵'));
});
