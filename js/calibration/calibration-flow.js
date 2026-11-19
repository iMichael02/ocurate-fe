// Calibration on the Session screen: the guide, the 16 dots one at a time, and the service's verdict.

import { CONFIG } from "../config.js";
import { $, state, setPhase, sleep, round } from "../state.js";
import { startRecording } from "../ui/session-ui.js";
import { safeSend } from "../session/send.js";
import { calibrationError, formatCells } from "../session/accuracy.js";

const GRID = [0.1, 0.1 + 0.8 / 3, 0.1 + 1.6 / 3, 0.9];
const CALIB_POINTS = GRID.flatMap((y) => GRID.map((x) => ({ x, y }))); // row by row, index 0–15

export function showCalibrationGuide() {
  setPhase("guide");
  $("calib-guide").classList.remove("hidden");
  $("btn-calib-start").focus();
}

// One dot at a time: it appears, shrinks until it is gone, and only then does the next one appear.
async function runCalibration() {
  const run = ++state.calibRun;
  state.calibJudged = false;
  const live = () => run === state.calibRun && state.phase === "calibrating";
  setPhase("calibrating");
  $("calibration").classList.remove("hidden");
  $("calib-failed").classList.add("hidden");
  $("calib-text").textContent = "";
  drawCalibrationGrid();

  const dot = $("calib-target");
  for (const [i, p] of CALIB_POINTS.entries()) {
    if (!live()) return;
    const last = i === CALIB_POINTS.length - 1;
    state.target = null; // don't tag frames while the eyes travel to the new dot
    dot.style.left = `${p.x * 100}%`;
    dot.style.top = `${p.y * 100}%`;
    dot.classList.remove("hidden");
    const shrink = dot.animate(
      [{ transform: "scale(1)" }, { transform: "scale(0)" }],
      { duration: CONFIG.calibrationMsPerPoint, easing: "linear", fill: "forwards" },
    );
    await sleep(CONFIG.calibrationSettleMs);
    if (!live()) return shrink.cancel();
    state.target = { x: round(p.x), y: round(p.y) };
    await sleep(CONFIG.calibrationMsPerPoint - CONFIG.calibrationSettleMs);
    if (last) {
      // The service judges calibration once it has enough frames on the last point, and a slow
      // device sends fewer than the dot's timer allows for. Keep the dot (pulsing) and keep
      // tagging frames until the service answers, up to a limit.
      shrink.cancel();
      dot.animate(
        [{ transform: "scale(1)" }, { transform: "scale(0.4)" }],
        { duration: 600, direction: "alternate", iterations: Infinity, easing: "ease-in-out" },
      );
      const deadline = performance.now() + CONFIG.calibrationLastPointMaxMs;
      while (live() && !state.calibJudged && performance.now() < deadline) await sleep(50);
      if (!live()) return;
    }
    state.target = null;
    shrink.cancel();
    dot.getAnimations().forEach((a) => a.cancel());
    dot.classList.add("hidden");
    await sleep(CONFIG.calibrationGapMs);
  }
  if (live()) $("calib-text").textContent = "Checking calibration…";
}

function drawCalibrationGrid() {
  const grid = $("calib-grid");
  grid.innerHTML = "";
  CALIB_POINTS.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "dot";
    d.id = `calib-dot-${i}`;
    d.style.left = `${p.x * 100}%`;
    d.style.top = `${p.y * 100}%`;
    grid.appendChild(d);
  });
}

function updateCalibrationDots(points) {
  points.forEach((p) => {
    const d = $(`calib-dot-${p.index}`);
    if (d) d.className = `dot ${p.state}`;
  });
}

// Shows the calibration error with Continue and Start over. The Session waits in calibration_ready
// (frames still flow, untagged) until the Learner chooses.
function onCalibrationReady(msg) {
  state.target = null;
  setPhase("calibration_ready");
  const error = calibrationError(msg.calibration_error_px, state.layout);
  state.calibrationError = error;
  $("calib-ready-text").textContent = !error
    ? "The gaze error could not be measured for this calibration."
    : `Estimated gaze error: ${formatCells(error.cells)} (${Math.round(error.px)} px), measured on `
      + "calibration frames the tracker did not learn from. "
      + (error.poor
        ? "That is more than one Cell, so reading may often be tracked on the wrong Cell. Start over to recalibrate."
        : "That is good enough to read.");
  $("calib-ready").classList.remove("hidden");
  $("btn-calib-continue").focus();
}

function onCalibrated() {
  if (state.phase !== "calibration_ready") return;
  if (!safeSend({ type: "calibration_done" })) return;
  $("calib-ready").classList.add("hidden");
  $("calibration").classList.add("hidden");
  setPhase("reading");
  startRecording();
}

function onCalibrationFailed(msg) {
  state.target = null;
  setPhase("calibration_failed");
  const why = msg.reason === "missing_row_or_column"
    ? "A whole row or column of dots could not be used."
    : "Too many dots could not be used.";
  const left = msg.max_attempts - msg.attempt;
  $("calib-text").textContent = "Calibration didn't work";
  $("calib-failed-text").textContent =
    `${why} Make sure your face is well lit and in view. ${left} attempt${left === 1 ? "" : "s"} left.`;
  $("calib-failed").classList.toggle("hidden", left <= 0);
}

/** Handles a `calibration_status` message from the service. */
export function onCalibrationStatus(msg) {
  updateCalibrationDots(msg.points);
  $("calib-attempt").textContent = `Attempt ${msg.attempt} of ${msg.max_attempts}`;
  if (msg.outcome) state.calibJudged = true;
  if (msg.outcome === "ready") onCalibrationReady(msg);
  if (msg.outcome === "failed") onCalibrationFailed(msg);
}

export function initCalibration() {
  $("btn-calib-start").addEventListener("click", () => {
    $("calib-guide").classList.add("hidden");
    runCalibration();
  });
  $("btn-calib-continue").addEventListener("click", onCalibrated);
  // A calibration that succeeded cannot be redone on the same socket: start a new Session.
  $("btn-calib-over").addEventListener("click", () => location.reload());
  $("btn-calib-retry").addEventListener("click", () => {
    if (!safeSend({ type: "calibration_restart" })) return;
    runCalibration();
  });
}
