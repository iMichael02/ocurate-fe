import test from "node:test";
import assert from "node:assert/strict";
import { describeCameraError } from "../js/camera-error.js";

const named = (name) => Object.assign(new Error("x"), { name });

test("tells apart the common getUserMedia failures", () => {
  assert.match(describeCameraError(named("NotAllowedError")).status, /permission denied/i);
  assert.match(describeCameraError(named("NotFoundError")).status, /no camera found/i);
  assert.match(describeCameraError(named("NotReadableError")).status, /busy or unavailable/i);
  assert.match(describeCameraError(named("OverconstrainedError")).status, /does not support/i);
  assert.match(describeCameraError(named("SecurityError")).status, /not allowed on this page/i);
});

test("a busy camera is explained as a busy camera, not as blocked permissions", () => {
  const { help } = describeCameraError(named("NotReadableError"));
  assert.match(help, /another app/i);
  assert.doesNotMatch(help, /permission/i);
});

test("older browsers' error names map to the same causes", () => {
  assert.equal(describeCameraError(named("PermissionDeniedError")).status, describeCameraError(named("NotAllowedError")).status);
  assert.equal(describeCameraError(named("DevicesNotFoundError")).status, describeCameraError(named("NotFoundError")).status);
  assert.equal(describeCameraError(named("TrackStartError")).status, describeCameraError(named("NotReadableError")).status);
});

test("an unknown error still names itself so it can be searched for", () => {
  const result = describeCameraError(named("WeirdError"));
  assert.equal(result.name, "WeirdError");
  assert.match(result.help, /WeirdError/);
});

test("a TypeError without navigator.mediaDevices means the page is not secure or the browser is too old", () => {
  assert.equal(globalThis.navigator?.mediaDevices, undefined);
  assert.match(describeCameraError(named("TypeError")).status, /not available on this page/i);
});

test("a thrown value that is not an Error does not crash the handler", () => {
  assert.equal(describeCameraError(undefined).name, "Error");
  assert.equal(describeCameraError("nope").name, "Error");
});
