import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Each package calls this with its own import.meta.url to resolve
// the absolute path to its compiled migrations/sql/ directory.
// Called from dist/migrations/index.js, so dirname is already dist/migrations/.
//
// Usage in any package's migrations/index.ts:
//   export const getMigrationsPath = () => createMigrationsPath(import.meta.url)
export function createMigrationsPath(importMetaUrl: string): string {
	return join(dirname(fileURLToPath(importMetaUrl)), 'sql');
}
