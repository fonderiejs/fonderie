import { createMigrationsPath } from '@fonderie/store';

export const getMigrationsPath = (): string => createMigrationsPath(import.meta.url);
