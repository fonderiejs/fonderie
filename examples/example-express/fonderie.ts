import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter }                from '@fonderie/store';
import { EventsModule }             from '@fonderie/events';
import { AuthModule }               from '@fonderie/auth';

const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_express' },
})

export const store = new PGAdapter(config.db.url)

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })
const auth   = new AuthModule(store, {
	jwtSecret:           process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:             'TodoApp',
	providers:           ['email'],
	requireVerification: false,
}, events.bus)

export { config }
export const fonderie = new FonderieApp(config)
	.register(events)
	.register(auth)

await fonderie.boot()
