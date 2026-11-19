import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackVersion } from '../js/service/version.js';

test('falls back to the highest version the service supports below the refused one', () => {
  assert.equal(fallbackVersion([1, 2], 3), 2);
  assert.equal(fallbackVersion([1, 2, 5], 3), 2);
  assert.equal(fallbackVersion([1], 3), 1);
});

test('no lower version means no fallback', () => {
  assert.equal(fallbackVersion([3, 4], 3), null);
  assert.equal(fallbackVersion([], 3), null);
});

test('a missing or malformed supported list means no fallback', () => {
  assert.equal(fallbackVersion(undefined, 3), null);
  assert.equal(fallbackVersion(null, 3), null);
  assert.equal(fallbackVersion('1,2', 3), null);
  assert.equal(fallbackVersion([0, -1, 'x', 1.5], 3), null);
});
