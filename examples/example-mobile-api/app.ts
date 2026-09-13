import { Hono } from 'hono';

import { bridge, mount } from '@fonderie/adapter-hono';

import { config, fonderie, store }   from './fonderie.js';
import { buildStarterRouter }        from './starter.routes.js';

const app = new Hono();

// bridge() runs fonderie's global middleware on every request, populating
// c.var._fonderie with { user, workspace, meta }. It must come FIRST: the
// starter router's guards (adapt(requireAuth), withWorkspace) read that
// context, and without it every one of them throws
// "bridge() must be registered before adapt()".
//
// It is registered here rather than inside mount() because mount() attaches
// fonderie's own routes as a catch-all, which by definition runs last — so it
// is the wrong place to install middleware that everything else depends on.
app.use('*', bridge(fonderie));

// Fonderie's own routes (/v1/auth/*, /v1/workspaces/*, /v1/billing/*,
// /v1/audit) go on as the catch-all, so they resolve only after this app's
// routes have had their say.
mount(app, fonderie);

// The starter-facing router: this app's projects and devices, plus the rest
// re-shaped into the contract the mobile client expects.
app.route(config.basePath ?? '/v1', buildStarterRouter(fonderie, store, config.basePath ?? '/v1'));

export default app;
