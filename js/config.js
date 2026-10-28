// Frontend settings. Change these here instead of inside the code.

export const CONFIG = {
  // true  = use the fake service in mock-service.js (works today, no backend needed)
  // false = connect to the real gaze-analysis service over WebSocket
  // You can also force it from the URL: index.html?mock=0 or ?mock=1
  useMock: true,

  // Real service (only used when useMock is false).
  // The browser asks the web server for a Session (POST {webServerUrl}/sessions) and gets the
  // token back in the response. The token is never read from the page URL.
  // Use wss:// and https:// outside local development.
  webServerUrl: "/api",
  serviceWsUrl: "ws://localhost:8000/ws",
  serviceHttpUrl: "http://localhost:8000",

  // Protocol version sent in `hello`. Version 2 adds the browser-computed eye centres
  // (Timm & Barth, js/eye-centre.js) to every frame; use 1 to send landmarks only.
  protocolVersion: 2,

  // Frame rate cap (architecture-design.md: about 30 frames per second).
  maxFps: 30,

  // How long each calibration dot takes to shrink until it is no longer visible.
  calibrationMsPerPoint: 1200,
  // Frames right after a dot moves are not tagged, so the eyes have time to land on it.
  calibrationSettleMs: 300,
  // Pause with no dot on screen before the next one appears.
  calibrationGapMs: 250,

  // MediaPipe Face Landmarker (runs in the browser, video never leaves it).
  mediapipeVersion: "0.10.14",
  faceModelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};

const param = new URLSearchParams(location.search).get("mock");
if (param === "0") CONFIG.useMock = false;
if (param === "1") CONFIG.useMock = true;
