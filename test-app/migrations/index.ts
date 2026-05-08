import { fileURLToPath }               from 'node:url';
import { join }                        from 'node:path';

import { PGAdapter, MigrationRunner } from '@fonderie-js/store';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const store = new PGAdapter(
	process.env['DATABASE_URL'] ?? 'postgres://fonderie:fonderie@localhost:5432/fonderie_test'
);

const migrations = new MigrationRunner(store, join(__dirname, 'sql'));
await migrations.run();

console.log('[migrate] done');
process.exit(0);
