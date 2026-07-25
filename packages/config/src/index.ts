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

// Secrets — the masked/encryptable kind (same lifecycle as config, separate
// table + read path). `revealSecret` is the only path that returns plaintext.
export {
	listSecrets,
	getSecret,
	revealSecret,
	setSecret,
	rollbackSecret,
	listSecretRevisions,
	deleteSecret,
} from './services/secrets';
export type { ISecretEntry, ISecretRevision } from './types';
export { noopEncryptor, createAesGcmEncryptor } from './crypto';
export type { ISecretEncryptor } from './crypto';
export type { IConfigOptions } from './config';
