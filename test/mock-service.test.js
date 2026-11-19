import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockService } from '../js/service/mock-service.js';
import { makePassage } from '../js/reading/passage.js';

const GRID = [0.1, 0.1 + 0.8 / 3, 0.1 + 1.6 / 3, 0.9];
const PASSAGE = makePassage(['ab', 'cd']);
const CELLS = [0, 1].flatMap((row) => [0, 1].map((col) => ({ row, col, x: col * 0.5, y: row * 0.5, w: 0.5, h: 0.5 })));

/** Plays hello, layout and a full calibration; resolves with every message the mock sent. */
async function calibrated(version) {
  const sent = [];
  const mock = new MockService(PASSAGE, (msg) => sent.push(msg), () => {});
  mock.receive({ type: 'hello', version, token: 'mock-token' });
  mock.receive({ type: 'layout', viewport: { width: 1000, height: 800 }, cells: CELLS });
  let t = 0;
  for (const y of GRID) {
    for (const x of GRID) {
      for (let i = 0; i < 20; i++) mock.receive({ type: 'frame', t: (t += 33), target: { x, y } });
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearTimeout(mock.timer);
  return { mock, sent, t };
}

const readyStatus = (sent) => sent.find((m) => m.type === 'calibration_status' && m.outcome === 'ready');

async function startReading(version) {
  const { mock, sent, t: t0 } = await calibrated(version);
  mock.receive({ type: 'calibration_done' });
  mock.pointer = { x: 0.2, y: 0.3 };            // on Cell (0, 0)
  let t = t0;
  for (let i = 0; i < 10; i++) mock.receive({ type: 'frame', t: (t += 33) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  clearTimeout(mock.timer);
  return sent.find((m) => m.type === 'reading_started');
}

test('the mock accepts version 3', async () => {
  const { sent } = await calibrated(3);
  assert.deepEqual(sent[0], { type: 'hello_ack', version: 3, supported: [1, 2, 3] });
});

test('on version 3 a ready calibration carries a calibration error', async () => {
  const { sent } = await calibrated(3);
  assert.equal(typeof readyStatus(sent).calibration_error_px, 'number');
});

for (const version of [1, 2]) {
  test(`on version ${version} the mock sends no version 3 fields`, async () => {
    const { sent } = await calibrated(version);
    assert.equal('calibration_error_px' in readyStatus(sent), false);
    assert.deepEqual(await startReading(version), { type: 'reading_started' });
  });
}

test('on version 3 reading_started carries the pointer as the gaze', async () => {
  assert.deepEqual(await startReading(3), { type: 'reading_started', gaze: { x: 0.2, y: 0.3 } });
});
