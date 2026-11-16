// Shared Session state and tiny helpers used by every module of the page.

import { DEFAULT_PASSAGE } from "./reading/passage.js";

export const $ = (id) => document.getElementById(id);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const round = (v) => Math.round(v * 1e4) / 1e4;

export const state = {
  passage: DEFAULT_PASSAGE,
  conn: null,
  phase: "idle",          // idle | connecting | guide | calibrating | calibration_failed | reading | done | ended
  target: null,           // current calibration target sent with frames
  landmarkerReady: false,
  layoutSent: false,
  version: 1,             // negotiated protocol version (hello_ack); 2 adds eye_centres
  lastFrameT: 0,
  fixations: 0,
  activeCell: null,
  recStart: 0,
  recTimer: null,
  calibRun: 0,
  calibJudged: false,     // the service answered the last calibration attempt (ready or failed)
};

export function setPhase(phase) {
  state.phase = phase;
}
