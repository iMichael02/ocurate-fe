import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eyeCrop, eyeCentres, CROP_WIDTH, CROP_HEIGHT } from '../js/eye-crop.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// 200x100 RGBA image whose red=green=blue value is f(x, y) in pixels.
function image(f, width = 200, height = 100) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = f(x, y);
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

// An upright eye 40 px wide (20..60) at pixel row 50, normalized to the image.
const corners = [
  { x: 0.1, y: 0.5 },   // left
  { x: 0.3, y: 0.5 },   // right
  { x: 0.2, y: 0.45 },  // top
  { x: 0.2, y: 0.55 },  // bottom
];

test('crop is 20 rows of 40 grayscale values', () => {
  const { crop } = eyeCrop(image(() => 100), corners);
  assert.equal(CROP_HEIGHT, 20);
  assert.equal(CROP_WIDTH, 40);
  assert.equal(crop.length, 20);
  assert.ok(crop.every((row) => row.length === 40 && row.every((v) => near(v, 100))));
});

test('grayscale is the luminance of the RGB pixel', () => {
  const img = image(() => 0);
  for (let i = 0; i < img.data.length; i += 4) img.data.set([255, 0, 0, 255], i);
  const { crop } = eyeCrop(img, corners);
  assert.ok(near(crop[10][20], 0.299 * 255, 1e-3));
});

test('crop spans the corners with a 20% margin, left to right', () => {
  // brightness grows with image x, so crop columns must increase to the right
  const { crop } = eyeCrop(image((x) => x), corners);
  // W = 1.4 * 40 = 56 px, centred on x=40: column i samples x = 40 + 56*((i+0.5)/40 - 0.5)
  // (pixel k covers [k, k+1), so brightness x at a position p reads p - 0.5)
  assert.ok(near(crop[10][0], 40 + 56 * (0.5 / 40 - 0.5) - 0.5, 1e-3));
  assert.ok(near(crop[10][39], 40 + 56 * (39.5 / 40 - 0.5) - 0.5, 1e-3));
});

test('crop height is half its width, centred on the corners midpoint', () => {
  // brightness grows with image y: rows span 28 px around y=50 (v points down)
  const { crop } = eyeCrop(image((_, y) => y * 2), corners);
  assert.ok(near(crop[0][20], 2 * (50 + 28 * (0.5 / 20 - 0.5) - 0.5), 1e-3));
  assert.ok(near(crop[19][20], 2 * (50 + 28 * (19.5 / 20 - 0.5) - 0.5), 1e-3));
});

test('toImage maps crop coordinates back to normalized image coordinates', () => {
  const { toImage } = eyeCrop(image(() => 0), corners);
  const centre = toImage(0.5, 0.5);
  assert.ok(near(centre.x, 0.2) && near(centre.y, 0.5));
  const left = toImage(0.5 / 40, 0.5);   // first column centre
  assert.ok(near(left.x, (40 + 56 * (0.5 / 40 - 0.5)) / 200));
});

test('a rotated eye is cropped along its corner axis', () => {
  const tilted = [
    { x: 0.1, y: 0.4 }, { x: 0.3, y: 0.6 }, { x: 0.22, y: 0.45 }, { x: 0.18, y: 0.55 },
  ];
  const { toImage } = eyeCrop(image(() => 0), tilted);
  const a = toImage(0.1, 0.5), b = toImage(0.9, 0.5);
  // pixel direction of the crop's x axis equals the corner-to-corner direction
  const dx = (b.x - a.x) * 200, dy = (b.y - a.y) * 100;
  const cx = (0.3 - 0.1) * 200, cy = (0.6 - 0.4) * 100;
  assert.ok(near(dx * cy - dy * cx, 0, 1e-6));
  assert.ok(dx * cx + dy * cy > 0);
});

test('eyeCentres finds a dark iris in each eye, in image coordinates', () => {
  // dark disc of radius 5 px at (40, 50) and (140, 50)
  const img = image((x, y) =>
    Math.hypot(x - 40, y - 50) < 5 || Math.hypot(x - 140, y - 50) < 5 ? 20 : 200);
  const eye = (cx) => [
    { x: (cx - 20) / 200, y: 0.5 }, { x: (cx + 20) / 200, y: 0.5 },
    { x: cx / 200, y: 0.45 }, { x: cx / 200, y: 0.55 },
  ];
  const centres = eyeCentres(img, [...eye(40), ...eye(140)]);
  assert.equal(centres.length, 2);
  assert.ok(Math.abs(centres[0].x - 40 / 200) < 0.012 && Math.abs(centres[0].y - 0.5) < 0.02);
  assert.ok(Math.abs(centres[1].x - 140 / 200) < 0.012 && Math.abs(centres[1].y - 0.5) < 0.02);
  assert.ok(centres[0].confidence >= 0 && centres[0].confidence <= 1);
});

// Like the browser's ImageData: data, width and height are getters on the
// prototype, so they are not copied by an object spread.
class FakeImageData {
  #data; #width; #height;
  constructor(data, width, height) { this.#data = data; this.#width = width; this.#height = height; }
  get data() { return this.#data; }
  get width() { return this.#width; }
  get height() { return this.#height; }
}

// A source that only hands out the pixels asked for, like the camera frame.
function lazySource(img) {
  const reads = [];
  return {
    reads,
    width: img.width,
    height: img.height,
    read(x, y, w, h) {
      reads.push({ x, y, w, h });
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row++) {
        const from = ((y + row) * img.width + x) * 4;
        data.set(img.data.subarray(from, from + w * 4), row * w * 4);
      }
      return new FakeImageData(data, w, h);
    },
  };
}

const twoEyes = [
  { x: 0.1, y: 0.5 }, { x: 0.3, y: 0.5 }, { x: 0.2, y: 0.45 }, { x: 0.2, y: 0.55 },
  { x: 0.6, y: 0.4 }, { x: 0.8, y: 0.6 }, { x: 0.72, y: 0.45 }, { x: 0.68, y: 0.55 },
];

test('reading only the eye regions gives the same centres as the whole image', () => {
  const img = image((x, y) =>
    Math.hypot(x - 40, y - 50) < 5 || Math.hypot(x - 160, y - 50) < 5 ? 20 : 150 + ((x * 7 + y * 13) % 50));
  const whole = eyeCentres(img, twoEyes);
  const lazy = lazySource(img);
  assert.deepEqual(eyeCentres(lazy, twoEyes), whole);
  assert.equal(lazy.reads.length, 2);
});

test('each region read is a small part of the frame, inside it', () => {
  const lazy = lazySource(image(() => 100));
  eyeCentres(lazy, twoEyes);
  for (const { x, y, w, h } of lazy.reads) {
    assert.ok(x >= 0 && y >= 0 && x + w <= 200 && y + h <= 100);
    assert.ok(w * h < 0.25 * 200 * 100);
  }
});

test('an eye at the frame edge is read without going outside it', () => {
  const lazy = lazySource(image(() => 100));
  const edge = [
    { x: 0.0, y: 0.5 }, { x: 0.1, y: 0.5 }, { x: 0.05, y: 0.45 }, { x: 0.05, y: 0.55 },
    { x: 0.9, y: 0.5 }, { x: 1.0, y: 0.5 }, { x: 0.95, y: 0.45 }, { x: 0.95, y: 0.55 },
  ];
  eyeCentres(lazy, edge);
  for (const { x, y, w, h } of lazy.reads) {
    assert.ok(x >= 0 && y >= 0 && x + w <= 200 && y + h <= 100);
  }
});
