const config = require('./config');
const levels = require('./levels');
const story = require('./story');

// 字块配色：基础字按固定色，故事字用金色
const TILE_COLORS = {
  兵: '#8d6e63', 弓: '#558b2f', 车: '#1565c0', 枪: '#6a1b9a', 骑: '#c62828',
};
const STORY_COLOR = '#e65100';

function tileColor(ch) {
  return TILE_COLORS[ch] || STORY_COLOR;
}

// 圆角矩形
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTile(ctx, x, y, size, ch) {
  const color = tileColor(ch);
  ctx.fillStyle = color;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.floor(size * 0.52) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x + size / 2, y + size / 2 + 2);
}

function drawBoard(ctx, grid, ox, oy, size) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] !== null) drawTile(ctx, ox + c * size, oy + r * size, size, grid[r][c]);
    }
  }
}

function drawHUD(ctx, opts, w) {
  // 顶部：关卡/模式/分数/时间
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 22px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const label = (opts.mode === 'elite' ? '精英 ' : '') + '第' + opts.level + '关';
  ctx.fillText(label, 16, 34);
  ctx.textAlign = 'center';
  ctx.fillText('目标 ' + opts.targetScore, w / 2, 34);
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(opts.timeLeft) + 's', w - 16, 34);

  // 分数
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(String(opts.score), w / 2, 70);
}

function drawStamina(ctx, stamina, x, y) {
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('体力 ' + stamina + '/' + config.STAMINA_MAX, x, y);
}

function drawPropBar(ctx, props, x, y, size) {
  const labels = ['锤', '换', '洗', '时'];
  const ids = ['hammer', 'swap', 'shuffle', 'time'];
  ctx.font = '14px sans-serif';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < ids.length; i++) {
    ctx.fillStyle = '#3e2723';
    roundRect(ctx, x + i * (size + 8), y, size, size, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + i * (size + 8) + size / 2, y + size / 2 + 4);
    ctx.font = '12px sans-serif';
    ctx.fillText('x' + (props[ids[i]] || 0), x + i * (size + 8) + size / 2, y + size - 4);
    ctx.font = '14px sans-serif';
  }
}

// 大厅按钮布局（与 main.js 命中共用）
function lobbyButtons(w, h) {
  return {
    normal: { x: w / 2 - 110, y: h * 0.4, w: 220, h: 70 },
    elite: { x: w / 2 - 110, y: h * 0.4 + 80, w: 220, h: 70 },
    adProp: { x: 20, y: h - 100, w: 140, h: 44 },
    share: { x: 170, y: h - 100, w: 140, h: 44 },
  };
}

// 道具栏第 i 个格子的命中区域（与 drawPropBar 渲染一致）
function propBarRect(i, h) {
  const size = 46, gap = 8, x0 = 16, y0 = h - 56;
  return { x: x0 + i * (size + gap), y: y0, w: size, h: size };
}

// 大厅
function drawLobby(ctx, w, h, state) {
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, w, h);
  const btns = lobbyButtons(w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('三国消消乐', w / 2, h * 0.2);
  ctx.font = '20px sans-serif';
  ctx.fillText('普通关 第' + state.currentLevel + '关', w / 2, h * 0.3);

  // 右上角解锁预告（下一个要解锁的故事）
  const preview = levels.getUnlockPreview(state.currentLevel);
  if (preview) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffca28';
    ctx.textAlign = 'right';
    ctx.fillText('第' + preview.level + '关解锁「' + (story.getStory(preview.storyId) || { name: '' }).name + '」', w - 16, 34);
    ctx.textAlign = 'center';
  }

  // 普通开始
  ctx.fillStyle = '#ffca28';
  roundRect(ctx, btns.normal.x, btns.normal.y, btns.normal.w, btns.normal.h, 12);
  ctx.fill();
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('开始闯关', w / 2, btns.normal.y + btns.normal.h / 2);

  // 精英模式
  ctx.fillStyle = '#ff7043';
  roundRect(ctx, btns.elite.x, btns.elite.y, btns.elite.w, btns.elite.h, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('精英模式 第' + state.eliteLevel + '关', w / 2, btns.elite.y + btns.elite.h / 2);

  // 广告得道具 / 分享得道具
  ctx.fillStyle = '#1b5e20';
  roundRect(ctx, btns.adProp.x, btns.adProp.y, btns.adProp.w, btns.adProp.h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('广告得道具', btns.adProp.x + btns.adProp.w / 2, btns.adProp.y + btns.adProp.h / 2);
  ctx.fillStyle = '#1b5e20';
  roundRect(ctx, btns.share.x, btns.share.y, btns.share.w, btns.share.h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('分享得道具', btns.share.x + btns.share.w / 2, btns.share.y + btns.share.h / 2);

  drawStamina(ctx, state.stamina, 20, h - 20);
}

// 结算
function drawResult(ctx, w, h, res) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(res.win ? '过关！' : '时间到', w / 2, h * 0.35);
  ctx.font = '22px sans-serif';
  ctx.fillText('得分 ' + res.score + ' / 目标 ' + res.target, w / 2, h * 0.42);
  if (!res.win) {
    ctx.font = '18px sans-serif';
    ctx.fillText('看广告续命 15 秒', w / 2, h * 0.5);
  }
  ctx.font = '18px sans-serif';
  ctx.fillText('点任意处返回', w / 2, h * 0.62);
}

module.exports = { drawTile, drawBoard, drawHUD, drawStamina, drawPropBar, drawLobby, drawResult, tileColor, roundRect, lobbyButtons, propBarRect };
