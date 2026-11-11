// Turns a getUserMedia failure into a short status and an explanation the Learner can act on.
// The browser reports the cause in `error.name`; the old page showed "Camera blocked" for all of them.

const CAUSES = {
  NotAllowedError: {
    status: "Camera permission denied",
    help: "The browser or your system refused camera access. Allow the camera for this site in the browser's site settings, check your system's camera privacy settings, then reload the page.",
  },
  PermissionDeniedError: {
    status: "Camera permission denied",
    help: "The browser or your system refused camera access. Allow the camera for this site in the browser's site settings, check your system's camera privacy settings, then reload the page.",
  },
  NotFoundError: {
    status: "No camera found",
    help: "The browser could not find a camera. Plug one in, or pick the right one in the browser's camera settings, then reload the page.",
  },
  DevicesNotFoundError: {
    status: "No camera found",
    help: "The browser could not find a camera. Plug one in, or pick the right one in the browser's camera settings, then reload the page.",
  },
  NotReadableError: {
    status: "Camera is busy or unavailable",
    help: "The camera exists but could not be started. Another app or browser tab may be using it, or the system is blocking it. Close other apps that use the camera, quit and reopen the browser, then try again.",
  },
  TrackStartError: {
    status: "Camera is busy or unavailable",
    help: "The camera exists but could not be started. Another app or browser tab may be using it, or the system is blocking it. Close other apps that use the camera, quit and reopen the browser, then try again.",
  },
  OverconstrainedError: {
    status: "Camera does not support the settings",
    help: "The selected camera cannot provide the video this page asks for. Choose a different camera in the browser's camera settings and try again.",
  },
  SecurityError: {
    status: "Camera not allowed on this page",
    help: "The browser only allows the camera on https:// pages or on localhost. Open the page from one of those.",
  },
  AbortError: {
    status: "Camera start was interrupted",
    help: "Starting the camera was interrupted. Try again.",
  },
};

/**
 * @param {unknown} error whatever getUserMedia (or startCamera) threw
 * @returns {{ status: string, help: string, name: string }}
 */
export function describeCameraError(error) {
  const name = typeof error?.name === "string" ? error.name : "Error";

  // No `navigator.mediaDevices` at all: an insecure page (http:// on another host) or an old browser.
  // Browsers raise a TypeError for this, so the name alone is not enough to tell it apart.
  if (name === "TypeError" && !globalThis.navigator?.mediaDevices) {
    return {
      name,
      status: "Camera not available on this page",
      help: "This browser does not offer camera access here. Use https:// or http://localhost, and a recent version of Chrome or Firefox.",
    };
  }

  const known = CAUSES[name];
  if (known) return { name, ...known };

  return {
    name,
    status: "Camera could not start",
    help: `The camera failed to start (${name}). Check that it is connected and not used by another app, then reload the page.`,
  };
}
