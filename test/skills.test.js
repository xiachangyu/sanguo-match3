const { test } = require('node:test');
const assert = require('node:assert');
const skills = require('../js/skills');
const story = require('../js/story');
const board = require('../js/board');

const POOL = story.buildPool(['taoyuan'], 1);

function makeGrid() {
  return board.createBoard(4, 4, POOL);
}

test('blessing returns score multiplier buff', () => {
  const res = skills.activate('blessing', { grid: makeGrid(), pool: POOL, origin: { r: 0, c: 0 } });
  assert.strictEqual(res.buffs.length, 1);
  assert.strictEqual(res.buffs[0].type, 'scoreMult');
  assert.strictEqual(res.buffs[0].seconds, 10);
});

test('rowClear clears an entire row', () => {
  const grid = makeGrid();
  const res = skills.activate('rowClear', { grid, pool: POOL, origin: { r: 3, c: 0 } });
  assert.strictEqual(res.cleared.length, 4);
  assert.ok(res.cleared.every(cell => cell.r === 3));
});

test('clearColor clears all of one base char', () => {
  const grid = makeGrid();
  const res = skills.activate('clearColor', { grid, pool: POOL, origin: { r: 0, c: 0 } });
  if (res.cleared.length === 0) return; // 随机目标字本盘未出现（允许）
  const clearedChars = res.cleared.map(c => grid[c.r][c.c]);
  assert.strictEqual(new Set(clearedChars).size, 1);
  assert.ok(require('../js/config').BASE_TILES.includes(clearedChars[0]));
});

test('shuffle preserves tile multiset', () => {
  const grid = makeGrid();
  const before = countChars(grid);
  const res = skills.activate('shuffle', { grid, pool: POOL, origin: { r: 0, c: 0 } });
  assert.deepStrictEqual(countChars(res.grid), before);
});

test('addTime10 adds time delta', () => {
  const res = skills.activate('addTime10', { grid: makeGrid(), pool: POOL, origin: { r: 0, c: 0 } });
  assert.strictEqual(res.timeDelta, 10);
});

test('generatePhrase places story chars contiguously', () => {
  const grid = makeGrid();
  const res = skills.activate('generatePhrase', { grid, pool: POOL, origin: { r: 0, c: 0 }, storyId: 'sangu' });
  const word = res.grid[0].slice(0, 4).join('');
  assert.strictEqual(word, '三顾茅庐');
});

function countChars(grid) {
  const map = {};
  for (const row of grid) for (const ch of row) map[ch] = (map[ch] || 0) + 1;
  return map;
}
