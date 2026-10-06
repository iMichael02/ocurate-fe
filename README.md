# Ocurate frontend

Browser client for [Ocurate](https://github.com/iMichael02/ocurate), a webcam-based tool that tracks a Learner's gaze while they read Braille on screen, so their reading can be evaluated.

The browser owns the webcam. It runs MediaPipe Face Landmarker locally, so **raw video never leaves the device**. It renders the Passage and the calibration targets, then streams landmark frames to the gaze-analysis service over one WebSocket. The service replies with live Fixation events and, at the end, the result.

This repo is plain **HTML, CSS and JavaScript** (ES modules). There is no framework, no TypeScript and no bundler. Node.js is used only to serve the files in development and to install third-party libraries such as MediaPipe.

## How it fits together

```
Browser (this repo)            Web server                 Gaze service (ocurate)
 webcam + MediaPipe             accounts, history DB       Session state, gaze model
 Passage + calibration UI
      │── login ───────────────────►│
      │                             │── POST /sessions ───────►│
      │◄── session id + token ──────│◄─ session id + token ────│
      │── GET /passages/{id} ──────────────────────────────────►│
      │══════════════ WebSocket (token) ═══════════════════════►│
      │                             │◄── signed result callback │
```

Session flow in the browser:

1. Get a session id and short-lived token from the web server. The token is single-use, so every Session needs a fresh one.
2. Fetch the Passage with `GET /passages/{id}` and render it.
3. Open the WebSocket. Send `hello` with the protocol `version` and the token.
4. Send `layout` once: the viewport size and one normalized rectangle per Cell.
5. **Calibration:** show a 4×4 grid of targets (0.1 to 0.9 on each axis). Tag each frame with the current `target`. Show the per-point `calibration_status`. On `failed`, send `calibration_restart` (up to 3 attempts in total). On `ready`, send `calibration_done`.
6. **Reading:** stream frames without a `target`. Highlight the Cell from each `fixation` message.
7. On `completed`, show Reading Speed (CPM, WPM) and the secondary metrics (saccades, regressions, skipped characters). On `abandoned`, show the reason. The browser never sends the result to the web server. The service delivers it through a signed callback.

A resize, fullscreen change or scroll ends the Session. The browser must send `viewport_changed` when that happens. There is no resume. The Learner starts a new Session and recalibrates.

## Contract

The protocol is defined in the service repo, not here. Read these before changing any code that touches the socket:

- [WebSocket protocol](https://github.com/iMichael02/ocurate/blob/main/docs/websocket-protocol.md): every message, field, error code and close code.
- [Example Session transcript](https://github.com/iMichael02/ocurate/blob/main/docs/session-transcript.md): a full Session, message by message.
- [Architecture design](https://github.com/iMichael02/ocurate/blob/main/architecture-design.md), section 0: the split between browser, web server and service.
- [Eye centre](https://github.com/iMichael02/ocurate/blob/main/docs/eye-centre.md): the Timm & Barth crop and algorithm the browser runs for protocol version 2.
- [Domain glossary](https://github.com/iMichael02/ocurate/blob/main/CONTEXT.md): Learner, Session, Cell Layout and the other terms.
- [Specification (issue #1)](https://github.com/iMichael02/ocurate/issues/1): user stories and decisions.

Points that are easy to get wrong:

- Landmark order is fixed: `iris` is left eye 474–477, then right eye 469–472. `eye_corners` is left eye (362, 263, 386, 374), then right eye (133, 33, 159, 145). `nose` is the nose tip.
- Landmark `x` and `y` are sent as MediaPipe reports them, normalized to the camera image. `layout` and `target` are normalized to the viewport.
- `matrix` is 4 rows of 4 numbers, row-major. MediaPipe's flat array is probably column-major, so transpose it. This is not yet verified against real output.
- `t` is the browser capture time in ms. It must strictly increase. Cap the frame rate at about 30 per second.
- Send `eye_centres` only on a version 2 Session.
- Send no frames for 30 s and the Session is abandoned.

## Requirements

- A recent Node.js (LTS) and npm, for development only.
- A browser with WebGL and `getUserMedia`. Camera access needs `localhost` or HTTPS.
- A running Ocurate gaze service, or the mock client below.

## Setup

```
npm install
npm run dev
```

Open http://localhost:5173. Run `npm test` for the unit tests. The scripts are defined in `package.json`.

## Mock service

To build the UI before the real service is available, use the scripted mock client from the service repo. It plays a full Session, so the UI can be developed against it.

## Privacy rules

- Never send, store or log video frames or eye crops.
- Send only the landmark subset, the transformation matrix and the optional eye centres.
- Never log landmarks, tokens or results to the console in committed code.

## License

Not yet chosen.
