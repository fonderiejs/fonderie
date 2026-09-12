import { cors, mount } from '@fonderie/adapter-express';
import express from 'express';

import { fonderie } from './fonderie.js';

/**
 * The deployment entrypoint. Vercel's Node web-server builder searches
 * `app.*` → `index.*` → `server.*` and serves the **default export**, so this
 * file default-exports the app and never listens — `index.ts` owns the
 * long-running server and Vercel never runs it.
 *
 * Importing `express` directly here is load-bearing: that is how Vercel
 * detects which server to run.
 */
const app = express();

// CORS for a browser frontend on another origin — app-level so it covers every
// route, including ones outside the Fonderie pipeline (/health here). The
// defaults already allow every header @fonderie/client sends; the client always
// sends credentialed requests, so the origin must be explicit.
const frontendUrl = process.env['FRONTEND_URL'];
if (frontendUrl) {
	app.use(cors({ credentials: true, origin: frontendUrl }));
}

// Liveness probe. Minimal ON PURPOSE: core also serves /healthz and /readyz
// once fonderie is mounted, but this one exists even before a database is
// configured, and neither names the stack. Reporting `fonderie: true` plus the
// module list here would hand a scanner the whole inventory — which modules are
// installed is exactly what it wants to know.
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

// mount() wires body parsing, context, and the /v1 routes onto Express. It
// appends fonderie's catch-all after the routes registered above, so nothing
// may be registered as a terminal handler after this point — it would shadow
// every fonderie route.
if (fonderie) {
	mount(app, fonderie);
} else {
	// No database, so no fonderie catch-all: answer unknown paths ourselves
	// rather than let Express reply with its default "Cannot GET /x" HTML,
	// which both leaks the framework and looks like a crash.
	app.use((_req, res) => {
		res.status(404).json({ reason: 'NOT_FOUND', explanation: 'Not found' });
	});
}

// The API host is not a page. A browser that lands here goes to the app; with
// no frontend configured it behaves like any unknown path — a 404 discloses
// nothing and is indistinguishable from "nothing here". Deliberately uniform
// for every caller: branching on Accept would itself be a fingerprint.
app.get('/', (_req, res) => {
	if (frontendUrl) return res.redirect(302, frontendUrl);
	return res.status(404).json({ reason: 'NOT_FOUND', explanation: 'Not found' });
});

export default app;
