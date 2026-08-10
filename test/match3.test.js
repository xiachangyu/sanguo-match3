const { test } = require('node:test');
const assert = require('node:assert');
const match3 = require('../js/match3');

test('smoke: match3 module loads', () => {
  assert.ok(typeof match3.findMatches === 'function');
});
