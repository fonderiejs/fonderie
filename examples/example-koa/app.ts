import Koa        from 'koa';
import bodyParser from 'koa-bodyparser';

import { cors, mount } from '@fonderie/adapter-koa';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Build the Koa app. Exported for the local server (index.ts).
export const app = new Koa();
app.use(bodyParser());


// CORS for a browser frontend on another origin. The adapter's defaults already
// allow every header @fonderie/client sends (X-Request-ID, traceparent,
// X-Workspace-ID) — a missing one makes the preflight reject the WHOLE request.
// The client always fetches with credentials, so the origin must be explicit.
const frontendUrl = process.env['FRONTEND_URL'];
if (frontendUrl) app.use(cors({ credentials: true, origin: frontendUrl }));

mount(app, fonderie);

const todos = buildTodoRouter(store, config.basePath ?? '/v1');
app.use(todos.routes());
app.use(todos.allowedMethods());

// Vercel needs a Node request listener — Koa's app.callback() is exactly that.
export default app.callback();
