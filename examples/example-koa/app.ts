import Koa        from 'koa';
import bodyParser from 'koa-bodyparser';

import { mount } from '@fonderie/adapter-koa';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Build the Koa app. Exported for the local server (index.ts).
export const app = new Koa();
app.use(bodyParser());

mount(app, fonderie);

const todos = buildTodoRouter(store, config.basePath ?? '/v1');
app.use(todos.routes());
app.use(todos.allowedMethods());

// Vercel needs a Node request listener — Koa's app.callback() is exactly that.
export default app.callback();
