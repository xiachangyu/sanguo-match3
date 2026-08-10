const config = require('./config');

// 找出所有横/竖 3 连及以上分组
function findMatches(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const groups = [];
  // 横向
  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      if (c < cols && grid[r][c] !== null && grid[r][c] === grid[r][start]) continue;
      if (c - start >= 3 && grid[r][start] !== null) {
        const cells = [];
        for (let k = start; k < c; k++) cells.push({ r, c: k });
        groups.push({ cells, char: grid[r][start], kind: 'row' });
      }
      start = c;
    }
  }
  // 纵向
  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      if (r < rows && grid[r][c] !== null && grid[r][c] === grid[start][c]) continue;
      if (r - start >= 3 && grid[start][c] !== null) {
        const cells = [];
        for (let k = start; k < r; k++) cells.push({ r: k, c });
        groups.push({ cells, char: grid[start][c], kind: 'col' });
      }
      start = r;
    }
  }
  return groups;
}

// 将分组内格子置空，返回新棋盘
function applyMatch(grid, group) {
  const out = grid.map(row => row.slice());
  for (const cell of group.cells) out[cell.r][cell.c] = null;
  return out;
}

// 计分：3/4/5 连基础分 × 连锁倍率
function scoreMatch(group, cascadeLevel = 0) {
  const n = group.cells.length;
  const base = n >= 5 ? config.SCORE_MATCH5 : n === 4 ? config.SCORE_MATCH4 : config.SCORE_MATCH3;
  return Math.round(base * Math.pow(config.CASCADE_MULT, cascadeLevel));
}

// 是否存在一次可交换能形成三连
function hasValidMove(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && swapCreatesMatch(grid, r, c, r, c + 1)) return true;
      if (r + 1 < rows && swapCreatesMatch(grid, r, c, r + 1, c)) return true;
    }
  }
  return false;
}

function swapCreatesMatch(grid, r1, c1, r2, c2) {
  const g = grid.map(row => row.slice());
  [g[r1][c1], g[r2][c2]] = [g[r2][c2], g[r1][c1]];
  return cellInMatch(g, r1, c1) || cellInMatch(g, r2, c2);
}

function cellInMatch(grid, r, c) {
  const ch = grid[r][c];
  if (ch === null) return false;
  const rows = grid.length;
  const cols = grid[0].length;
  let n = 1;
  for (let cc = c - 1; cc >= 0 && grid[r][cc] === ch; cc--) n++;
  for (let cc = c + 1; cc < cols && grid[r][cc] === ch; cc++) n++;
  if (n >= 3) return true;
  n = 1;
  for (let rr = r - 1; rr >= 0 && grid[rr][c] === ch; rr--) n++;
  for (let rr = r + 1; rr < rows && grid[rr][c] === ch; rr++) n++;
  return n >= 3;
}

module.exports = { findMatches, applyMatch, scoreMatch, hasValidMove };
