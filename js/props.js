const board = require('./board');
const config = require('./config');

function shuffleGrid(grid) {
  const g = grid.map(row => row.slice());
  const cells = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) cells.push({ r, c });
  const chars = cells.map(p => g[p.r][p.c]).filter(ch => ch !== null);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  let k = 0;
  for (const p of cells) {
    if (g[p.r][p.c] !== null) g[p.r][p.c] = chars[k++];
  }
  return g;
}

// 道具执行。state: { grid, pool }；返回 { grid, cleared, timeDelta } 或 null（参数无效）
function use(propId, state, ...args) {
  switch (propId) {
    case 'hammer': {
      const cell = args[0];
      if (!cell || cell.r == null || cell.c == null) return null;
      const grid = state.grid.map(row => row.slice());
      grid[cell.r][cell.c] = null;
      return { grid, cleared: [cell], timeDelta: 0 };
    }
    case 'swap': {
      const a = args[0], b = args[1];
      if (!a || !b || !board.isAdjacent(a, b)) return null;
      const grid = state.grid.map(row => row.slice());
      [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
      return { grid, cleared: [], timeDelta: 0 };
    }
    case 'shuffle':
      return { grid: shuffleGrid(state.grid), cleared: [], timeDelta: 0 };
    case 'time':
      return { grid: state.grid, cleared: [], timeDelta: config.PROP_TIME_SECONDS };
    default:
      return null;
  }
}

module.exports = { use };
