// Window-level listeners that only matter during a Session.

import { state } from "../state.js";
import { safeSend } from "./send.js";

// Any resize, fullscreen change or scroll invalidates the calibration → Session is abandoned.
function onViewportChanged() {
  if (!state.layoutSent || state.phase === "done" || state.phase === "ended") return;
  safeSend({ type: "viewport_changed" });
}

export function installGuards() {
  window.addEventListener("resize", onViewportChanged);
  window.addEventListener("scroll", onViewportChanged, true);
  document.addEventListener("fullscreenchange", onViewportChanged);

  window.addEventListener("pointermove", (e) => {
    const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
    // Mock only: the mouse stands in for gaze.
    state.conn?.setPointer?.(x, y);
    // The cursor check uses a real mouse only (no touch or pen), and only the latest position.
    if (e.pointerType === "mouse" && (state.phase === "calibration_ready" || state.phase === "reading")) {
      state.cursor = { x, y };
    }
  });

  // No on-screen controls while reading: Escape quits the Session.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.phase === "reading" && state.conn) safeSend({ type: "quit" });
  });
}
