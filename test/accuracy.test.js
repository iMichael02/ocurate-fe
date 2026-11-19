import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURSOR_TOLERANCE_CELLS, calibrationError, cellSizePx, cursorCheck, formatCells, pxToCells,
} from '../js/session/accuracy.js';

// Two Cells of 0.05 x 0.1 of a 1000 x 800 viewport: 50 px wide, 80 px tall.
const CELL = { row: 0, col: 0, x: 0.1, y: 0.2, w: 0.05, h: 0.1 };
const LAYOUT = {
  type: 'layout',
  viewport: { width: 1000, height: 800 },
  cells: [CELL, { row: 0, col: 1, x: 0.15, y: 0.2, w: 0.05, h: 0.1 }],
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('a Cell is measured in CSS px from the Layout', () => {
  const size = cellSizePx(LAYOUT.cells, LAYOUT.viewport);
  near(size.width, 50);
  near(size.height, 80);
});

test('no Layout gives no Cell size', () => {
  assert.equal(cellSizePx([], LAYOUT.viewport), null);
  assert.equal(cellSizePx(LAYOUT.cells, null), null);
});

test('px become Cells through the mean of the Cell width and height', () => {
  near(pxToCells(65, { width: 50, height: 80 }), 1);
  near(pxToCells(32.5, { width: 50, height: 80 }), 0.5);
});

test('the calibration error is shown in Cells and flagged when above one Cell', () => {
  const good = calibrationError(39, LAYOUT);
  near(good.cells, 0.6);
  assert.equal(good.px, 39);
  assert.equal(good.poor, false);

  assert.equal(calibrationError(130, LAYOUT).poor, true);
});

test('no calibration error from the service means none is shown', () => {
  assert.equal(calibrationError(undefined, LAYOUT), null);
  assert.equal(calibrationError(null, LAYOUT), null);
  assert.equal(calibrationError(40, null), null);
});

test('a zero error is a real figure, not a missing one', () => {
  assert.equal(calibrationError(0, LAYOUT).cells, 0);
});

test('the cursor check measures each axis in its own Cell size', () => {
  const cursor = { x: 0.125, y: 0.25 };            // middle of the first Cell
  // Half a Cell to the right (0.025) and half a Cell down (0.05).
  const gaze = { x: 0.15, y: 0.3 };
  near(cursorCheck({ gaze, cursor, cell: CELL }), Math.hypot(0.5, 0.5));
});

test('the gaze on the cursor gives zero', () => {
  const point = { x: 0.12, y: 0.24 };
  assert.equal(cursorCheck({ gaze: point, cursor: { ...point }, cell: CELL }), 0);
});

test('a cursor just outside the first Cell, within the tolerance, still counts', () => {
  const cursor = { x: CELL.x - 0.9 * CURSOR_TOLERANCE_CELLS * CELL.w, y: 0.25 };
  assert.notEqual(cursorCheck({ gaze: { x: 0.12, y: 0.25 }, cursor, cell: CELL }), null);
});

test('a cursor elsewhere is discarded, not reported as a distance', () => {
  const gaze = { x: 0.12, y: 0.25 };
  const right = { x: CELL.x + CELL.w + 1.1 * CURSOR_TOLERANCE_CELLS * CELL.w, y: 0.25 };
  const below = { x: 0.12, y: CELL.y + CELL.h + 1.1 * CURSOR_TOLERANCE_CELLS * CELL.h };
  assert.equal(cursorCheck({ gaze, cursor: right, cell: CELL }), null);
  assert.equal(cursorCheck({ gaze, cursor: below, cell: CELL }), null);
});

test('without a mouse sample or a gaze there is no cursor check', () => {
  const point = { x: 0.12, y: 0.25 };
  assert.equal(cursorCheck({ gaze: point, cursor: null, cell: CELL }), null);
  assert.equal(cursorCheck({ gaze: undefined, cursor: point, cell: CELL }), null);
  assert.equal(cursorCheck({ gaze: point, cursor: point, cell: null }), null);
});

test('figures read as about how many Cells', () => {
  assert.equal(formatCells(0.83), '≈ 0.8 Cells');
  assert.equal(formatCells(1.04), '≈ 1.0 Cell');
  assert.equal(formatCells(2), '≈ 2.0 Cells');
});
