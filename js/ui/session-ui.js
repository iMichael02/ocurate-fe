// Screen switching, the recording clock, the results modal and the "session ended" modal.

import { $, state, setPhase } from "../state.js";

export function showScreen(name) {
  $("screen-start").classList.toggle("hidden", name !== "start");
  $("screen-session").classList.toggle("hidden", name !== "session");
  document.body.classList.toggle("in-session", name === "session"); // hides the top bar
}

export function resetSessionUi() {
  state.fixations = 0;
  state.activeCell = null;
  $("read-fixations").textContent = "0";
  $("read-cell").textContent = "—";
}

export function startRecording() {
  state.recStart = performance.now();
  $("rec-badge").classList.remove("hidden");
  state.recTimer = setInterval(() => {
    const s = Math.floor((performance.now() - state.recStart) / 1000);
    const clock = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    $("rec-time").textContent = clock;
    $("read-time").textContent = clock;
  }, 500);
}

export function stopRecording() {
  clearInterval(state.recTimer);
  $("rec-badge").classList.add("hidden");
}

export function showResults(r) {
  $("res-cpm").textContent = r.cpm.toFixed(1);
  $("res-wpm").textContent = r.wpm.toFixed(1);
  $("res-time").textContent = `${r.elapsed_seconds.toFixed(1)} s`;
  $("res-saccades").textContent = r.saccades;
  $("res-regressions").textContent = r.regressions;
  $("res-skipped").textContent = r.skipped_characters;
  $("res-sequence").textContent = r.sequence.length;
  $("modal").classList.remove("hidden");
}

export function endSession(text) {
  if (state.phase === "ended") return;
  setPhase("ended");
  stopRecording();
  $("calibration").classList.add("hidden");
  $("abandoned-text").textContent = text;
  $("modal-abandoned").classList.remove("hidden");
}

export function abandonText(reason) {
  return {
    quit: "You quit the session. Nothing was saved.",
    viewport_changed: "The window size changed, so the calibration no longer fits. Please recalibrate.",
    frame_timeout: "We couldn't see your face for 30 seconds.",
    calibration_failed: "Calibration failed too many times. Check your lighting and try again.",
    socket_closed: "The connection was closed.",
    protocol_error: "Something went wrong talking to the service.",
    rate_limited: "The camera sent data too fast for the service. Close other tabs or apps and try again.",
  }[reason] ?? "The session ended early.";
}

/** A new Session always starts fresh. */
export function initEndButtons() {
  const restart = () => location.reload();
  $("btn-again").addEventListener("click", restart);
  $("btn-modal-close").addEventListener("click", restart);
  $("btn-abandoned-ok").addEventListener("click", restart);
}
