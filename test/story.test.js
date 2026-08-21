const { test } = require('node:test');
const assert = require('node:assert');
const story = require('../js/story');

test('story data has 12 stories with unlock order', () => {
  const ids = Object.keys(story.STORIES);
  assert.strictEqual(ids.length, 12);
  assert.deepStrictEqual(story.STORIES.taoyuan.chars, ['桃', '园', '三', '结', '义']);
});

test('checkPhrasePath matches story chars in any order on a straight line', () => {
  // 一行 5 格，逆序排列「桃园三结义」→ 不要求顺序，仍命中 taoyuan
  const grid = [
    ['义', '结', '三', '园', '桃'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }, { r: 0, c: 4 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.storyId, 'taoyuan');
});

test('checkPhrasePath matches correct order and vertical line too', () => {
  const grid = [
    ['桃'],
    ['园'],
    ['三'],
    ['结'],
    ['义'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }, { r: 4, c: 0 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.storyId, 'taoyuan');
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

test('checkPhrasePath rejects out-of-bounds path cells', () => {
  const grid = [
    ['桃', '园', '三'],
    ['兵', '义', '结'],
  ];
  // 前三格相邻且拼出 桃园三，最后一步 (0,2)→(-1,2) 相邻但越界
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: -1, c: 2 }];
  assert.strictEqual(story.checkPhrasePath(grid, path), null);
});
