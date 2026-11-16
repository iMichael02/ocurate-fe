// Cuts the 40 x 20 grayscale eye crop defined in the service's
// docs/eye-centre.md out of a camera image and maps a located centre back to
// normalized camera-image coordinates. Pure maths on {data, width, height}
// (RGBA, like ImageData); no DOM.

import { CROP_WIDTH, CROP_HEIGHT, locateEyeCentre } from "./eye-centre.js";

export { CROP_WIDTH, CROP_HEIGHT };

const MARGIN = 1.4;   // crop width = 1.4 x the corner distance (20% each side)
const ASPECT = 0.5;   // crop height = ASPECT x crop width

// `image` may hold only a region of the frame: `x0`, `y0` is where it starts and
// `frameWidth`, `frameHeight` the whole frame (defaults: the image is the frame).
function luminance(image, x, y) {
  const frameWidth = image.frameWidth ?? image.width;
  const frameHeight = image.frameHeight ?? image.height;
  const cx = Math.min(Math.max(x, 0), frameWidth - 1) - (image.x0 ?? 0);
  const cy = Math.min(Math.max(y, 0), frameHeight - 1) - (image.y0 ?? 0);
  const i = (cy * image.width + cx) * 4;
  return 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
}

function bilinear(image, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const top = luminance(image, x0, y0) * (1 - fx) + luminance(image, x0 + 1, y0) * fx;
  const bottom = luminance(image, x0, y0 + 1) * (1 - fx) + luminance(image, x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

// Where the crop sits in the frame: pixel centre, axes and size.
function geometry(frameWidth, frameHeight, corners, margin, aspect) {
  const left = { x: corners[0].x * frameWidth, y: corners[0].y * frameHeight };
  const right = { x: corners[1].x * frameWidth, y: corners[1].y * frameHeight };

  const dx = right.x - left.x, dy = right.y - left.y;
  const length = Math.hypot(dx, dy);
  const u = { x: dx / length, y: dy / length };
  const v = { x: -u.y, y: u.x };

  const centre = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const W = margin * length;
  const H = W * aspect;

  // Position in the frame (pixels) of crop coordinates fx, fy in 0-1.
  const at = (fx, fy) => ({
    x: centre.x + u.x * W * (fx - 0.5) + v.x * H * (fy - 0.5),
    y: centre.y + u.y * W * (fx - 0.5) + v.y * H * (fy - 0.5),
  });

  return { at };
}

/**
 * The pixels one eye's crop reads: a box around the rotated crop rectangle,
 * plus the neighbours bilinear sampling touches, clamped to the frame.
 * @returns {{x: number, y: number, width: number, height: number}}
 */
export function eyeBounds(frameWidth, frameHeight, corners, { margin = MARGIN, aspect = ASPECT } = {}) {
  const { at } = geometry(frameWidth, frameHeight, corners, margin, aspect);
  const points = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
  const x1 = Math.min(frameWidth, Math.ceil(Math.max(...xs)) + 2);
  const y1 = Math.min(frameHeight, Math.ceil(Math.max(...ys)) + 2);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * @param {{data: ArrayLike<number>, width: number, height: number, x0?: number, y0?: number, frameWidth?: number, frameHeight?: number}} image RGBA, not mirrored; may be a region of the frame (see luminance)
 * @param {{x: number, y: number}[]} corners one eye: left, right, top, bottom (normalized to the image)
 * @param {{margin?: number, aspect?: number}} [options] crop width / corner distance and height / width; the defaults are the documented crop, others are for experiments
 * @returns {{crop: number[][], toImage: (x: number, y: number) => {x: number, y: number}}}
 */
export function eyeCrop(image, corners, { margin = MARGIN, aspect = ASPECT } = {}) {
  const frameWidth = image.frameWidth ?? image.width;
  const frameHeight = image.frameHeight ?? image.height;
  const { at } = geometry(frameWidth, frameHeight, corners, margin, aspect);

  const crop = [];
  for (let j = 0; j < CROP_HEIGHT; j++) {
    const row = [];
    for (let i = 0; i < CROP_WIDTH; i++) {
      const p = at((i + 0.5) / CROP_WIDTH, (j + 0.5) / CROP_HEIGHT);
      row.push(bilinear(image, p.x - 0.5, p.y - 0.5));   // pixel centres sit at +0.5
    }
    crop.push(row);
  }

  const toImage = (x, y) => {
    const p = at(x, y);
    return { x: p.x / frameWidth, y: p.y / frameHeight };
  };

  return { crop, toImage };
}

/**
 * The `eye_centres` field of a version 2 frame.
 * @param {{width: number, height: number, read?: (x: number, y: number, w: number, h: number) => {data: ArrayLike<number>, width: number, height: number}, data?: ArrayLike<number>}} source
 *   the frame: either RGBA pixels, or `read(x, y, w, h)` that returns just that
 *   region (cheap for a camera frame, where only two small boxes are needed)
 * @param {{x: number, y: number}[]} eyeCorners the frame's 8 `eye_corners` (left eye first)
 * @returns {{x: number, y: number, confidence: number}[]} left eye, then right eye
 */
export function eyeCentres(source, eyeCorners) {
  return [0, 4].map((offset) => {
    const corners = eyeCorners.slice(offset, offset + 4);
    let image = source;
    if (source.read) {
      const box = eyeBounds(source.width, source.height, corners);
      const region = source.read(box.x, box.y, box.width, box.height);
      // Not `{ ...region }`: ImageData's fields are prototype getters and would not be copied.
      image = {
        data: region.data, width: region.width, height: region.height,
        x0: box.x, y0: box.y, frameWidth: source.width, frameHeight: source.height,
      };
    }
    const { crop, toImage } = eyeCrop(image, corners);
    const { x, y, confidence } = locateEyeCentre(crop);
    return { ...toImage(x, y), confidence };
  });
}
