# Ocurate frontend

Plain HTML + CSS + JavaScript (ES modules, no build step) for the Ocurate Braille reading test.
It follows the browser ↔ service contract in the service repo's [docs/websocket-protocol.md](https://github.com/iMichael02/ocurate/blob/main/docs/websocket-protocol.md).

## Run it

ES modules don't load from `file://`, so serve the folder:

```
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Firefox, click **Enable camera**, then **Start reading test**.

## Mock mode (default)

`js/mock-service.js` plays the service, so the whole flow runs without a backend:
same messages, same order, same calibration rules (12 of 16 points, every row and column).
It can't estimate gaze, so **during reading the mouse pointer is the gaze**: hover over each
Cell from the top-left one to the last one.

Switch modes in `js/config.js` (`useMock`) or with the URL: `?mock=0` / `?mock=1`.

## Real service mode (`?mock=0`)

Needs the service running with `/ws`, `GET /passages/{id}` and `POST /sessions` (see its README), and a web server that creates Sessions for the Learner.

How a Session starts:

1. The Learner clicks **Start reading test**. The page loads the Passage from the service, then asks the web server for a Session: `POST {webServerUrl}/sessions` with `{"passage_id": "default"}` (`js/session-api.js`; `webServerUrl` is `/api` in `js/config.js`).
2. The web server checks the Learner's sign-in, calls the service's `POST /sessions` with its API key, and answers `{session_id, passage_id, token, expires_in}`. The API key never reaches the browser.
3. The page opens the WebSocket straight away and sends the token in `hello`. The token is single use and expires in 60 s by default, which is why it is requested last, at the click, and not when the page loads.

The token is never read from, or written to, the page URL, so it cannot leak through browser history, server logs or `Referer`. In production use `https://` and `wss://` URLs in `js/config.js`, and the web server should authenticate `POST /sessions` with its session cookie and reject cross-site requests (a `SameSite` cookie plus an `Origin` check, or a CSRF token).

### Local development without a web server

`scripts/dev-server.js` stands in for the web server. It serves this folder and answers `POST /api/sessions` by calling the service with the API key. It has no sign-in, listens on 127.0.0.1 only, and is for development only.

```
# terminal 1: the service, with the same key
OCURATE_API_KEY=dev-key OCURATE_DEV_MODE=1 OCURATE_DATABASE_URL=… venv/bin/uvicorn app:app
# terminal 2: this page
OCURATE_API_KEY=dev-key npm run dev:service
```

Open http://localhost:5173/?mock=0. The service must allow this origin (CORS for `/passages`) once that is configured.

## Files

| File | What it does |
|---|---|
| `index.html` | All screens: start, calibration overlay, reading, results and "session ended" modals |
| `css/styles.css` | Styles (colors are variables at the top) |
| `js/config.js` | Settings: mock on/off, service URLs, frame rate, calibration timing |
| `js/app.js` | Main flow: screens, sending `layout` / `frame` / `calibration_*`, handling replies |
| `js/face-tracker.js` | Webcam + MediaPipe Face Landmarker → the `frame` landmark subset |
| `js/connection.js` | Same interface for the real WebSocket and the mock |
| `js/mock-service.js` | Fake service for testing without the backend |
| `js/session-api.js` | Asks the web server for a Session and returns the token |
| `scripts/dev-server.js` | Development stand-in for the web server (static files + `POST /api/sessions`) |
| `js/passage.js` | Braille table and default Passage (same as `passage.py`) |

## Things to check / to do

- **Matrix order**: `face-tracker.js` transposes MediaPipe's matrix (column-major → row-major) as the
  protocol doc says. Verified on real output (translation in `data[12..14]`).
- **Protocol v2** (`eye_centres`) is implemented: `js/eye-centre.js` is the Timm & Barth port of the service's `eye_centre.py` (replays its golden crops, `test/golden/eye-centre.json`), `js/eye-crop.js` cuts the eye crops per docs/eye-centre.md, and `js/face-tracker.js` adds `eye_centres` to each frame when the negotiated version is 2. Set `protocolVersion: 1` in `js/config.js` to send landmarks only.
- **No scrolling or resizing** during a Session: it sends `viewport_changed` and the Session ends.
