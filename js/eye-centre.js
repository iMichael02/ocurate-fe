// Timm & Barth eye-centre localisation ("Accurate Eye Centre Localisation by
// Means of Gradients", 2011). Port of the service's eye_centre.py, which is
// authoritative: test/eye-centre.test.js replays its golden crops.
// Pure maths on a grayscale crop; no DOM.

export const CROP_WIDTH = 40;
export const CROP_HEIGHT = 20;

// Gradients weaker than mean + factor * std of the magnitudes are ignored.
const GRADIENT_THRESHOLD_FACTOR = 0.3;
// Std-dev (px) of the blur applied before the "dark centre" weighting.
const WEIGHT_BLUR_SIGMA = 1.0;
// Peaks closer than this (px) to the best centre belong to the same peak. It must
// exceed the iris radius in the crop (5-8 px), or the iris rim counts as a rival.
const PEAK_EXCLUSION_RADIUS = 10.0;

/** Like numpy.gradient along one axis: central differences, one-sided at the edges. */
function gradient(image, axis) {
  const rows = image.length, cols = image[0].length;
  const out = image.map((row) => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = axis === 0 ? rows : cols;
      const i = axis === 0 ? r : c;
      const at = (k) => (axis === 0 ? image[k][c] : image[r][k]);
      if (i === 0) out[r][c] = at(1) - at(0);
      else if (i === n - 1) out[r][c] = at(n - 1) - at(n - 2);
      else out[r][c] = (at(i + 1) - at(i - 1)) / 2;
    }
  }
  return out;
}

function gaussianBlur(image, sigma) {
  const radius = Math.max(1, Math.round(3 * sigma));
  const kernel = [];
  for (let o = -radius; o <= radius; o++) kernel.push(Math.exp(-(o * o) / (2 * sigma * sigma)));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const k = kernel.map((v) => v / sum);

  const rows = image.length, cols = image[0].length;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);

  const vertical = image.map((row, r) => row.map((_, c) => {
    let acc = 0;
    for (let o = -radius; o <= radius; o++) acc += k[o + radius] * image[clamp(r + o, rows - 1)][c];
    return acc;
  }));
  return vertical.map((row, r) => row.map((_, c) => {
    let acc = 0;
    for (let o = -radius; o <= radius; o++) acc += k[o + radius] * vertical[r][clamp(c + o, cols - 1)];
    return acc;
  }));
}

/**
 * The eye centre in a CROP_HEIGHT x CROP_WIDTH grayscale crop (rows of
 * columns, 0-255, dark = low).
 * @param {number[][]} crop
 * @returns {{x: number, y: number, confidence: number}} x and y in 0-1 of the crop
 */
export function locateEyeCentre(crop) {
  if (!Array.isArray(crop) || crop.length !== CROP_HEIGHT
      || crop.some((row) => row.length !== CROP_WIDTH)) {
    throw new Error(`crop must be ${CROP_HEIGHT}x${CROP_WIDTH} (rows x columns)`);
  }
  if (crop.some((row) => row.some((v) => !Number.isFinite(v)))) {
    throw new Error('crop contains non-finite pixels');
  }

  const gy = gradient(crop, 0);
  const gx = gradient(crop, 1);
  const magnitude = gx.map((row, r) => row.map((v, c) => Math.hypot(v, gy[r][c])));

  const flat = magnitude.flat();
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const std = Math.sqrt(flat.reduce((a, b) => a + (b - mean) ** 2, 0) / flat.length);
  const threshold = mean + GRADIENT_THRESHOLD_FACTOR * std;

  const count = flat.filter((m) => m > threshold).length;
  if (count === 0) return { x: 0.5, y: 0.5, confidence: 0 };

  // Strong gradients as flat arrays: position and unit direction.
  const gcol = new Float64Array(count), grow = new Float64Array(count);
  const gux = new Float64Array(count), guy = new Float64Array(count);
  let k = 0;
  for (let r = 0; r < CROP_HEIGHT; r++) {
    for (let c = 0; c < CROP_WIDTH; c++) {
      if (magnitude[r][c] > threshold) {
        gcol[k] = c; grow[k] = r;
        gux[k] = gx[r][c] / magnitude[r][c];
        guy[k] = gy[r][c] / magnitude[r][c];
        k++;
      }
    }
  }

  const blurred = gaussianBlur(crop, WEIGHT_BLUR_SIGMA);

  const objective = new Float64Array(CROP_HEIGHT * CROP_WIDTH);
  let bestRow = 0, bestCol = 0, best = -Infinity;
  for (let cr = 0; cr < CROP_HEIGHT; cr++) {
    for (let cc = 0; cc < CROP_WIDTH; cc++) {
      let total = 0;
      for (let i = 0; i < count; i++) {
        const dx = gcol[i] - cc, dy = grow[i] - cr;
        const dot = dx * gux[i] + dy * guy[i];
        if (dot <= 0) continue;   // gradient points towards the candidate; also covers a gradient at the candidate itself
        total += (dot * dot) / (dx * dx + dy * dy);
      }
      const weight = Math.min(Math.max((255 - blurred[cr][cc]) / 255, 0), 1);
      const value = (total / count) * weight;
      objective[cr * CROP_WIDTH + cc] = value;
      if (value > best) { best = value; bestRow = cr; bestCol = cc; }
    }
  }

  if (best <= 0) return { x: 0.5, y: 0.5, confidence: 0 };

  let runnerUp = 0;
  const radiusSquared = PEAK_EXCLUSION_RADIUS * PEAK_EXCLUSION_RADIUS;
  for (let r = 0; r < CROP_HEIGHT; r++) {
    for (let c = 0; c < CROP_WIDTH; c++) {
      const dr = r - bestRow, dc = c - bestCol;
      if (dr * dr + dc * dc > radiusSquared && objective[r * CROP_WIDTH + c] > runnerUp) {
        runnerUp = objective[r * CROP_WIDTH + c];
      }
    }
  }

  const confidence = Math.min(Math.max(1 - runnerUp / best, 0), 1);
  return { x: (bestCol + 0.5) / CROP_WIDTH, y: (bestRow + 0.5) / CROP_HEIGHT, confidence };
}
