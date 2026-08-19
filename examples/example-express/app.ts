import express from 'express';

import { mount } from '@fonderie/adapter-express';

import { config, fonderie, store } from './fonderie.js';
import { buildTodoRouter }         from './todo.routes.js';

// Vercel detects this Express app and serves it — no wrapper, no listen.
const app = mount(express(), fonderie);

app.use(config.basePath ?? '/v1', buildTodoRouter(store));

export default app;
