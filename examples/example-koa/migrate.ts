import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie/store';
import { getMigrationsPath as authMig } from '@fonderie/auth/migrations';
import { getMigrationsPath as evtMig }  from '@fonderie/events/migrations';

// Standalone migration runner — run it yourself against your deploy database:
//   DATABASE_URL=<your-db> npm run migrate
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const store = new PGAdapter(process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_koa')

for (const dir of [evtMig(), authMig()]) {
	await new InternalMigrationRunner(store, dir).run()
}
await new MigrationRunner(store, join(__dirname, 'migrations/sql')).run()

console.log('✓ migrations applied')
process.exit(0)
