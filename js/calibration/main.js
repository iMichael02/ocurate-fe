import { createCalibrationScreen } from './calibration-screen.js';

const screens = document.querySelectorAll('[data-screen]');
const $ = (id) => document.getElementById(id);

function show(name, { focus = true } = {}) {
  screens.forEach((s) => { s.hidden = s.dataset.screen !== name; });
  if (focus) document.querySelector(`[data-screen="${name}"] h1, [data-screen="${name}"] h2`)?.focus();
}

const calibration = createCalibrationScreen($('calibration-panel'), $('calibration-status'));
let run = null;

async function startCalibration() {
  run?.abort();
  const ctrl = (run = new AbortController());
  show('calibration', { focus: false });
  calibration.reset();
  const finished = await calibration.play(ctrl.signal);
  if (finished) $('calibration-status').textContent = 'Calibration points complete.';
}

function leaveCalibration() {
  run?.abort();
  calibration.reset();
  show('guide');
}

$('start-btn').addEventListener('click', () => show('guide'));
$('guide-back-btn').addEventListener('click', () => show('welcome'));
$('ready-btn').addEventListener('click', startCalibration);
$('back-btn').addEventListener('click', leaveCalibration);
show('welcome', { focus: false });
