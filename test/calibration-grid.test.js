import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrationTargets } from '../js/calibration-grid.js';

test('has 16 targets indexed 0-15 in row-major order', () => {
  const targets = calibrationTargets();
  assert.equal(targets.length, 16);
  assert.deepEqual(targets.map((t) => t.index), [...Array(16).keys()]);
});

test('is a 4x4 grid evenly spaced from 0.1 to 0.9 on each axis', () => {
  const targets = calibrationTargets();
  const axis = [0.1, 0.367, 0.633, 0.9];
  targets.forEach((t, i) => {
    assert.equal(t.x, axis[i % 4]);
    assert.equal(t.y, axis[Math.floor(i / 4)]);
  });
});

test('every coordinate is strictly inside the viewport', () => {
  for (const t of calibrationTargets()) {
    assert.ok(t.x > 0 && t.x < 1 && t.y > 0 && t.y < 1);
  }
});
