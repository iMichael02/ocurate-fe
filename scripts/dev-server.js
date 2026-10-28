// Development stand-in for the web server: serves this folder and answers
// POST /api/sessions by calling the gaze-analysis service with the API key.
// NOT for production. It does no sign-in, so anyone who can reach it can start
// a Session. It listens on 127.0.0.1 only.
//
//   OCURATE_API_KEY=dev-key node scripts/dev-server.js
//
// Optional: OCURATE_SERVICE_URL (default http://localhost:8000), PORT (default 5173).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SERVICE = process.env.OCURATE_SERVICE_URL ?? 'http://localhost:8000';
const API_KEY = process.env.OCURATE_API_KEY;
const PORT = Number(process.env.PORT ?? 5173);
const MAX_BODY = 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.task': 'application/octet-stream',
};

if (!API_KEY) {
  console.error('Set OCURATE_API_KEY (the same value the service uses).');
  process.exit(1);
}

// Only the files the page needs: no dotfiles, no node_modules, nothing outside the folder.
export function staticPath(urlPath) {
  const relative = normalize(decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath)).replace(/^[/\\]+/, '');
  const full = resolve(join(ROOT, relative));
  const parts = relative.split(sep);
  const allowed = full.startsWith(ROOT + sep) && !parts.some((p) => p.startsWith('.') || p === 'node_modules' || p === 'scripts' || p === 'test');
  return allowed ? full : null;
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function createSession(request, response) {
  let passageId;
  try {
    passageId = JSON.parse(await readBody(request)).passage_id;
  } catch {
    passageId = undefined;
  }
  if (typeof passageId !== 'string' || !passageId) {
    response.writeHead(422).end();
    return;
  }

  try {
    const upstream = await fetch(`${SERVICE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ passage_id: passageId }),
    });
    response.writeHead(upstream.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(await upstream.text());
  } catch {
    response.writeHead(503).end();
  }
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');

  if (pathname === '/api/sessions') {
    if (request.method !== 'POST') return response.writeHead(405, { Allow: 'POST' }).end();
    return createSession(request, response);
  }

  if (request.method !== 'GET') return response.writeHead(405).end();

  const file = staticPath(pathname);
  try {
    if (!file) throw new Error('not allowed');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT} (sessions via ${SERVICE})`));
