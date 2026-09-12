import express from 'express';

import { cors, mount } from '@fonderie/adapter-express';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Vercel detects this Express app and serves it — no wrapper, no listen.
const app = mount(express(), fonderie);


// CORS for a browser frontend on another origin. The adapter's defaults already
// allow every header @fonderie/client sends (X-Request-ID, traceparent,
// X-Workspace-ID) — a missing one makes the preflight reject the WHOLE request.
// The client always fetches with credentials, so the origin must be explicit.
const frontendUrl = process.env['FRONTEND_URL'];
if (frontendUrl) app.use(cors({ credentials: true, origin: frontendUrl }));

app.use(config.basePath ?? '/v1', buildTodoRouter(store));

export default app;
