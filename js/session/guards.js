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

  // Mock only: the mouse stands in for gaze.
  window.addEventListener("pointermove", (e) => {
    state.conn?.setPointer?.(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
  });

  // No on-screen controls while reading: Escape quits the Session.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.phase === "reading" && state.conn) safeSend({ type: "quit" });
  });
}
