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

test('normalize resets daily counters on day change', () => {
  const s = storage.load();
  s.daily = { date: '2000-01-01', adsStamina: 5, adsProp: 3, share: 1, continueLevel: 1 };
  const normalized = storage.normalize(s);
  assert.notStrictEqual(normalized.daily.date, '2000-01-01');
  assert.strictEqual(normalized.daily.adsStamina, 0);
  assert.strictEqual(normalized.daily.share, 0);
});

test('normalize survives missing daily (corrupted save)', () => {
  const s = storage.load();
  delete s.daily;
  const normalized = storage.normalize(s);
  assert.ok(normalized.daily);
  assert.strictEqual(normalized.daily.adsStamina, 0);
});
