const config = require('./config');
const levels = require('./levels');
const story = require('./story');
const { chOf, specialOf } = require('./tile');

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

// 特殊块角标
const SPECIAL_LABELS = { row: '横', col: '纵', bomb: '爆', rainbow: '虹' };

function drawTile(ctx, x, y, size, t) {
  const ch = chOf(t);
  const sp = specialOf(t);
  const color = tileColor(ch);
  ctx.fillStyle = color;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.floor(size * 0.52) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x + size / 2, y + size / 2 + 2);
  if (sp) {
    // 特殊块：金色边框 + 角标
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 5);
    ctx.stroke();
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold ' + Math.floor(size * 0.3) + 'px sans-serif';
    ctx.fillText(SPECIAL_LABELS[sp] || '★', x + size * 0.72, y + size * 0.24);
  }
}

// anim（可选）：{ posMap: {'r,c': {r,c}} 覆盖绘制位置（小数坐标=滑动插值）, shrink: {'r,c': scale} 缩放, flash: Set<'r,c'> 白闪 }
function drawBoard(ctx, grid, ox, oy, size, anim) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      const ch = grid[r][c];
      if (ch === null) continue;
      const key = r + ',' + c;
      let pr = r, pc = c;
      if (anim && anim.posMap && anim.posMap[key]) {
        pr = anim.posMap[key].r;
        pc = anim.posMap[key].c;
      }
      let scale = 1, flash = false;
      if (anim && anim.shrink && anim.shrink[key] !== undefined) scale = anim.shrink[key];
      if (anim && anim.flash && anim.flash.has(key)) flash = true;
      const x = ox + pc * size, y = oy + pr * size;
      if (scale !== 1) {
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(x + size / 2), -(y + size / 2));
        drawTile(ctx, x, y, size, ch);
        ctx.restore();
      } else {
        drawTile(ctx, x, y, size, ch);
      }
      if (flash) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 6);
        ctx.fill();
      }
    }
  }
}

