const { test } = require('node:test');
const assert = require('node:assert');
const levels = require('../js/levels');

test('storyLevelFor maps milestones', () => {
  assert.strictEqual(levels.storyLevelFor(1).storyId, 'taoyuan');
  assert.strictEqual(levels.storyLevelFor(5).storyId, 'wenjiu');
  assert.strictEqual(levels.storyLevelFor(10).storyId, 'sanying');
  assert.strictEqual(levels.storyLevelFor(100).storyId, 'kongcheng');
  assert.strictEqual(levels.storyLevelFor(6), null);
});

test('getLevelConfig normal scales target and time', () => {
  const c1 = levels.getLevelConfig(1, 'normal');
  assert.strictEqual(c1.time, 180);
  assert.strictEqual(c1.targetScore, 800);
  assert.strictEqual(c1.storyId, 'taoyuan');
  const c3 = levels.getLevelConfig(3, 'normal');
  assert.strictEqual(c3.targetScore, 1100); // 800 + (3-1)*150
});

test('getLevelConfig elite shorter time and higher target', () => {
  const c1 = levels.getLevelConfig(1, 'elite');
  assert.strictEqual(c1.time, 40);
  assert.strictEqual(c1.targetScore, 1200); // 800 * 1.5
});

test('elite config works for a non-story level and default mode is normal', () => {
  const e3 = levels.getLevelConfig(3, 'elite');
  assert.strictEqual(e3.storyId, null);
  assert.strictEqual(e3.time, 40);
  assert.strictEqual(e3.targetScore, 1650); // (800 + 2*150) * 1.5 = 1100 * 1.5 = 1650
  const d = levels.getLevelConfig(3);
  assert.strictEqual(d.mode, 'normal');
  assert.strictEqual(d.time, 180);
});

test('getUnlockPreview shows next milestone after current level', () => {
  assert.deepStrictEqual(levels.getUnlockPreview(3), { level: 5, storyId: 'wenjiu' });
  assert.deepStrictEqual(levels.getUnlockPreview(40), { level: 50, storyId: 'sangu' });
  assert.strictEqual(levels.getUnlockPreview(100), null);
});
