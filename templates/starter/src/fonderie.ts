import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { AuthModule } from '@fonderie/auth';
import { WorkspacesModule } from '@fonderie/workspaces';

/**
 * Store + modules + boot. Imported by `app.ts`; never starts a server and
 * never migrates (see `migrate.ts` for why).
 *
 * Fonderie is wired only when a database is configured. Without DATABASE_URL
 * the app still boots and serves /health and /, so `npm run dev` works the
 * moment you scaffold.
 */
export const databaseUrl = process.env['DATABASE_URL'];

export const store = databaseUrl ? new PGAdapter(serverlessPool(databaseUrl)) : null;

// A serverless instance serves one request at a time, and every warm instance
// keeps its own pool — pg's default of 10 multiplies across instances and
// exhausts a shared connection pooler. A long-running host keeps the default.
function serverlessPool(url: string) {
	return process.env['VERCEL']
		? { connectionString: url, max: Number(process.env['PG_POOL_MAX'] ?? 1) }
		: url;
}

export const modules: string[] = [];

export const fonderie = await (async () => {
	if (!store || !databaseUrl) {
		console.warn(
			'⚠️  DATABASE_URL is not set — Fonderie modules are disabled. ' +
				'Copy .env.example to .env and set DATABASE_URL to enable /v1 routes.',
		);
		return null;
	}

	const app = new FonderieApp(
		defineConfig({
			basePath: '/v1',
			db: { url: databaseUrl },
		}),
	);

	app.register(
		new AuthModule(store, {
			jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-me-min-32-chars-long',
			appName: 'Fonderie Starter',
			providers: ['email'],
			requireVerification: false,
		}),
	);
	app.register(new WorkspacesModule(store));

	await app.boot();
	modules.push('auth', 'workspaces');
	return app;
})();
