# Ocurate frontend

Browser client for Ocurate, a webcam-based Braille reading tracker. The gaze-analysis service lives in https://github.com/iMichael02/ocurate. This repo is the browser side: webcam, MediaPipe, Passage rendering, calibration UI and live feedback. Read [README.md](./README.md) first.

## Stack rules

- **Plain HTML, CSS and JavaScript only.** Use ES modules (`<script type="module">`), `fetch` and the browser's `WebSocket`. Do not add a framework (React, Vue, etc.), TypeScript, a bundler, a transpiler or a CSS preprocessor.
- **Node.js is tooling only.** It serves the files in development and installs libraries (MediaPipe Tasks Vision). No application code runs on Node, and the browser must load the app as shipped, with no build step.
- A new npm dependency needs a reason. Prefer the platform. Import libraries from `node_modules` through ES module paths or an import map.
- Camera access requires `localhost` or HTTPS.
- Write modern JS (`const`/`let`, `async`/`await`, modules). Add JSDoc type comments on message shapes instead of TypeScript.

## Source of truth

The protocol is defined in the service repo. Do not invent or change message shapes here. Read the service's `docs/websocket-protocol.md` and `docs/session-transcript.md` (links in README.md), and `architecture-design.md` section 0. If the protocol needs to change, change it there first.

Fetch current versions with `gh api repos/iMichael02/ocurate/contents/<path> -H 'Accept: application/vnd.github.raw'`. Issue #1 is the product specification.

## Domain terms

Use the glossary in the service's `CONTEXT.md` in code and UI text: **Learner**, **Session**, **Abandoned Session**, **Calibration**, **Braille Cell**, **Cell Layout**, **Passage**, **Reading Speed**, **Fixation**, **Saccade**, **Regression**, **Skipped Character**. Avoid "user", "trainee", "caregiver", "profile" and "backtrack".

## Protocol rules that the client must follow

- Message order: `hello` (with `version` and `token`) → `layout` (once) → calibration frames with `target` → `calibration_done` → frames without `target` → `fixation` events → `completed`.
- Supported versions are 1 and 2. Send `eye_centres` only on version 2. The service validates every message with `extra="forbid"`, so do not add fields.
- Calibration: 4×4 grid, 0.1 to 0.9 evenly spaced, 16 targets, about 30 frames each. Show per-point status from `calibration_status`. On `failed`, send `calibration_restart` (max 3 attempts in total, then the Session is abandoned).
- `t` is the browser capture time in ms and must strictly increase. Never use arrival time. Cap the frame rate at about 30 per second.
- Landmarks are in camera-image coordinates, and `layout` and `target` are in viewport coordinates. Do not mix them. Landmark order is fixed (see README.md).
- `matrix` is row-major 4×4. MediaPipe's flat array is probably column-major, so transpose it. Verify against real output and update the protocol doc in the service repo if wrong.
- `layout` rectangles must cover the Passage's grid exactly (row and column counts, no duplicates), and be inside the viewport.
- Any resize, fullscreen change or scroll sends `viewport_changed`. Handle `abandoned` and socket close by showing the reason and offering a new Session. There is no resume or reconnect.
- The session token is single-use and short-lived (60 s by default). Connect right after getting it.
- The browser never reports results to the web server. Display what `completed` carries.
- Handle the `error` codes: `unsupported_version`, `invalid_token`, `invalid_message`, `out_of_order`, `timestamp_regression`, `calibration_failed`. Close codes: 1000 normal, 4400 invalid message, 4401 bad token, 4408 timeout, 4409 unsupported version.

## Privacy

- Raw video and eye crops never leave the device. No uploads, no canvas snapshots sent anywhere, no recording.
- Do not log landmarks, tokens or results (including to `console` in committed code).
- Do not persist calibration data, landmarks or tokens in `localStorage`, `sessionStorage`, IndexedDB or cookies.

## Working in this repo

- Keep modules small and separated by concern, for example: camera and MediaPipe capture, socket client and message builders, calibration UI, reading UI, Cell Layout measurement, results view. Keep the socket client independent of the DOM so it can be driven by a mock.
- A scripted mock client that plays a full Session (from the service repo's transcript) is the way to develop the UI without the service. Keep the real and mock clients behind the same interface.
- Support keyboard use and screen readers for all controls and results. Learners are training for work with blind people, so accessibility matters here.
- Update README.md when you change how to run or configure the app. Do not duplicate protocol details here or in README.md beyond the summary. Link to the service repo.
- Commit only when asked.

## Commands

- `npm install` installs libraries
- `npm run dev` serves the static files locally (`npx http-server`, fetched on demand and not a dependency: a zero-config static server with caching off, used so MediaPipe's WASM files and ES modules load over http)
- `npm test` runs the pure-logic unit tests (`test/*.test.js`, Node's built-in runner). Keep logic that has no DOM in its own module so it stays testable this way.


