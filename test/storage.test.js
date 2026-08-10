const { test } = require('node:test');
const assert = require('node:assert');

const store = {};
global.wx = {
  getStorageSync: k => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: k => { delete store[k]; },
};

const storage = require('../js/storage');

test('load returns defaults on empty storage', () => {
  const s = storage.load();
  assert.strictEqual(s.currentLevel, 1);
  assert.strictEqual(s.stamina, 30);
  assert.deepStrictEqual(s.props, { hammer: 0, swap: 0, shuffle: 0, time: 0 });
});

test('save then load round-trips', () => {
  storage.save({ currentLevel: 7, eliteLevel: 2, stamina: 12, staminaTs: 0, unlocked: { taoyuan: { awakened: true } }, props: { hammer: 2, swap: 0, shuffle: 1, time: 0 }, daily: { date: 'x', adsStamina: 1, adsProp: 0, share: 0 }, highScores: {} });
  const s = storage.load();
  assert.strictEqual(s.currentLevel, 7);
  assert.strictEqual(s.props.hammer, 2);
  assert.strictEqual(s.unlocked.taoyuan.awakened, true);
});
