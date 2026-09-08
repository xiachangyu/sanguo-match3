const { test } = require('node:test');
const assert = require('node:assert');
const tile = require('../js/tile');
const match3 = require('../js/match3');
const story = require('../js/story');

test('tile() plain char stays string; special becomes object', () => {
  assert.strictEqual(tile.tile('兵'), '兵');
  const t = tile.tile('兵', 'row');
  assert.deepStrictEqual(t, { ch: '兵', special: 'row' });
});

test('chOf works for string and object tiles', () => {
  assert.strictEqual(tile.chOf('兵'), '兵');
  assert.strictEqual(tile.chOf({ ch: '弓', special: 'bomb' }), '弓');
  assert.strictEqual(tile.chOf(null), null);
});

test('specialOf returns null for plain tiles', () => {
  assert.strictEqual(tile.specialOf('兵'), null);
  assert.strictEqual(tile.specialOf(null), null);
  assert.strictEqual(tile.specialOf({ ch: '车', special: 'rainbow' }), 'rainbow');
});

test('match3 detects runs across object tiles', () => {
  const grid = [
    ['兵', '兵', tile.tile('兵', 'row'), '弓'],
    ['车', '骑', '枪', '弓'],
  ];
  const groups = match3.findMatches(grid);
  assert.ok(groups.length >= 1);
  const row = groups.find(g => g.kind === 'row');
  assert.ok(row && row.cells.length === 3);
  assert.strictEqual(row.char, '兵');
});

test('match3 hasValidMove works with object tiles', () => {
  const grid = [
    ['兵', tile.tile('弓', 'col'), '兵'],
    ['车', '兵', '骑'],
  ];
  assert.strictEqual(match3.hasValidMove(grid), true);
});

test('story phrase path reads char from object tiles', () => {
  const grid = [
    ['仁', '德', tile.tile('天', 'row'), '下'],
  ];
  const path = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }];
  const res = story.checkPhrasePath(grid, path);
  assert.ok(res);
  assert.strictEqual(res.heroId, '刘备');
});
