import { calibrationTargets } from './calibration-grid.js';
import { playSequence } from './sequence.js';

const STATES = ['pending', 'collecting', 'ok', 'skipped'];
const POINT_MS = 2000; // keep in sync with --point-ms in styles.css

/**
 * Renders the 16 targets into the calibration panel. Positions come from the
 * same grid that is sent as `target` in frames. Only a `collecting` point is
 * visible: it appears at full size and shrinks away.
 * @param {HTMLElement} panel
 * @param {HTMLElement} [status] live region announcing the current point
 */
export function createCalibrationScreen(panel, status) {
  const targets = calibrationTargets();
  const dots = targets.map((t) => {
    const el = document.createElement('div');
    el.className = 'target';
    el.dataset.state = 'pending';
    el.style.left = `${t.x * 100}%`;
    el.style.top = `${t.y * 100}%`;
    el.innerHTML = '<span class="dot"></span>';
    panel.append(el);
    return el;
  });

  function setPointState(index, state) {
    if (!STATES.includes(state)) throw new RangeError(`unknown state ${state}`);
    if (!dots[index]) throw new RangeError(`unknown point ${index}`);
    dots[index].dataset.state = state;
  }

  /** Resolves when the point's shrink animation ends (with a timeout fallback). */
  function showPoint(t) {
    return new Promise((resolve) => {
      const dot = dots[t.index].firstElementChild;
      const finish = () => {
        clearTimeout(timer);
        dot.removeEventListener('animationend', finish);
        setPointState(t.index, 'ok');
        resolve();
      };
      const timer = setTimeout(finish, POINT_MS + 500);
      dot.addEventListener('animationend', finish);
      if (status) status.textContent = `Point ${t.index + 1} of ${targets.length}`;
      setPointState(t.index, 'collecting');
    });
  }

  return {
    setPointState,
    /** Shows the points one by one, left to right, top to bottom. @returns {Promise<boolean>} */
    play(signal) {
      dots.forEach((d) => { d.dataset.state = 'pending'; });
      return playSequence(targets, showPoint, signal);
    },
    reset() { dots.forEach((d) => { d.dataset.state = 'pending'; }); },
  };
}
