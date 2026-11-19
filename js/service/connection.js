// One connection per Session. Same interface for the real WebSocket and the mock:
//   conn.send(obj)          send a protocol message
//   conn.onMessage = fn     called with each parsed message from the service
//   conn.onClose = fn       called with the close code
//   conn.close()

import { CONFIG } from "../config.js";
import { MockService } from "./mock-service.js";
import { fallbackVersion } from "./version.js";

export function openConnection({ token, passage }) {
  return CONFIG.useMock ? new MockConnection(passage) : new WsConnection(token);
}

class WsConnection {
  constructor(token) {
    this.onMessage = () => {};
    this.onClose = () => {};
    this.token = token;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.open(CONFIG.protocolVersion);
  }

  // Opens a socket and says hello with `version`. If the service refuses the version and supports a
  // lower one (the version is checked before the token, so the token is still unused), the same
  // hello is sent once more on a new socket with that version. Nothing of the refused attempt
  // reaches onMessage or onClose.
  open(version) {
    const ws = new WebSocket(CONFIG.serviceWsUrl);
    this.ws = ws;
    let retrying = false;
    ws.onopen = () => {
      // First message: protocol version + token (version is checked first).
      this.send({ type: "hello", version, token: this.token });
      this.resolveReady();
    };
    ws.onerror = () => this.rejectReady(new Error("Could not reach the gaze-analysis service"));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "error" && msg.code === "unsupported_version" && !this.retried) {
        const lower = fallbackVersion(msg.supported, version);
        if (lower !== null) {
          this.retried = true;
          retrying = true;
          this.open(lower);
          return;
        }
      }
      this.onMessage(msg);
    };
    ws.onclose = (e) => {
      if (!retrying) this.onClose(e.code);
    };
  }

  send(msg) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Connection is not open");
    }
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws.close(1000);
  }
}

class MockConnection {
  constructor(passage) {
    this.onMessage = () => {};
    this.onClose = () => {};
    this.service = new MockService(passage, (msg) => this.onMessage(msg), (code) => this.onClose(code));
    this.ready = Promise.resolve().then(() =>
      this.send({ type: "hello", version: CONFIG.protocolVersion, token: "mock-token" })
    );
  }
  send(msg) {
    // Round-trip through JSON so the mock sees exactly what the real socket would.
    this.service.receive(JSON.parse(JSON.stringify(msg)));
  }
  close() {
    this.service.close();
  }
  // Mock only: lets the mouse stand in for gaze during reading.
  setPointer(x, y) {
    this.service.pointer = { x, y };
  }
}
