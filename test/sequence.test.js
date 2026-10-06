import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playSequence } from '../js/sequence.js';

test('plays items in order, starting each only after the previous finished', async () => {
  const log = [];
  await playSequence([1, 2, 3], async (n) => {
    log.push(`start ${n}`);
    await Promise.resolve();
    log.push(`end ${n}`);
  });
  assert.deepEqual(log, ['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
});

test('resolves true when every item played', async () => {
  assert.equal(await playSequence([1, 2], async () => {}), true);
});

test('stops and resolves false when aborted mid-sequence', async () => {
  const ctrl = new AbortController();
  const seen = [];
  const done = await playSequence([1, 2, 3], async (n) => {
    seen.push(n);
    if (n === 2) ctrl.abort();
  }, ctrl.signal);
  assert.equal(done, false);
  assert.deepEqual(seen, [1, 2]);
});

test('does not start if already aborted', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  const seen = [];
  assert.equal(await playSequence([1], async (n) => seen.push(n), ctrl.signal), false);
  assert.deepEqual(seen, []);
});
