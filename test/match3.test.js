const { test } = require('node:test');
const assert = require('node:assert');
const match3 = require('../js/match3');

test('findMatches detects horizontal and vertical 3+ runs', () => {
  const grid = [
    ['兵', '兵', '兵', '弓'],
    ['车', '骑', '枪', '弓'],
    ['骑', '枪', '兵', '弓'],
  ];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 2); // 横排3个兵 + 竖排3个弓
  const horizontal = groups.find(g => g.kind === 'row');
  const vertical = groups.find(g => g.kind === 'col');
  assert.ok(horizontal && horizontal.cells.length === 3);
  assert.ok(vertical && vertical.cells.length === 3);
});

test('findMatches returns empty for no matches', () => {
  const grid = [
    ['兵', '弓', '车'],
    ['枪', '骑', '兵'],
    ['弓', '车', '枪'],
  ];
  assert.deepStrictEqual(match3.findMatches(grid), []);
});

test('findMatches handles run of 4', () => {
  const grid = [['兵', '兵', '兵', '兵']];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].cells.length, 4);
});

test('applyMatch nulls matched cells', () => {
  const grid = [['兵', '兵', '兵'], ['弓', '车', '枪']];
  const groups = match3.findMatches(grid);
  const out = match3.applyMatch(grid, groups[0]);
  assert.strictEqual(out[0][0], null);
  assert.strictEqual(out[0][1], null);
  assert.strictEqual(out[0][2], null);
  assert.strictEqual(out[1][0], '弓');
});

test('scoreMatch scales with size and cascade level', () => {
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3] }, 0), 30);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3, 4] }, 0), 60);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3, 4, 5] }, 0), 100);
  assert.strictEqual(match3.scoreMatch({ cells: [1, 2, 3] }, 1), 45);
});

test('hasValidMove true when a swap creates a match', () => {
  // 交换 (0,1)弓 与 (1,1)兵 → 第0行 兵兵兵 成三连
  const grid = [
    ['兵', '弓', '兵'],
    ['车', '兵', '骑'],
  ];
  assert.strictEqual(match3.hasValidMove(grid), true);
});

test('hasValidMove false for dead board', () => {
  const grid = [
    ['兵', '弓', '车'],
    ['枪', '骑', '兵'],
    ['弓', '车', '枪'],
  ];
  assert.strictEqual(match3.hasValidMove(grid), false);
});

test('L-shape match yields two groups sharing the corner cell', () => {
  const grid = [
    ['兵', '兵', '兵'],
    ['弓', '兵', '车'],
    ['枪', '兵', '枪'],
  ];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 2);
  const rowGroup = groups.find(g => g.kind === 'row');
  const colGroup = groups.find(g => g.kind === 'col');
  assert.ok(rowGroup && colGroup);
  const corner = { r: 0, c: 1 };
  const inRow = rowGroup.cells.some(cell => cell.r === 0 && cell.c === 1);
  const inCol = colGroup.cells.some(cell => cell.r === 0 && cell.c === 1);
  assert.ok(inRow && inCol);
});

test('five-run row scores SCORE_MATCH5 via findMatches + scoreMatch', () => {
  const grid = [['兵', '兵', '兵', '兵', '兵', '弓', '车', '骑']];
  const groups = match3.findMatches(grid);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].cells.length, 5);
  assert.strictEqual(match3.scoreMatch(groups[0], 0), 100);
});
