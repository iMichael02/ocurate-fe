import { createCalibrationScreen } from './calibration-screen.js';

const screens = document.querySelectorAll('[data-screen]');

function show(name, { focus = true } = {}) {
  screens.forEach((s) => { s.hidden = s.dataset.screen !== name; });
  if (focus) document.querySelector(`[data-screen="${name}"] h1, [data-screen="${name}"] h2`)?.focus();
}

createCalibrationScreen(document.getElementById('calibration-panel'));

document.getElementById('start-btn').addEventListener('click', () => show('calibration'));
document.getElementById('back-btn').addEventListener('click', () => show('welcome'));
show('welcome', { focus: false });
