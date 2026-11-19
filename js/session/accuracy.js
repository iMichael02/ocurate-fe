// Gaze accuracy figures for the results (protocol version 3, the service's
// docs/websocket-protocol.md "Gaze accuracy"). No DOM, so it is unit tested in test/accuracy.test.js.
//
//   Calibration error: the service's held-out error in CSS px, shown as about how many Cells.
//   Cursor check:      the gaze at the start of reading (reading_started.gaze) against the mouse
//                      cursor, in Cells. Only when the cursor rested on the first Cell.

/** @typedef {{ x: number, y: number }} Point  viewport-normalized, 0–1 */
/** @typedef {{ row: number, col: number, x: number, y: number, w: number, h: number }} CellRect  as in `layout` */
/** @typedef {{ width: number, height: number }} Viewport  CSS px, as in `layout` */

// The cursor counts as resting on the first Cell within this many Cell widths/heights of it.
export const CURSOR_TOLERANCE_CELLS = 0.5;
// A calibration error above this many Cells means reading may often land on the wrong Cell.
export const POOR_ERROR_CELLS = 1;

/**
 * The size of one Cell in CSS px: the mean width and height of the Layout's rectangles.
 * @param {CellRect[]} cells
 * @param {Viewport} viewport
 * @returns {{ width: number, height: number } | null}
 */
export function cellSizePx(cells, viewport) {
  if (!cells?.length || !viewport) return null;
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    width: mean(cells.map((c) => c.w)) * viewport.width,
    height: mean(cells.map((c) => c.h)) * viewport.height,
  };
}

/**
 * A distance in CSS px as a number of Cells. The service sends a single distance, not its
 * direction, so it is divided by the mean of the Cell's width and height.
 * @param {number} px
 * @param {{ width: number, height: number }} cellSize
 */
export function pxToCells(px, cellSize) {
  return px / ((cellSize.width + cellSize.height) / 2);
}

/**
 * Cursor check: how far the gaze that started reading was from the mouse cursor, in Cells
 * (each axis in its own Cell size, so a tall Cell counts as one Cell either way).
 * Returns null, meaning "leave the line out", without both positions or when the cursor was not
 * on the first Cell (give or take CURSOR_TOLERANCE_CELLS), since then the Learner was probably
 * not looking at it.
 * @param {{ gaze?: Point | null, cursor?: Point | null, cell?: CellRect | null }} sample
 * @returns {number | null}
 */
export function cursorCheck({ gaze, cursor, cell }) {
  if (!gaze || !cursor || !cell) return null;

  const tx = CURSOR_TOLERANCE_CELLS * cell.w, ty = CURSOR_TOLERANCE_CELLS * cell.h;
  const onCell = cursor.x >= cell.x - tx && cursor.x <= cell.x + cell.w + tx
    && cursor.y >= cell.y - ty && cursor.y <= cell.y + cell.h + ty;
  if (!onCell) return null;

  return Math.hypot((gaze.x - cursor.x) / cell.w, (gaze.y - cursor.y) / cell.h);
}

/**
 * "≈ 0.8 Cells" for the results and the calibration summary.
 * @param {number} cells
 */
export function formatCells(cells) {
  const text = cells.toFixed(1);
  return `≈ ${text} ${text === "1.0" ? "Cell" : "Cells"}`;
}

/**
 * The calibration error as shown to the Learner, or null when the service sent none.
 * @param {number | null | undefined} errorPx  calibration_status.calibration_error_px
 * @param {{ type: "layout", viewport: Viewport, cells: CellRect[] } | null} layout  the `layout` that was sent
 * @returns {{ px: number, cells: number, poor: boolean } | null}
 */
export function calibrationError(errorPx, layout) {
  const size = layout ? cellSizePx(layout.cells, layout.viewport) : null;
  if (errorPx == null || !size) return null;
  const cells = pxToCells(errorPx, size);
  return { px: errorPx, cells, poor: cells > POOR_ERROR_CELLS };
}
