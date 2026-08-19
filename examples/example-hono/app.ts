import { Hono } from 'hono';

import { mount } from '@fonderie/adapter-hono';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Vercel's Node server builder detects this file (it imports hono) and serves
// the default-exported app via app.fetch — no wrapper needed.
const app = mount(new Hono(), fonderie);

app.route(config.basePath ?? '/v1', buildTodoRouter(store));

export default app;
