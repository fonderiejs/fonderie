import { Hono } from 'hono';

import { cors, mount } from '@fonderie/adapter-hono';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Vercel's Node server builder detects this file (it imports hono) and serves
// the default-exported app via app.fetch — no wrapper needed.
const app = mount(new Hono(), fonderie);


// CORS for a browser frontend on another origin. The adapter's defaults already
// allow every header @fonderie/client sends (X-Request-ID, traceparent,
// X-Workspace-ID) — a missing one makes the preflight reject the WHOLE request.
// The client always fetches with credentials, so the origin must be explicit.
const frontendUrl = process.env['FRONTEND_URL'];
if (frontendUrl) app.use('*', cors({ credentials: true, origin: frontendUrl }));

app.route(config.basePath ?? '/v1', buildTodoRouter(store));

export default app;