function drawHUD(ctx, opts, w) {
  // 顶部：关卡/模式/目标/时间
  ctx.fillStyle = '#4e342e';
  ctx.font = 'bold 22px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const label = (opts.mode === 'elite' ? '精英 ' : '') + '第' + opts.level + '关';
  ctx.fillText(label, 16, 34);
  ctx.textAlign = 'center';
  if (opts.goalType === 'collect') {
    ctx.fillText('收集「' + opts.goalChar + '」 ' + opts.goalProgress + '/' + opts.goalCount, w / 2, 34);
  } else if (opts.goalType === 'phrase') {
    ctx.fillText('短语 ' + opts.goalProgress + '/' + opts.goalCount, w / 2, 34);
  } else {
    ctx.fillText('目标 ' + opts.targetScore, w / 2, 34);
  }
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

// 大厅按钮布局（与 main.js 命中共用）；广告/分享入口已移到对局界面
function lobbyButtons(w, h) {
  return {
    normal: { x: w / 2 - 110, y: h * 0.52, w: 220, h: 64 },
    elite: { x: w / 2 - 110, y: h * 0.52 + 80, w: 220, h: 56 },
  };
}

// 大厅进度：里程碑区间插值 fill，以及里程碑刻度（最多显示到下一个解锁关，最多 4 个）
function lobbyProgress(level) {
  const unlock = levels.UNLOCK;
  let prev = 0;
  let next = null;
  for (const u of unlock) {
    if (u.level <= level) prev = u.level;
    else { next = u.level; break; }
  }
  const denom = (next || prev + 1) - prev || 1;
  const fill = Math.max(0, Math.min(1, (level - prev) / denom));
  let ticks = unlock.map(u => u.level).filter(L => next === null || L <= next);
  if (ticks.length > 4) ticks = ticks.slice(ticks.length - 4);
  return { fill, ticks, prev, next };
}

// 对局界面：棋盘下方空闲区的广告/分享按钮（窄屏空间不足时隐藏，不遮挡棋盘与道具栏）
function playingAdBtns(w, h) {
  const propY = h - 56; // 道具栏顶
  const boardPx = Math.floor(Math.min(w, h * 0.66));
  const tile = Math.floor(boardPx / config.BOARD_COLS);
  const boardBottom = 90 + tile * config.BOARD_ROWS; // 与 main.js 棋盘布局公式一致
  const avail = propY - boardBottom - 8;
  const bw = Math.min(150, Math.floor((w - 30 - 10) / 2));
  const bh = 40;
  if (avail < bh) return { hidden: true, adProp: null, share: null };
  const total = bw * 2 + 10;
  const x = Math.floor((w - total) / 2);
  const y = boardBottom + 4 + Math.floor((avail - 4 - bh) / 2);
  return {
    hidden: false,
    adProp: { x, y, w: bw, h: bh },
    share: { x: x + bw + 10, y, w: bw, h: bh },
  };
}

function drawAdBtn(ctx, rect, label, c1, c2, textColor) {
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawPlayingAdBtns(ctx, w, h) {
  const btns = playingAdBtns(w, h);
  if (btns.hidden) return;
  drawAdBtn(ctx, btns.adProp, '广告', '#ffd54f', '#ffb300', '#5d4037');
  drawAdBtn(ctx, btns.share, '分享', '#4fc3f7', '#039be5', '#fff');
}

// 道具栏第 i 个格子的命中区域（与 drawPropBar 渲染一致）
function propBarRect(i, h) {
  const size = 46, gap = 8, x0 = 16, y0 = h - 56;
  return { x: x0 + i * (size + gap), y: y0, w: size, h: size };
}

// 大厅（水墨纸卷风）
let lobbyBgCache = null; // 背景渐变缓存（屏幕尺寸固定，避免每帧重建）

function drawLobby(ctx, w, h, state) {
  // 背景：米白宣纸渐变（缓存复用）
  if (!lobbyBgCache) lobbyBgCache = ctx.createLinearGradient(0, 0, 0, h);
  ctx.fillStyle = lobbyBgCache;
  ctx.fillRect(0, 0, w, h);

  // 底部远山墨影（纯装饰，不响应点击）
  const hill = ctx.createLinearGradient(0, h * 0.62, 0, h);
  hill.addColorStop(0, 'rgba(58,75,65,0)');
  hill.addColorStop(1, 'rgba(58,75,65,0.38)');
  ctx.fillStyle = hill;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(58,75,65,0.85)';
  roundRect(ctx, 0, h - 36, w, 36, 18);
  ctx.fill();

  // 标题：墨色大字，逐字拉开字距
  ctx.fillStyle = '#2c2c28';
  ctx.font = 'bold 42px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const title = '三国消消乐';
  const step = 46;
  let tx = w / 2 - (title.length * step - 10) / 2;
  const ty = h * 0.16;
  for (const ch of title) {
    ctx.fillText(ch, tx, ty);
    tx += step;
  }
  // 右上角朱砂印章「汉」（旋转 6° 装饰）
  ctx.save();
  ctx.translate(w * 0.74, h * 0.135);
  ctx.rotate(6 * Math.PI / 180);
  ctx.fillStyle = '#b23a2e';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('汉', 0, 0);
  ctx.restore();
  // 标题下渐隐横线
  const line = ctx.createLinearGradient(w / 2 - 90, 0, w / 2 + 90, 0);
  line.addColorStop(0, 'rgba(107,106,96,0)');
  line.addColorStop(0.5, 'rgba(107,106,96,0.7)');
  line.addColorStop(1, 'rgba(107,106,96,0)');
  ctx.fillStyle = line;
  ctx.fillRect(w / 2 - 90, h * 0.16 + 34, 180, 2);

  // 体力：左上角胶囊标签（纯显示，不可点）
  const stText = '体力 ' + state.stamina + '/' + config.STAMINA_MAX;
  ctx.font = '12px sans-serif';
  const tw = ctx.measureText(stText).width;
  const sx = 12, sy = 12, sw = tw + 22, sh = 24;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, sx, sy, sw, sh, sh / 2);
  ctx.fill();
  ctx.strokeStyle = '#c9b896';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#5a5240';
  ctx.textAlign = 'left';
  ctx.fillText(stText, sx + 11, sy + sh / 2 + 1);

  // 关卡进度 + 进度条 + 里程碑刻度
  const prog = lobbyProgress(state.currentLevel);
  const labelY = h * 0.3;
  ctx.fillStyle = '#6b6a60';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('关卡进度 · 第' + state.currentLevel + '关', 24, labelY);
  const bx = 24, bw = w - 48, barY = labelY + 18;
  ctx.fillStyle = '#d8cdb4';
  roundRect(ctx, bx, barY, bw, 9, 5);
  ctx.fill();
  if (prog.fill > 0) {
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#4a4a44');
    fg.addColorStop(1, '#6b6a60');
    ctx.fillStyle = fg;
    roundRect(ctx, bx, barY, Math.max(9, bw * prog.fill), 9, 5);
    ctx.fill();
  }
  const span = prog.next || Math.max(prog.prev, 100);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#9a927e';
  ctx.textAlign = 'center';
  for (const t of prog.ticks) {
    const x = bx + (t / span) * bw;
    ctx.fillText(String(t), Math.max(bx + 10, Math.min(bx + bw - 10, x)), barY + 9 + 12);
  }

  // 解锁预告小牌（下一个未解锁的故事，复用 levels.getUnlockPreview + story.getStory）
  const preview = levels.getUnlockPreview(state.currentLevel);
  if (preview) {
    const st = story.getStory(preview.storyId);
    const text = '下一关 · 第' + preview.level + '关解锁「' + (st ? st.name : preview.storyId) + '」';
    const py = barY + 34;
    ctx.fillStyle = '#fffdf6';
    roundRect(ctx, bx, py, bw, 32, 5);
    ctx.fill();
    ctx.strokeStyle = '#c9b896';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#b23a2e';
    ctx.fillRect(bx, py, 4, 32); // 朱砂红左边条
    ctx.fillStyle = '#7a5c1e';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 12, py + 16 + 1);
  }

  // 按钮
  const btns = lobbyButtons(w, h);
  // 「开始闯关」：朱砂红渐变 + 下投影 3px
  const nb = btns.normal;
  ctx.fillStyle = 'rgba(138,43,33,0.45)';
  roundRect(ctx, nb.x, nb.y + 4, nb.w, nb.h, 12);
  ctx.fill();
  const ng = ctx.createLinearGradient(0, nb.y, 0, nb.y + nb.h);
  ng.addColorStop(0, '#d1493b');
  ng.addColorStop(1, '#b23a2e');
  ctx.fillStyle = ng;
  roundRect(ctx, nb.x, nb.y, nb.w, nb.h, 12);
  ctx.fill();
  ctx.fillStyle = '#fff5ec';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始闯关', w / 2, nb.y + nb.h / 2);
  // 「精英模式」：半透明白底 + 墨灰描边
  const eb = btns.elite;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, eb.x, eb.y, eb.w, eb.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#9a927e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#4a4a44';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('精英模式 · 第' + state.eliteLevel + '关', w / 2, eb.y + eb.h / 2);
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
  const sub = res.goalText || ('得分 ' + res.score + ' / 目标 ' + res.target);
  ctx.fillText(sub, w / 2, h * 0.42);
  if (!res.win) {
    ctx.font = '18px sans-serif';
    ctx.fillText('看广告续命 15 秒', w / 2, h * 0.5);
  }
  ctx.font = '18px sans-serif';
  ctx.fillText('点任意处返回', w / 2, h * 0.62);
}

module.exports = { drawTile, drawBoard, drawHUD, drawStamina, drawPropBar, drawLobby, drawResult, drawPlayingAdBtns, tileColor, roundRect, lobbyButtons, propBarRect, playingAdBtns, lobbyProgress };
