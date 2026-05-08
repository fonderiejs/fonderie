import { PGAdapter, MigrationRunner } from '@fonderie-js/store';
import { getMigrationsPath as authMigrations }        from '@fonderie-js/auth/migrations';
import { getMigrationsPath as workspacesMigrations }  from '@fonderie-js/workspaces/migrations';
import { getMigrationsPath as billingMigrations }     from '@fonderie-js/billing/migrations';
import { getMigrationsPath as configMigrations }      from '@fonderie-js/config/migrations';
import { getMigrationsPath as permissionsMigrations } from '@fonderie-js/permissions/migrations';
import { getMigrationsPath as courierMigrations }     from '@fonderie-js/courier/migrations';

const store = new PGAdapter(
	process.env['DATABASE_URL'] ?? 'postgres://fonderie:fonderie@localhost:5432/fonderie_test'
);

// Run each package's migrations in dependency order
const steps: Array<[string, string]> = [
	['auth',        authMigrations()],
	['permissions', permissionsMigrations()],
	['workspaces',  workspacesMigrations()],
	['billing',     billingMigrations()],
	['config',      configMigrations()],
	['courier',     courierMigrations()],
];

for (const [name, dir] of steps) {
	console.log(`[migrate] running ${name} from ${dir}`);
	await new MigrationRunner(store, dir).run();
	console.log(`[migrate] ${name} done`);
}

console.log('[migrate] done');
process.exit(0);
