// ── Public API ───────────────────────────────────────────────────
export { ConfigModule } from './module';
export { RemoteConfigManager, CONFIG_MANAGER_KEY } from './manager';
export { configContextMiddleware, getConfig } from './middlewares/config-context';
export {
	listConfigEntries,
	getConfigEntry,
	setConfigEntry,
	deleteConfigEntry,
	rollbackConfigEntry,
	listConfigRevisions,
	ConfigConflictError,
} from './services/config';

export type { IConfigEntry, IConfigRevision, IConfigSnapshot } from './types';
export type { IConfigOptions } from './config';
