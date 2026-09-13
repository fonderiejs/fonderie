import { AuthModule }               from '@fonderie/auth';
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter }                from '@fonderie/store';
import { EventsModule }             from '@fonderie/events';
import { Channel }                  from '@fonderie/courier';

const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_koa' },
})

export const store = new PGAdapter(config.db.url)

// `consume` decides whether THIS process delivers what it publishes, and the
// right answer depends on where it runs — which is why it is spelled out
// rather than left to the default.
//
// A long-running host (index.ts) LISTENs and delivers in milliseconds. Vercel
// cannot: a poll loop never returns, and LISTEN is rejected outright by a
// transaction-mode pooler, so start() throws and nothing is ever consumed.
// Publishing keeps working either way — which is exactly what makes the
// failure silent once you add a consumer such as @fonderie/courier.
// See examples/DEPLOYMENT.md § "If the app sends email".
const events = new EventsModule({
	transport: {
		type: 'pg',
		connectionUrl: config.db.url,
		consume: !process.env['VERCEL'],
	},
})
const auth   = new AuthModule(store, {
	jwtSecret:           process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:             'TodoApp',
	providers:           [Channel.EMAIL],
	requireVerification: false,
}, events.bus)

export { config }
export const fonderie = new FonderieApp(config)
	.register(events)
	.register(auth)

await fonderie.boot()
