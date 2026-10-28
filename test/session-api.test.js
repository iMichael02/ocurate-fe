import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../js/session-api.js';

const ok = (body) => async () => ({ ok: true, status: 201, json: async () => body });
const status = (code) => async () => ({ ok: false, status: code, json: async () => ({}) });

test('posts the passage id to the web server and returns the session', async () => {
  let call;
  const fetchImpl = async (url, init) => {
    call = { url, init };
    return { ok: true, status: 201, json: async () => ({ session_id: 's1', passage_id: 'default', token: 't.k', expires_in: 60 }) };
  };

  const session = await createSession('/api', 'default', fetchImpl);

  assert.equal(call.url, '/api/sessions');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(call.init.body), { passage_id: 'default' });
  assert.deepEqual(session, { sessionId: 's1', passageId: 'default', token: 't.k', expiresIn: 60 });
});

test('never puts the token in a URL', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: true, status: 201, json: async () => ({ session_id: 's1', token: 'secret-token' }) };
  };

  await createSession('/api', 'default', fetchImpl);

  assert.ok(urls.every((u) => !u.includes('secret-token')));
});

test('maps known failures to a message for the Learner', async () => {
  await assert.rejects(createSession('/api', 'default', status(401)), /sign in/);
  await assert.rejects(createSession('/api', 'default', status(503)), /unavailable/);
  await assert.rejects(createSession('/api', 'default', status(500)), /Could not start a session/);
});

test('reports an unreachable web server', async () => {
  const down = async () => { throw new TypeError('failed'); };

  await assert.rejects(createSession('/api', 'default', down), /Could not reach the web server/);
});

test('rejects an answer without a token', async () => {
  await assert.rejects(createSession('/api', 'default', ok({ session_id: 's1' })), /unexpected/);
  await assert.rejects(createSession('/api', 'default', ok(null)), /unexpected/);
});
