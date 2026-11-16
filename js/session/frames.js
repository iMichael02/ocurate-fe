// Captures a frame from the webcam at most CONFIG.maxFps times per second and sends it.

import { CONFIG } from "../config.js";
import { $, state } from "../state.js";
import { detect, syntheticFrame } from "../camera/face-tracker.js";
import { safeSend } from "./send.js";

export function frameLoop(now) {
  if (state.phase === "done" || state.phase === "ended") return;
  requestAnimationFrame(frameLoop);

  if (now - state.lastFrameT < 1000 / CONFIG.maxFps) return;
  state.lastFrameT = now;

  const video = $("session-video");
  let frame = state.landmarkerReady ? detect(video, now, state.version >= 2) : null;
  if (!frame && CONFIG.useMock && !state.landmarkerReady) frame = syntheticFrame(now);

  if (!frame) return; // no face: send nothing, the service tolerates gaps

  // Only stream while the service expects frames.
  if (state.phase === "calibrating") {
    if (!state.target) return;
    frame.target = state.target;
  } else if (state.phase !== "reading") {
    return;
  }
  safeSend({ type: "frame", ...frame });
}
