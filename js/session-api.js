// Asks the web server to create a Session for this Learner. The web server owns
// the API key and calls the gaze-analysis service (POST /sessions); the browser
// only receives the short-lived, single-use token. The token is never put in a
// URL, so it cannot end up in history, logs or Referer headers.

const MESSAGES = {
  401: "Please sign in again, then start a new session.",
  404: "That passage does not exist.",
  429: "Too many sessions at the moment. Try again in a minute.",
  503: "The reading service is busy or unavailable. Try again shortly.",
};

export async function createSession(baseUrl, passageId, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ passage_id: passageId }),
    });
  } catch {
    throw new Error("Could not reach the web server.");
  }

  if (!response.ok) throw new Error(MESSAGES[response.status] ?? "Could not start a session.");

  const body = await response.json().catch(() => null);
  if (!body || typeof body.token !== "string" || !body.token || typeof body.session_id !== "string") {
    throw new Error("The web server sent an unexpected answer.");
  }

  return {
    sessionId: body.session_id,
    passageId: body.passage_id ?? passageId,
    token: body.token,
    expiresIn: body.expires_in,
  };
}
