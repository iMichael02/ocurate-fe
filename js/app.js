// Entry point: wires the screens together. The work lives in the modules below.
//   ui/start-screen.js            camera preview and the start button
//   session/session.js            starts a Session and routes the service's messages
//   session/frames.js             sends webcam frames
//   calibration/calibration-flow.js  the 16-dot calibration
//   reading/reading-ui.js         live reading feedback
//   ui/session-ui.js              screens, clock, results and "session ended" modals

import { initStartScreen } from "./ui/start-screen.js";
import { initEndButtons } from "./ui/session-ui.js";
import { initCalibration } from "./calibration/calibration-flow.js";
import { installGuards } from "./session/guards.js";
import { startSession } from "./session/session.js";

initStartScreen(startSession);
initCalibration();
initEndButtons();
installGuards();
