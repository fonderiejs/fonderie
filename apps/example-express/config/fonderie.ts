import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import { FonderieApp, defineConfig }                           from '@fonderie-js/core';
import { withBody }                                            from '@fonderie-js/core/middlewares';
import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie-js/store';
import { EventsModule }                                        from '@fonderie-js/events';
import { AuthModule }                                          from '@fonderie-js/auth';
import { getMigrationsPath as authMig }                        from '@fonderie-js/auth/migrations';
import { getMigrationsPath as evtMig }                         from '@fonderie-js/events/migrations';

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const config = defineConfig({
	basePath: '/v1',
	db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_express' },
})

export const store = new PGAdapter(config.db.url)

for (const dir of [evtMig(), authMig()]) {
	await new InternalMigrationRunner(store, dir).run()
}

await new MigrationRunner(store, join(__dirname, '../migrations/sql')).run()

const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } })
const auth   = new AuthModule(store, {
	jwtSecret:           process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',
	appName:             'TodoApp',
	providers:           ['email'],
	requireVerification: false,
}, events.bus)

export const fonderie = new FonderieApp(config)
	.use(withBody)
	.register(events)
	.register(auth)

await fonderie.boot()
