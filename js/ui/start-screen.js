// The start screen: mode badge, camera preview and the start button.

import { CONFIG } from "../config.js";
import { $, state } from "../state.js";
import { describeCameraError } from "../camera/camera-error.js";
import { startCamera, loadLandmarker } from "../camera/face-tracker.js";

function showError(text) {
  $("start-error").textContent = text;
  $("start-error").classList.remove("hidden");
}

function hideError() {
  $("start-error").classList.add("hidden");
}

/** @param {(showError: (text: string) => void) => void} onStart called when the Learner clicks Start */
export function initStartScreen(onStart) {
  $("mode-badge").textContent = CONFIG.useMock ? "Mock service" : "Live service";
  $("mode-badge").className = `badge ${CONFIG.useMock ? "badge-muted" : "badge-live"}`;

  $("btn-camera").addEventListener("click", async () => {
    hideError();
    $("camera-status").textContent = "Starting camera…";
    try {
      const stream = await startCamera();
      $("preview-video").srcObject = stream;
      $("session-video").srcObject = stream;
      $("camera-status").textContent = "";
      $("btn-camera").disabled = true;
    } catch (err) {
      const cause = describeCameraError(err);
      console.warn("Camera failed to start:", cause.name); // the error name only, nothing about the Learner
      $("camera-status").textContent = cause.status;
      return showError(`We need the camera. ${cause.help}`);
    }

    $("camera-status").textContent = "Loading face tracker…";
    try {
      await loadLandmarker();
      state.landmarkerReady = true;
      $("camera-status").textContent = "";
    } catch (err) {
      console.warn("MediaPipe failed to load", err);
      if (!CONFIG.useMock) return showError("Face tracker failed to load. Check your connection and reload.");
      $("camera-status").textContent = "Face tracker unavailable — mock will use a fake face";
    }
    $("btn-start").disabled = false;
  });

  $("btn-start").addEventListener("click", () => {
    hideError();
    onStart(showError);
  });
}
