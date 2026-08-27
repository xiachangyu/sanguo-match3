const { test } = require('node:test');
const assert = require('node:assert');
const board = require('../js/board');

const pool = { 兵: 1, 弓: 1, 车: 1, 枪: 1, 骑: 1 };

test('createBoard has no initial matches and valid move', () => {
  const match3 = require('../js/match3');
  for (let i = 0; i < 20; i++) {
    const grid = board.createBoard(8, 8, pool);
    assert.strictEqual(grid.length, 8);
    assert.strictEqual(grid[0].length, 8);
    assert.deepStrictEqual(match3.findMatches(grid), []);
    assert.ok(match3.hasValidMove(grid));
  }
});

test('isAdjacent only for orthogonal neighbors', () => {
  assert.ok(board.isAdjacent({ r: 0, c: 0 }, { r: 0, c: 1 }));
  assert.ok(board.isAdjacent({ r: 2, c: 3 }, { r: 1, c: 3 }));
  assert.ok(!board.isAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 }));
  assert.ok(!board.isAdjacent({ r: 0, c: 0 }, { r: 0, c: 0 }));
});

test('applyGravity drops tiles down and nulls top', () => {
  const grid = [
    ['兵', null],
    [null, '弓'],
    ['车', null],
  ];
  const out = board.applyGravity(grid);
  assert.deepStrictEqual(out, [
    [null, null],
    ['兵', null],
    ['车', '弓'],
  ]);
});

test('applyGravity handles an all-null column among filled ones', () => {
  const grid = [
    ['兵', null, '车'],
    ['弓', null, '枪'],
    [null, null, '骑'],
  ];
  const out = board.applyGravity(grid);
  assert.deepStrictEqual(out, [
    [null, null, '车'],
    ['兵', null, '枪'],
    ['弓', null, '骑'],
  ]);
});

test('refill replaces nulls with pool chars', () => {
  const grid = [
    [null, '弓'],
    ['车', null],
  ];
  const out = board.refill(grid, pool);
  assert.ok(pool[out[0][0]] !== undefined);
  assert.strictEqual(out[0][1], '弓');
  assert.strictEqual(out[1][0], '车');
  assert.ok(pool[out[1][1]] !== undefined);
});

test('resolveCascade clears matches and scores cascade', () => {
  const grid = [
    ['兵', '兵', '兵', '弓', '车', '枪', '骑', '兵'],
    ['弓', '车', '枪', '骑', '兵', '弓', '车', '枪'],
  ];
  const { grid: out, score, cascade } = board.resolveCascade(grid, pool);
  assert.ok(score >= 30);
  assert.ok(cascade >= 1);
  assert.ok(match3FindMatches(out).length === 0);
});

test('resolveCascade fills null holes even when no match forms (hammer case)', () => {
  // 一个无匹配棋盘，人为戳一个 null（锤子砸掉字块但不触发连锁）
  const grid = [
    ['兵', '弓', '车'],
    ['枪', null, '兵'],
    ['弓', '车', '枪'],
  ];
  const { grid: out } = board.resolveCascade(grid, pool);
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out[0].length; c++) {
      assert.ok(out[r][c] !== null, 'cell ' + r + ',' + c + ' should not be null');
    }
  }
  assert.strictEqual(match3FindMatches(out).length, 0);
});

function match3FindMatches(grid) {
  return require('../js/match3').findMatches(grid);
}

test('swapTiles returns new grid with swapped cells', () => {
  const grid = [['兵', '弓'], ['车', '枪']];
  const out = board.swapTiles(grid, { r: 0, c: 0 }, { r: 0, c: 1 });
  assert.strictEqual(out[0][0], '弓');
  assert.strictEqual(out[0][1], '兵');
  assert.strictEqual(grid[0][0], '兵'); // 原棋盘不被修改
});
