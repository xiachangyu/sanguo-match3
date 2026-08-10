const match3 = require('./match3');

function copy(grid) {
  return grid.map(row => row.slice());
}

function get(grid, r, c) {
  return grid[r][c];
}

function isAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

// 加权随机抽一个字符
function weightedPick(pool) {
  const entries = Object.entries(pool);
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [ch, w] of entries) {
    r -= w;
    if (r <= 0) return ch;
  }
  return entries[entries.length - 1][0];
}

// 生成无初始三连、且有可行步的棋盘
function createBoard(rows, cols, pool) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let ch;
      do {
        ch = weightedPick(pool);
      } while (
        (c >= 2 && row[c - 1] === ch && row[c - 2] === ch) ||
        (r >= 2 && grid[r - 1][c] === ch && grid[r - 2][c] === ch)
      );
      row.push(ch);
    }
    grid.push(row);
  }
  if (!match3.hasValidMove(grid)) return createBoard(rows, cols, pool);
  return grid;
}

// 字块下落：非空下沉，顶部补 null
function applyGravity(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const out = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let c = 0; c < cols; c++) {
    let wr = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[r][c] !== null) {
        out[wr][c] = grid[r][c];
        wr--;
      }
    }
  }
  return out;
}

// 从字池随机补满 null 格
function refill(grid, pool) {
  const out = copy(grid);
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out[0].length; c++) {
      if (out[r][c] === null) out[r][c] = weightedPick(pool);
    }
  }
  return out;
}

// 连锁结算：消→落→补→再消，返回最终盘面/总分/连锁数/各轮消除格
function resolveCascade(grid, pool) {
  let g = grid;
  let score = 0;
  let cascade = 0;
  const cleared = [];
  while (cascade < 50) {
    const groups = match3.findMatches(g);
    if (!groups.length) break;
    const roundCells = [];
    for (const grp of groups) {
      g = match3.applyMatch(g, grp);
      score += match3.scoreMatch(grp, cascade);
      for (const cell of grp.cells) roundCells.push(cell);
    }
    cleared.push(roundCells);
    g = applyGravity(g);
    g = refill(g, pool);
    cascade++;
  }
  return { grid: g, score, cascade, cleared };
}

module.exports = { copy, get, isAdjacent, weightedPick, createBoard, applyGravity, refill, resolveCascade };
