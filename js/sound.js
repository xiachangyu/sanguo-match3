// 程序化音效合成（WebAudio），零音频资源、零依赖
// 特殊组合（四连/五连、故事短语、技能、连锁）各有专属音效；
// 故事相关音效使用中国风五声音阶（宫商角徵羽），贴合三国题材。
// 环境不支持 WebAudio 时静默降级（不影响游戏）。
let ctx = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  if (typeof wx === 'undefined' || !wx.createWebAudioContext) return null;
  try {
    ctx = wx.createWebAudioContext();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

// 首次触摸时调用，提前创建音频上下文（部分环境需要用户手势后音频才可用）
function unlock() {
  ensure();
}

// 尊重存档开关（settings.sound）
function setEnabled(v) {
  enabled = !!v;
}

// 播放一个振荡音：freq 频率 / delay 延迟秒 / dur 时长 / type 波形 / gain 音量
function tone(freq, delay, dur, type, gain) {
  const c = ensure();
  if (!c || !enabled) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t0 = c.currentTime + (delay || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) {
    // 合成失败静默
  }
}

// 中国风五声音阶（C 宫调）：宫 商 角 徵 羽
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];

// ---------- 背景音乐（BGM）：五声音阶舒缓循环，WebAudio 合成，音量低 ----------
let bgmTimer = null;
let bgmIdx = 0;
const BGM_SEQ = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66]; // 上行再下行

function startBgm() {
  if (bgmTimer) return;
  bgmIdx = 0;
  bgmTimer = setInterval(() => {
    tone(BGM_SEQ[bgmIdx % BGM_SEQ.length], 0, 0.35, 'triangle', 0.05);
    bgmIdx++;
  }, 460);
}

function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

const sfx = {
  tap() { tone(700, 0, 0.07, 'triangle', 0.12); },
  swap() { tone(320, 0, 0.07, 'sine', 0.15); tone(460, 0.05, 0.08, 'sine', 0.15); },
  match3() { tone(540, 0, 0.12, 'sine', 0.25); },
  match4() { tone(540, 0, 0.09, 'sine', 0.22); tone(720, 0.07, 0.13, 'sine', 0.22); },
  match5() { tone(540, 0, 0.08, 'sine', 0.2); tone(680, 0.06, 0.08, 'sine', 0.2); tone(900, 0.12, 0.16, 'sine', 0.2); },
  // 连锁：音高随级数递增，级数越高越急促
  cascade(level) { tone(480 + Math.min(level, 6) * 70, 0, 0.1, 'sine', 0.2); },
  // 故事短语：五声音阶上行，五个字依次点亮
  phrase() { PENTA.forEach((f, i) => tone(f, i * 0.07, 0.13, 'triangle', 0.2)); },
  // 技能：高八度快速琶音 + 收尾长音
  skill() { PENTA.forEach((f, i) => tone(f * 2, i * 0.05, 0.1, 'sine', 0.18)); tone(880, 0.28, 0.28, 'triangle', 0.22); },
  prop() { tone(620, 0, 0.06, 'square', 0.1); tone(930, 0.05, 0.1, 'square', 0.1); },
  // 每个武将不同音效：用名字生成不同音高序（"语音"为合成音，台词文案由 main 另显）
  heroVoice(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 1000;
    const base = 280 + (hash % 420);
    tone(base, 0, 0.11, 'square', 0.16);
    tone(base * 1.5, 0.09, 0.14, 'square', 0.16);
    tone(base * 2, 0.2, 0.18, 'sawtooth', 0.13);
    tone(base * 2.5, 0.34, 0.2, 'triangle', 0.12);
  },
  win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.24, 'triangle', 0.2)); },
  lose() { tone(392, 0, 0.2, 'sine', 0.18); tone(311.13, 0.18, 0.26, 'sine', 0.18); tone(261.63, 0.4, 0.32, 'sine', 0.18); },
};

module.exports = {
  unlock,
  setEnabled,
  startBgm,
  stopBgm,
  tap: sfx.tap,
  swap: sfx.swap,
  match3: sfx.match3,
  match4: sfx.match4,
  match5: sfx.match5,
  cascade: sfx.cascade,
  phrase: sfx.phrase,
  skill: sfx.skill,
  heroVoice: sfx.heroVoice,
  prop: sfx.prop,
  win: sfx.win,
  lose: sfx.lose,
};
