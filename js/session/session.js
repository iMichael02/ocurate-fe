// Starts a Session and routes the service's messages.
// Flow (docs/websocket-protocol.md):
//   hello → hello_ack → layout → frames with target (calibration) → calibration_status ready
//   → calibration_done → frames without target → reading_started → fixation… → completed

import { CONFIG } from "../config.js";
import { state, setPhase } from "../state.js";
import { closeMessage } from "../service/close-message.js";
import { openConnection } from "../service/connection.js";
import { createSession } from "../service/session-api.js";
import { loadPassage } from "../reading/passage.js";
import { onFixation } from "../reading/reading-ui.js";
import { showCalibrationGuide, onCalibrationStatus } from "../calibration/calibration-flow.js";
import {
  showScreen, resetSessionUi, stopRecording, showResults, endSession, abandonText,
} from "../ui/session-ui.js";
import { renderPassage, measureLayout } from "./layout.js";
import { cursorCheck } from "./accuracy.js";
import { safeSend } from "./send.js";
import { frameLoop } from "./frames.js";

/**
 * Loads the Passage and a token (live mode), opens the connection and starts sending frames.
 * @param {(text: string) => void} showError reports a failure on the start screen
 */
export async function startSession(showError) {
  const params = new URLSearchParams(location.search);

  let token = null;
  if (!CONFIG.useMock) {
    const passageId = params.get("passage") ?? "default";
    try {
      state.passage = await loadPassage(CONFIG.serviceHttpUrl, passageId);
      // Created last: the token is single-use and expires within a minute.
      ({ token } = await createSession(CONFIG.webServerUrl, passageId));
    } catch (err) {
      return showError(err.message);
    }
  }

  showScreen("session");
  renderPassage(state.passage);
  resetSessionUi();
  setPhase("connecting");

  const conn = openConnection({ token, passage: state.passage });
  state.conn = conn;
  conn.onMessage = handleMessage;
  conn.onClose = (code) => {
    if (state.phase !== "done" && state.phase !== "ended") {
      endSession(closeMessage(code));
    }
  };

  try {
    await conn.ready;
  } catch (err) {
    endSession(err.message);
    return;
  }
  requestAnimationFrame(frameLoop);
}

function handleMessage(msg) {
  switch (msg.type) {
    case "hello_ack":
      state.version = msg.version;
      // Wait one frame so the Passage has its final size, then report the Cell Layout.
      requestAnimationFrame(() => {
        const layout = measureLayout();
        if (!safeSend(layout)) return;
        state.layout = layout;
        state.layoutSent = true;
        showCalibrationGuide();
      });
      break;

    case "calibration_status":
      onCalibrationStatus(msg);
      break;

    case "reading_started":
      // In mock mode the mouse is the gaze, so comparing the two would always give zero.
      if (!CONFIG.useMock) {
        const first = state.layout?.cells.find((c) => c.row === 0 && c.col === 0);
        state.cursorCheck = cursorCheck({ gaze: msg.gaze, cursor: state.cursor, cell: first });
      }
      break;

    case "fixation":
      onFixation(msg.row, msg.col);
      break;

    case "completed":
      state.phase = "done";
      stopRecording();
      showResults(msg.result);
      break;

    case "abandoned":
      endSession(abandonText(msg.reason));
      break;

    case "error":
      console.warn("Service error:", msg.code, msg.message);
      break;
  }
}
