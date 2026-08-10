const config = require('./config');

const KEY = 'sanguo_match3_save_v1';

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function defaultState() {
  return {
    currentLevel: 1,
    eliteLevel: 1,
    stamina: config.STAMINA_INITIAL,
    staminaTs: Date.now(),
    unlocked: {}, // storyId -> { awakened: boolean }
    props: { hammer: 0, swap: 0, shuffle: 0, time: 0 },
    daily: { date: today(), adsStamina: 0, adsProp: 0, share: 0, continueLevel: 0 },
    highScores: {},
    settings: { sound: true },
  };
}

// 跨天自动重置每日计数
function normalize(state) {
  const def = defaultState();
  const merged = Object.assign(def, state);
  if (merged.daily.date !== today()) {
    merged.daily = { date: today(), adsStamina: 0, adsProp: 0, share: 0, continueLevel: 0 };
  }
  return merged;
}

function load() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw) return defaultState();
    return normalize(raw);
  } catch (e) {
    return defaultState();
  }
}

function save(state) {
  try {
    wx.setStorageSync(KEY, normalize(state));
  } catch (e) {
    // 存储失败不阻塞游戏
  }
}

module.exports = { load, save, defaultState, normalize, today };
