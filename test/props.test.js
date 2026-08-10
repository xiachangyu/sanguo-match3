const { test } = require('node:test');
const assert = require('node:assert');
const props = require('../js/props');
const board = require('../js/board');
const story = require('../js/story');

const POOL = story.buildPool(['taoyuan'], 1);

test('hammer nulls target cell', () => {
  const grid = board.createBoard(4, 4, POOL);
  const res = props.use('hammer', { grid, pool: POOL }, { r: 0, c: 0 });
  assert.strictEqual(res.grid[0][0], null);
  assert.deepStrictEqual(res.cleared, [{ r: 0, c: 0 }]);
});

test('swap prop requires adjacent and returns swapped grid', () => {
  const grid = [
    ['兵', '弓'],
    ['车', '枪'],
  ];
  const res = props.use('swap', { grid, pool: POOL }, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.strictEqual(res.grid[0][0], '弓');
  assert.strictEqual(res.grid[0][1], '兵');
  assert.strictEqual(props.use('swap', { grid, pool: POOL }, { r: 0, c: 0 }, { r: 1, c: 1 }), null);
});

test('shuffle prop preserves tile multiset', () => {
  const grid = board.createBoard(4, 4, POOL);
  const before = count(grid);
  const res = props.use('shuffle', { grid, pool: POOL });
  assert.deepStrictEqual(count(res.grid), before);
});

test('time prop adds configured seconds', () => {
  const grid = board.createBoard(4, 4, POOL);
  const res = props.use('time', { grid, pool: POOL });
  assert.strictEqual(res.timeDelta, 10);
});

test('hammer rejects out-of-bounds or already-null cells', () => {
  const grid = board.createBoard(4, 4, POOL);
  assert.strictEqual(props.use('hammer', { grid, pool: POOL }, { r: 99, c: 0 }), null);
  assert.strictEqual(props.use('hammer', { grid, pool: POOL }, { r: -1, c: 0 }), null);
  const res = props.use('hammer', { grid, pool: POOL }, { r: 0, c: 0 });
  assert.ok(res);
  assert.strictEqual(props.use('hammer', { grid: res.grid, pool: POOL }, { r: 0, c: 0 }), null); // 已空
});

test('swap prop rejects same cell', () => {
  const grid = board.createBoard(4, 4, POOL);
  assert.strictEqual(props.use('swap', { grid, pool: POOL }, { r: 0, c: 0 }, { r: 0, c: 0 }), null);
});

function count(grid) {
  const map = {};
  for (const row of grid) for (const ch of row) map[ch] = (map[ch] || 0) + 1;
  return map;
}
