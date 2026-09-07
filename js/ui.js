const config = require('./config');
const levels = require('./levels');
const story = require('./story');
const skills = require('./skills');
const heroes = require('./heroes');
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
    codex: { x: w - 112, y: h - 66, w: 92, h: 44 },
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

// enter: 入场动画进度（0~1，smoothstep 已缓动）。1 表示完全进入。
function drawLobby(ctx, w, h, state, enter = 1) {
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

  // 标题：墨色大字，逐字拉开字距（入场从上滑入）
  ctx.globalAlpha = enter;
  ctx.fillStyle = '#2c2c28';
  ctx.font = 'bold 42px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const title = '三国消消乐';
  const step = 46;
  let tx = w / 2 - (title.length * step - 10) / 2;
  const ty = h * 0.16 - (1 - enter) * 44;
  for (const ch of title) {
    ctx.fillText(ch, tx, ty);
    tx += step;
  }
  // 右上角朱砂印章「汉」（旋转 6°，入场延迟浮现）
  const enter2 = Math.max(0, Math.min(1, (enter - 0.35) / 0.65));
  ctx.save();
  ctx.translate(w * 0.74, h * 0.135);
  ctx.rotate(6 * Math.PI / 180);
  ctx.fillStyle = '#b23a2e';
  ctx.font = 'bold 15px sans-serif';
  ctx.globalAlpha = enter * enter2;
  ctx.fillText('汉', 0, 0);
  ctx.restore();
  ctx.globalAlpha = enter;
  // 标题下渐隐横线
  const line = ctx.createLinearGradient(w / 2 - 90, 0, w / 2 + 90, 0);
  line.addColorStop(0, 'rgba(107,106,96,0)');
  line.addColorStop(0.5, 'rgba(107,106,96,0.7)');
  line.addColorStop(1, 'rgba(107,106,96,0)');
  ctx.fillStyle = line;
  ctx.fillRect(w / 2 - 90, ty + 34, 180, 2);

  // 体力：左上角胶囊标签（纯显示，不可点；入场下滑）
  const stText = '体力 ' + state.stamina + '/' + config.STAMINA_MAX;
  ctx.font = '12px sans-serif';
  const tw = ctx.measureText(stText).width;
  const sx = 12, sy = 12 - (1 - enter) * 12, sw = tw + 22, sh = 24;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, sx, sy, sw, sh, sh / 2);
  ctx.fill();
  ctx.strokeStyle = '#c9b896';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#5a5240';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(stText, sx + 11, sy + sh / 2 + 1);
  // 体力回复倒计时（未满时显示）
  if (state.stamina < config.STAMINA_MAX && state.staminaTs) {
    const remain = config.STAMINA_REFILL_MS - ((Date.now() - state.staminaTs) % config.STAMINA_REFILL_MS);
    const mm = Math.floor(remain / 60000), ss = Math.floor((remain % 60000) / 1000);
    ctx.font = '11px sans-serif';
    ctx.fillText('满体力 ' + mm + ':' + ss, sx + 11, sy + sh / 2 + 16);
  }
  ctx.globalAlpha = 1;

  // 关卡进度 + 进度条 + 里程碑刻度
  const prog = lobbyProgress(state.currentLevel);
  const labelY = h * 0.3 + (1 - enter) * 16;
  ctx.globalAlpha = enter;
  ctx.fillStyle = '#6b6a60';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('关卡进度 · 第' + state.currentLevel + '关', 24, labelY);
  // 已解锁故事数（进入页面信息增强）
  const unlockedCount = state.unlocked ? Object.keys(state.unlocked).length : 0;
  ctx.textAlign = 'right';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9a927e';
  ctx.fillText('已解锁 ' + unlockedCount + ' 个故事', w - 24, labelY);
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

  // 解锁预告小牌（下一个要解锁的武将；复用 levels.getUnlockPreview）
  const preview = levels.getUnlockPreview(state.currentLevel);
  if (preview) {
    const hus = heroes.heroesForStory(preview.storyId);
    const names = hus.map(h => h.name).join('、');
    const text = '下一关 · 第' + preview.level + '关解锁「' + (names || '新武将') + '」';
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

  // 按钮（入场从下方上浮）
  const btns = lobbyButtons(w, h);
  const rise = (1 - enter) * 30;
  // 「开始闯关」：朱砂红渐变 + 下投影 3px
  const nb = { x: btns.normal.x, y: btns.normal.y + rise, w: btns.normal.w, h: btns.normal.h };
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
  const eb = { x: btns.elite.x, y: btns.elite.y + rise, w: btns.elite.w, h: btns.elite.h };
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, eb.x, eb.y, eb.w, eb.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#9a927e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#4a4a44';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('精英模式 · 第' + state.eliteLevel + '关', w / 2, eb.y + eb.h / 2);
  // 图鉴按钮（右下角）
  const cb = btns.codex;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(ctx, cb.x, cb.y, cb.w, cb.h, 10);
  ctx.fill();
  ctx.strokeStyle = '#9a927e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#4a4a44';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('图鉴', cb.x + cb.w / 2, cb.y + cb.h / 2);
  ctx.globalAlpha = 1;
}

