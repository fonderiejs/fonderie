import { InternalMigrationRunner, PGAdapter } from '@fonderie/store';
import { getMigrationsPath as authMigrations } from '@fonderie/auth/migrations';
import { getMigrationsPath as workspacesMigrations } from '@fonderie/workspaces/migrations';

/**
 * Schema owner. Migrations deliberately do NOT run at boot: on serverless every
 * cold start would re-run them on the request path and concurrent instances
 * would race each other.
 *
 * Run once per deploy, against the DIRECT database connection — a
 * transaction-mode pooler is unreliable for DDL:
 *
 *   DATABASE_URL='<direct-connection>' npm run migrate
 *
 * Order matters: auth owns fonderie_users, which workspaces references.
 */
async function main() {
	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) {
		console.error('DATABASE_URL is not set.');
		process.exit(1);
	}

	const store = new PGAdapter(databaseUrl);
	if (!(await store.testConnection())) {
		throw new Error('Cannot connect to the database — check DATABASE_URL.');
	}

	for (const [name, path] of [
		['auth', authMigrations()],
		['workspaces', workspacesMigrations()],
	] as const) {
		process.stdout.write(`  ${name} … `);
		await new InternalMigrationRunner(store, path).run();
		console.log('done');
	}
	console.log('✅ migrations complete');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
