const AXIS_MIN = 0.1;
const AXIS_MAX = 0.9;
const SIDE = 4;

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * The 16 Calibration targets: a 4x4 grid evenly spaced from 0.1 to 0.9 of the
 * viewport on each axis, row-major. Matches the service's protocol.
 * @returns {{index: number, x: number, y: number}[]}
 */
export function calibrationTargets() {
  const step = (AXIS_MAX - AXIS_MIN) / (SIDE - 1);
  const targets = [];
  for (let row = 0; row < SIDE; row++) {
    for (let col = 0; col < SIDE; col++) {
      targets.push({
        index: row * SIDE + col,
        x: round3(AXIS_MIN + col * step),
        y: round3(AXIS_MIN + row * step),
      });
    }
  }
  return targets;
}
