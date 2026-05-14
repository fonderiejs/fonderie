import { createMigrationsPath } from '@fonderie-js/store'

export function getMigrationsPath(): string {
	return createMigrationsPath(import.meta.url)
}