// 故事关开场剧情：全屏纸卷卡片，展示故事名 / 剧情一句话 / 该故事字块预览
function drawStoryIntro(ctx, w, h, story, level, mode) {
  if (!story) return;
  ctx.fillStyle = 'rgba(20,25,20,0.86)';
  ctx.fillRect(0, 0, w, h);
  const cw = Math.min(w - 60, 330), ch = 348;
  const cx = (w - cw) / 2, cy = (h - ch) / 2 - 12;
  // 卡片
  const g = ctx.createLinearGradient(0, cy, 0, cy + ch);
  g.addColorStop(0, '#f5eddc');
  g.addColorStop(1, '#efe2c8');
  ctx.fillStyle = g;
  roundRect(ctx, cx, cy, cw, ch, 14);
  ctx.fill();
  ctx.strokeStyle = '#c9b896';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 顶部朱砂红条
  ctx.fillStyle = '#b23a2e';
  roundRect(ctx, cx + 20, cy, cw - 40, 6, 3);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 标题
  ctx.fillStyle = '#b23a2e';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(story.name, w / 2, cy + 58);
  // 剧情一句话
  ctx.fillStyle = '#4a4a44';
  ctx.font = '17px sans-serif';
  ctx.fillText(story.intro, w / 2, cy + 108);
  // 分隔线
  ctx.strokeStyle = 'rgba(154,146,126,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 30, cy + 138);
  ctx.lineTo(cx + cw - 30, cy + 138);
  ctx.stroke();
  // 故事字块预览
  const size = 52, gap = 10;
  const total = story.chars.length * size + (story.chars.length - 1) * gap;
  let tx0 = w / 2 - total / 2;
  const ty = cy + 196;
  for (const ch of story.chars) {
    drawTile(ctx, tx0, ty, size, ch);
    tx0 += size + gap;
  }
  // 提示
  ctx.fillStyle = '#5a5240';
  ctx.font = '15px sans-serif';
  const lv = (mode === 'elite' ? '精英 ' : '') + '第' + level + '关';
  ctx.fillText(lv + ' · 点击进入战场', w / 2, cy + ch - 30);
}

// 图鉴布局：返回按钮 + 12 个故事卡片网格（4 列）
function codexLayout(w, h) {
  const cols = 4, gap = 10, margin = 14;
  const cardW = Math.floor((w - margin * 2 - gap * (cols - 1)) / cols);
  const cardH = 100;
  const cards = [];
  for (let i = 0; i < 12; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    cards.push({ x: margin + c * (cardW + gap), y: 96 + r * (cardH + gap), w: cardW, h: cardH });
  }
  return { back: { x: 12, y: 14, w: 60, h: 34 }, cards };
}

function codexCardAt(tx, ty, layout) {
  for (let i = 0; i < layout.cards.length; i++) {
    const r = layout.cards[i];
    if (tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h) return i;
  }
  return -1;
}

