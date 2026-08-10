const board = require('./board');
const config = require('./config');

// 道具执行。state: { grid, pool }；返回 { grid, cleared, score, timeDelta, notes } 或 null（参数无效）
function use(propId, state, ...args) {
  switch (propId) {
    case 'hammer': {
      const cell = args[0];
      const rows = state.grid.length;
      const cols = state.grid[0].length;
      if (!cell || cell.r == null || cell.c == null) return null;
      if (cell.r < 0 || cell.r >= rows || cell.c < 0 || cell.c >= cols) return null;
      if (state.grid[cell.r][cell.c] === null) return null;
      const grid = state.grid.map(row => row.slice());
      grid[cell.r][cell.c] = null;
      return { grid, cleared: [cell], score: 0, timeDelta: 0, notes: '铁锤' };
    }
    case 'swap': {
      const a = args[0], b = args[1];
      if (!a || !b || !board.isAdjacent(a, b)) return null;
      return { grid: board.swapTiles(state.grid, a, b), cleared: [], score: 0, timeDelta: 0, notes: '置换' };
    }
    case 'shuffle':
      return { grid: board.shuffleGrid(state.grid), cleared: [], score: 0, timeDelta: 0, notes: '洗牌' };
    case 'time':
      return { grid: state.grid, cleared: [], score: 0, timeDelta: config.PROP_TIME_SECONDS, notes: '加时' };
    default:
      return null;
  }
}

module.exports = { use };
