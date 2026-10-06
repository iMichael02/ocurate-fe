import { calibrationTargets } from './calibration-grid.js';

const STATES = ['pending', 'collecting', 'ok', 'skipped'];

/**
 * Renders the 16 targets into the calibration panel. Positions come from the
 * same grid that is sent as `target` in frames.
 * @param {HTMLElement} panel
 */
export function createCalibrationScreen(panel) {
  const dots = calibrationTargets().map((t) => {
    const el = document.createElement('div');
    el.className = 'target';
    el.dataset.state = 'pending';
    el.style.left = `${t.x * 100}%`;
    el.style.top = `${t.y * 100}%`;
    el.innerHTML = `<span class="dot"></span><span class="num">${t.index + 1}</span><span class="sr-only"></span>`;
    panel.append(el);
    return el;
  });

  return {
    /** @param {number} index 0-15  @param {'pending'|'collecting'|'ok'|'skipped'} state */
    setPointState(index, state) {
      if (!STATES.includes(state)) throw new RangeError(`unknown state ${state}`);
      if (!dots[index]) throw new RangeError(`unknown point ${index}`);
      dots[index].dataset.state = state;
      dots[index].querySelector('.sr-only').textContent = `, ${state}`;
    },
  };
}
