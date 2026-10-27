import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locateEyeCentre } from '../js/eye-centre.js';

// Golden crops copied from the service repo (tests/golden/eye_centre.json,
// produced by eye_centre.py). Copy again if the service's file changes.
const golden = JSON.parse(readFileSync(new URL('./golden/eye-centre.json', import.meta.url)));

for (const { name, crop, expected } of golden.cases) {
  test(`matches the service reference: ${name}`, () => {
    const { x, y, confidence } = locateEyeCentre(crop);
    assert.ok(Math.abs(x - expected.x) <= 1e-6, `x ${x} vs ${expected.x}`);
    assert.ok(Math.abs(y - expected.y) <= 1e-6, `y ${y} vs ${expected.y}`);
    assert.ok(Math.abs(confidence - expected.confidence) <= 1e-3, `confidence ${confidence} vs ${expected.confidence}`);
  });
}

test('rejects a crop that is not 20 rows of 40', () => {
  assert.throws(() => locateEyeCentre([[1, 2], [3, 4]]));
});
