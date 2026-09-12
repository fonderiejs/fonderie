import { cors, mount } from '@fonderie/adapter-express';
import express from 'express';

import { fonderie, modules } from './fonderie.js';

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

// mount() wires body parsing, context, and the /v1 routes onto Express.
if (fonderie) mount(app, fonderie);

app.get('/health', (_req, res) => {
	res.json({ status: 'ok', fonderie: true, modules });
});

app.get('/', (_req, res) => {
	res.json({
		message: 'Fonderie backend is running',
		version: '0.1.0',
		try: ['GET /health', 'GET /v1/auth/me'],
		next: 'Open Claude Code and say: "Add billing to this app."',
	});
});

export default app;
