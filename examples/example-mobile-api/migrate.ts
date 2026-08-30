import { fileURLToPath } from 'node:url';
import { join }          from 'node:path';

import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '@fonderie/store';
import { getMigrationsPath as authMig }       from '@fonderie/auth/migrations';
import { getMigrationsPath as billingMig }    from '@fonderie/billing/migrations';
import { getMigrationsPath as eventsMig }     from '@fonderie/events/migrations';
import { getMigrationsPath as workspacesMig } from '@fonderie/workspaces/migrations';

// Standalone migration runner — NOT part of app boot, so you control exactly
// when your production schema changes:
//
//   DATABASE_URL=<your-db> npm run migrate
//
// Order matters: events first (the audit log reads from it), then auth, then
// workspaces, then billing. This app's own tables come last.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const store = new PGAdapter(process.env['DATABASE_URL'] ?? 'postgres://localhost/fonderie_mobile')

for (const dir of [eventsMig(), authMig(), workspacesMig(), billingMig()]) {
	await new InternalMigrationRunner(store, dir).run()
}
await new MigrationRunner(store, join(__dirname, 'migrations/sql')).run()

console.log('✓ migrations applied')
process.exit(0)
