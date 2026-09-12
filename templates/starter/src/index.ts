import { FonderieApp, defineConfig } from '@fonderie/core';
import { withCors } from '@fonderie/core/middlewares';
import { PGAdapter } from '@fonderie/store';
import { AuthModule } from '@fonderie/auth';
import { WorkspacesModule } from '@fonderie/workspaces';
import { mount } from '@fonderie/adapter-express';
import express from 'express';

async function main() {
	const app = express();

	// Fonderie is mounted only when a database is configured. Without
	// DATABASE_URL we degrade gracefully: the server still boots and serves
	// /health and /, so you can `npm run dev` immediately after scaffolding.
	const databaseUrl = process.env.DATABASE_URL;
	let modules: string[] = [];

	if (databaseUrl) {
		const store = new PGAdapter(databaseUrl);

		const fonderie = new FonderieApp(
			defineConfig({
				basePath: '/v1',
				db: { url: databaseUrl },
			}),
		);

		// CORS for a browser frontend on another origin. @fonderie/client always
		// sends credentialed requests, so the origin must be explicit; the
		// middleware's defaults already allow every header the client sends.
		const frontendUrl = process.env.FRONTEND_URL;
		if (frontendUrl) {
			fonderie.use(withCors({ credentials: true, origin: frontendUrl }));
		}

		fonderie.register(
			new AuthModule(store, {
				jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me-min-32-chars-long',
				appName: 'Fonderie Starter',
				providers: ['email'],
				requireVerification: false,
			}),
		);
		fonderie.register(new WorkspacesModule(store));

		await fonderie.boot();

		// mount() wires body parsing, context, and the /v1 routes onto Express.
		mount(app, fonderie);
		modules = ['auth', 'workspaces'];
	} else {
		console.warn(
			'⚠️  DATABASE_URL is not set — Fonderie modules are disabled. ' +
				'Copy .env.example to .env and set DATABASE_URL to enable /v1 routes.',
		);
	}

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

	const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
	app.listen(port, () => {
		console.log(`🚀 Server ready at http://localhost:${port}`);
		console.log(`📚 API base: http://localhost:${port}/v1`);
	});
}

main().catch(console.error);
