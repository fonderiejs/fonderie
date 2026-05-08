import { createMigrationsPath } from '@fonderie-js/store';

export const getMigrationsPath = (): string => createMigrationsPath(import.meta.url)
