import { Hono } from 'hono';

import { mount } from '@fonderie/adapter-hono';

import { config, fonderie, store }   from './fonderie.js';
import { buildStarterRouter }        from './starter.routes.js';

// Fonderie's own routes come first: /v1/auth/*, /v1/workspaces/*, /v1/billing/*,
// /v1/audit. Then the starter-facing router, which adds this app's projects and
// devices and re-shapes the rest into the contract the mobile app expects.
const app = mount(new Hono(), fonderie)

app.route(config.basePath ?? '/v1', buildStarterRouter(fonderie, store, config.basePath ?? '/v1'))

export default app;