// 图鉴主界面
function drawCodex(ctx, w, h, save) {
  // 背景
  if (!lobbyBgCache) lobbyBgCache = ctx.createLinearGradient(0, 0, 0, h);
  ctx.fillStyle = lobbyBgCache;
  ctx.fillRect(0, 0, w, h);
  // 底部远山墨影
  const hill = ctx.createLinearGradient(0, h * 0.62, 0, h);
  hill.addColorStop(0, 'rgba(58,75,65,0)');
  hill.addColorStop(1, 'rgba(58,75,65,0.38)');
  ctx.fillStyle = hill;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(58,75,65,0.85)';
  roundRect(ctx, 0, h - 36, w, 36, 18);
  ctx.fill();
  // 标题
  ctx.fillStyle = '#2c2c28';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('三国图鉴', w / 2, 40);
  // 返回按钮
  const layout = codexLayout(w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, layout.back.x, layout.back.y, layout.back.w, layout.back.h, 8);
  ctx.fill();
  ctx.strokeStyle = '#c9b896';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#5a5240';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('‹ 返回', layout.back.x + layout.back.w / 2, layout.back.y + layout.back.h / 2 + 1);
  // 解锁/收集进度
  const unlockedCount = save.unlocked ? Object.keys(save.unlocked).length : 0;
  const heroCount = save.heroes ? Object.keys(save.heroes).length : 0;
  ctx.fillStyle = '#9a927e';
  ctx.font = '13px sans-serif';
  ctx.fillText('已解锁故事 ' + unlockedCount + ' / 12 · 已招揽武将 ' + heroCount + ' / ' + heroes.HERO_LIST.length, w / 2, 68);
  const unlockList = levels.UNLOCK;
  for (let i = 0; i < layout.cards.length; i++) {
    const card = layout.cards[i];
    const storyId = unlockList[i].storyId;
    const s = story.getStory(storyId);
    const unlocked = save.unlocked[storyId];
    if (unlocked) {
      // 已解锁：米白卡
      ctx.fillStyle = '#fffdf6';
      roundRect(ctx, card.x, card.y, card.w, card.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#c9b896';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#4a4a44';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(s.name, card.x + card.w / 2, card.y + card.h * 0.36);
      // 字块小预览
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#8a6d3b';
      ctx.fillText(s.chars.slice(0, 3).join(''), card.x + card.w / 2, card.y + card.h * 0.62);
      // 状态角标
      if (unlocked.awakened) {
        ctx.fillStyle = '#b23a2e';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('觉醒', card.x + card.w / 2, card.y + card.h - 12);
      } else {
        ctx.fillStyle = '#2e7d32';
        ctx.font = '11px sans-serif';
        ctx.fillText('已解锁', card.x + card.w / 2, card.y + card.h - 12);
      }
    } else {
      // 未解锁：深灰卡 + 问号
      ctx.fillStyle = 'rgba(90,82,64,0.18)';
      roundRect(ctx, card.x, card.y, card.w, card.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#b8ac94';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#a69c86';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('???', card.x + card.w / 2, card.y + card.h * 0.42);
      ctx.font = '11px sans-serif';
      ctx.fillText('未解锁', card.x + card.w / 2, card.y + card.h - 12);
    }
  }
}

// 图鉴详情弹层：以武将及其技能为主体（故事名仅为关卡背景），下方为故事的初始/觉醒技能（保留故事短语玩法）
function drawCodexDetail(ctx, w, h, storyId, save) {
  const s = story.getStory(storyId);
  const unlocked = save.unlocked[storyId];
  if (!s) return;
  const hus = heroes.heroesForStory(storyId);
  // 相对卡片顶的 Y（先算好，后据此定卡片高度）
  const pad = 32;
  const titleY = pad + 14;          // 故事名（小标题/背景）
  const introY = titleY + 32;
  const tilesY = introY + 40;
  const sepY = tilesY + 52;
  const heroLabelY = sepY + 20;     // 「武将」
  const hero0Y = heroLabelY + 28;
  const heroEnd = hero0Y + hus.length * 30;
  const sep2Y = heroEnd + 14;
  const skill0Y = sep2Y + 22;       // 故事初始技能
  const skill1Y = skill0Y + 84;     // 故事觉醒技能
  const hintY = skill1Y + 84;
  const ch = Math.min(h - 24, hintY + pad);
  const cy = Math.max(12, (h - ch) / 2 - 6);
  const cw = Math.min(w - 40, 350);
  const cx = (w - cw) / 2;
  // 遮罩
  ctx.fillStyle = 'rgba(20,25,20,0.86)';
  ctx.fillRect(0, 0, w, h);
  // 卡片
  const g = ctx.createLinearGradient(0, cy, 0, cy + ch);
  g.addColorStop(0, '#f5eddc');
  g.addColorStop(1, '#efe2c8');
  ctx.fillStyle = g;
  roundRect(ctx, cx, cy, cw, ch, 14);
  ctx.fill();
  ctx.strokeStyle = '#c9b896';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // 故事名（小标题）
  ctx.fillStyle = '#8a6d3b';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(s.name, w / 2, cy + titleY);
  // intro
  ctx.fillStyle = '#6b6a60';
  ctx.font = '13px sans-serif';
  ctx.fillText(s.intro, w / 2, cy + introY);
  // 字块预览
  const size = 40, gap = 8;
  const total = s.chars.length * size + (s.chars.length - 1) * gap;
  let tx0 = w / 2 - total / 2;
  for (const ch of s.chars) {
    drawTile(ctx, tx0, cy + tilesY, size, ch);
    tx0 += size + gap;
  }
  // 分隔线
  ctx.strokeStyle = 'rgba(154,146,126,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 24, cy + sepY);
  ctx.lineTo(cx + cw - 24, cy + sepY);
  ctx.stroke();
  // 武将为主体：每位一行「名字 · 绝技词 · 技能名」（未招揽 ??? · 待招揽）
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4a4a44';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('武将技能', cx + 22, cy + heroLabelY);
  let hy = cy + hero0Y;
  for (const hero of hus) {
    const got = save.heroes && save.heroes[hero.name];
    const aw = save.unlocked && save.unlocked[hero.storyId] && save.unlocked[hero.storyId].awakened;
    const skill = skills.SKILL_INFO[aw ? hero.awakenedSkill : hero.skill];
    if (got) {
      ctx.fillStyle = '#b23a2e';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(hero.name, cx + 24, hy);
      ctx.fillStyle = '#8a6d3b';
      ctx.font = '14px sans-serif';
      ctx.fillText('· ' + hero.skillWord, cx + 24 + ctx.measureText(hero.name).width + 6, hy);
      ctx.fillStyle = aw ? '#b23a2e' : '#2e7d32';
      ctx.font = '13px sans-serif';
      ctx.fillText('· ' + (skill ? skill.name : ''), cx + 24 + ctx.measureText(hero.name + ' · ' + hero.skillWord).width + 10, hy);
    } else {
      ctx.fillStyle = '#b8ac94';
      ctx.font = '15px sans-serif';
      ctx.fillText('??? · 待招揽', cx + 24, hy);
    }
    hy += 30;
  }
  // 分隔线
  ctx.strokeStyle = 'rgba(154,146,126,0.4)';
  ctx.beginPath();
  ctx.moveTo(cx + 24, cy + sep2Y);
  ctx.lineTo(cx + cw - 24, cy + sep2Y);
  ctx.stroke();
  // 故事的初始技能 / 觉醒技能（保留故事短语的背景）
  const ini = skills.SKILL_INFO[s.initialSkill];
  const awk = skills.SKILL_INFO[s.awakenedSkill];
  drawSkillBlock(ctx, cx, cy + skill0Y, cw, '故事·初始技能', ini.name, ini.desc, '#2e7d32');
  const awakened = unlocked && unlocked.awakened;
  drawSkillBlock(ctx, cx, cy + skill1Y, cw, '故事·觉醒技能', awk.name, awakened ? awk.desc : '通关对应精英关解锁', awakened ? '#b23a2e' : '#8a8a8a');
  // 提示
  ctx.fillStyle = '#5a5240';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('点击任意处返回', w / 2, cy + hintY);
}

function drawSkillBlock(ctx, cx, y, cw, label, name, desc, color) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(label, cx + 22, y);
  ctx.fillStyle = '#4a4a44';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(name, cx + 22, y + 28);
  ctx.fillStyle = '#6b6a60';
  ctx.font = '13px sans-serif';
  ctx.fillText(desc, cx + 22, y + 52);
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

module.exports = { drawTile, drawBoard, drawHUD, drawStamina, drawPropBar, drawLobby, drawStoryIntro, drawCodex, drawCodexDetail, drawResult, drawPlayingAdBtns, tileColor, roundRect, lobbyButtons, propBarRect, playingAdBtns, lobbyProgress, codexLayout, codexCardAt };
