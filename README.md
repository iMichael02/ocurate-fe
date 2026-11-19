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

This starts the page in **mock mode**, which needs no backend. To talk to the real service, see [Real service mode](#real-service-mode-mock0). The shell commands in this README are for Unix shells (Linux, macOS, WSL, Git Bash). On Windows PowerShell, set variables with `$env:NAME="value"` instead of `NAME=value command`.

## Mock mode (default)

`js/service/mock-service.js` plays the service, so the whole flow runs without a backend:
same messages, same order, same calibration rules (12 of 16 points, every row and column).
It can't estimate gaze, so **during reading the mouse pointer is the gaze**: hover over each
Cell from the top-left one to the last one. On protocol version 3 it sends a fixed, made-up
calibration error, and the cursor check is turned off (the pointer would be compared with itself).

Switch modes in `js/config.js` (`useMock`) or with the URL: `?mock=0` / `?mock=1`.

## Real service mode (`?mock=0`)

Needs the service running with `/ws`, `GET /passages/{id}` and `POST /sessions` (see its README), and a web server that creates Sessions for the Learner.

How a Session starts:

1. The Learner clicks **Start reading test**. The page loads the Passage from the service, then asks the web server for a Session: `POST {webServerUrl}/sessions` with `{"passage_id": "default"}` (`js/service/session-api.js`; `webServerUrl` is `/api` in `js/config.js`).
2. The web server checks the Learner's sign-in, calls the service's `POST /sessions` with its API key, and answers `{session_id, passage_id, token, expires_in}`. The API key never reaches the browser.
3. The page opens the WebSocket straight away and sends the token in `hello`. The token is single use and expires in 60 s by default, which is why it is requested last, at the click, and not when the page loads.

The token is never read from, or written to, the page URL, so it cannot leak through browser history, server logs or `Referer`. In production use `https://` and `wss://` URLs in `js/config.js`, and the web server should authenticate `POST /sessions` with its session cookie and reject cross-site requests (a `SameSite` cookie plus an `Origin` check, or a CSRF token).

### Local development without a web server

`scripts/dev-server.js` (`npm run dev:service`) stands in for the web server. It serves this folder **and** answers `POST /api/sessions` by calling the service with the API key. It has no sign-in, listens on 127.0.0.1 only, and is for development only.

Do not use `npm run dev` for live mode: it only serves static files and has no `/api/sessions`, so the page cannot get a Session token.

Run these in order, from the two repos' folders. The values below are the defaults of the service's `.env.example`:

```
# Terminal 1, in the service repo: start MySQL, create the Passages, run the service
cp -n .env.example .env
set -a; . ./.env; set +a
docker compose up -d --wait mysql
venv/bin/python -m app.passages.passage_store
venv/bin/uvicorn app.app:app            # no --reload while OCURATE_DEV_MODE=1

# Terminal 2, in this repo: serve the page and the Session endpoint
npm install
OCURATE_API_KEY=dev-api-key npm run dev:service
```

Instead of putting the key on the command line, copy `.env.example` to `.env` (git ignores it), set `OCURATE_API_KEY` there, and run plain `npm run dev:service`. A variable already set in the shell wins over `.env`.

Then open **http://localhost:5173/?mock=0** (the `?mock=0` switch selects the real service; without it you get the mock). The badge at the top should read "Live service", not "Mock service".

`OCURATE_API_KEY` must be the same value in both terminals (`dev-api-key` comes from the service's `.env`). The service must list `http://localhost:5173` in `OCURATE_ALLOWED_ORIGINS` (also set by its `.env.example`).

If the page cannot connect:

| Message on the start screen | Check |
|---|---|
| "Could not load passage (…)" or a network error | The service is not running on `localhost:8000`, or MySQL is not started or seeded (`curl localhost:8000/passages` must list `default`). |
| "Could not reach the web server." | You ran `npm run dev` instead of `npm run dev:service`, or the dev server is not running. |
| "The reading service is busy or unavailable" (503) | The service cannot reach its database, or `OCURATE_API_KEY` differs between the two terminals. |
| "Could not reach the gaze-analysis service" | The WebSocket was refused: the page's origin is not in `OCURATE_ALLOWED_ORIGINS`. Open the page as `localhost` (not `127.0.0.1`), or list that origin. |
| Session ends right after the click | The token expired or was used already: click **Start reading test** again. Also happens when uvicorn runs with `--reload` and `OCURATE_DEV_MODE=1`. |

## Test

```
npm test
```

Runs `test/*.test.js` with Node's built-in test runner; the tests themselves need no install.

## Git hooks

[Husky](https://typicode.github.io/husky/) runs ESLint (`npm run lint`) and the unit tests before each commit, and rejects commit
messages with a line over 120 characters. `npm install` sets the hooks up through the `prepare` script, so there is nothing else to do.
CI runs the same lint and tests on every push.

## Files

| File | What it does |
|---|---|
| `index.html` | All screens: start, calibration overlay, reading, results and "session ended" modals |
| `css/styles.css` | Styles (colors are variables at the top) |
| `js/config.js` | Settings: mock on/off, service URLs, frame rate, calibration timing |
| `js/app.js` | Entry point: wires the modules below together |
| `js/state.js` | Shared Session state and small helpers |
| `js/ui/start-screen.js` | Start screen: camera preview, mode badge, start button |
| `js/ui/session-ui.js` | Screen switching, recording clock, results and "session ended" modals |
| `js/session/session.js` | Starts a Session and routes the service's messages |
| `js/session/frames.js` | Captures and sends `frame` messages |
| `js/session/layout.js` | Draws the Passage and measures the `layout` message |
| `js/session/guards.js` | Resize/scroll/fullscreen, Escape and mock-pointer listeners |
| `js/session/send.js` | Sends a message; a broken socket ends the Session |
| `js/session/accuracy.js` | Gaze accuracy figures: calibration error and cursor check in Cells (no DOM) |
| `js/calibration/calibration-flow.js` | The 16-dot calibration and the service's verdict |
| `js/reading/reading-ui.js` | Live reading feedback (fixated Cell, progress) |
| `js/camera/face-tracker.js` | Webcam + MediaPipe Face Landmarker → the `frame` landmark subset |
| `js/calibration/main.js` | Standalone calibration-screen demo (screen switching); not loaded by `index.html`, which uses `app.js` |
| `js/calibration/calibration-grid.js` | The grid of calibration target positions |
| `js/calibration/calibration-screen.js` | Draws the calibration dots on screen |
| `js/calibration/sequence.js` | Plays items one at a time (used to show the dots in order) |
| `js/camera/eye-centre.js` | Timm & Barth eye-centre port of the service's `eye_centre.py` |
| `js/camera/eye-crop.js` | Cuts the eye crops from the video frame |
| `js/service/connection.js` | Same interface for the real WebSocket and the mock |
| `js/service/mock-service.js` | Fake service for testing without the backend |
| `js/service/session-api.js` | Asks the web server for a Session and returns the token |
| `scripts/dev-server.js` | Development stand-in for the web server (static files + `POST /api/sessions`) |
| `js/reading/passage.js` | Braille table and default Passage (same as `passage.py`) |

## Things to check / to do

- **Matrix order**: `face-tracker.js` transposes MediaPipe's matrix (column-major → row-major) as the
  protocol doc says. Verified on real output (translation in `data[12..14]`).
- **Protocol v2** (`eye_centres`) is implemented: `js/camera/eye-centre.js` is the Timm & Barth port of the service's `eye_centre.py` (replays its golden crops, `test/golden/eye-centre.json`), `js/camera/eye-crop.js` cuts the eye crops per docs/eye-centre.md, and `js/camera/face-tracker.js` adds `eye_centres` to each frame when the negotiated version is 2. Set `protocolVersion: 1` in `js/config.js` to send landmarks only.
- **Protocol v3** (gaze accuracy) is implemented. After a ready calibration the page shows the service's
  held-out `calibration_error_px` with Continue and Start over (a new Session). The results show it as
  "Calibration error" and, with a real mouse resting on the first Cell when reading starts, a "Cursor check"
  comparing `reading_started.gaze` with the pointer. Conversion to Cells is in `js/session/accuracy.js`:
  the error in px divided by the mean of the Cell width and height in px (from the `layout` sent); the
  cursor check scales each axis by its own Cell size. A cursor more than half a Cell outside the first Cell
  is discarded and the line is left out. Nothing is stored, logged or sent.
- **Version fallback:** if the service answers `unsupported_version`, `js/service/connection.js` retries once on a new socket with the highest version in `supported` below the refused one (`js/service/version.js`), so the page still works against an older service. The token is unused at that point, because the version is checked first. The negotiated version comes from `hello_ack`.
- **Note:** no scrolling or resizing is allowed during a Session: it sends `viewport_changed` and the Session ends.
