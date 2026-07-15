import { createMigrationsPath } from '@fonderie/store';

export function getMigrationsPath(): string {
	return createMigrationsPath(import.meta.url);
}
