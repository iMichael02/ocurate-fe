// Sends a message to the service; a broken socket ends the Session.

import { state } from "../state.js";
import { endSession } from "../ui/session-ui.js";

export function safeSend(msg) {
  try {
    state.conn.send(msg);
    return true;
  } catch {
    if (state.phase !== "done") endSession("Connection to the service was lost.");
    return false;
  }
}
