// ── Public API ───────────────────────────────────────────────────
export { ConfigModule } from './module';
export { buildAdminRoutes } from './admin';export { RemoteConfigManager, CONFIG_MANAGER_KEY } from './manager';
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
// Key rotation. Deliberately a library call and not an admin route: rotating
// needs the NEW key, and putting a fresh master key in a request body sends it
// through every log and proxy in front of the surface.
export { rotateSecretKey } from './services/rotate';
export type { IRotationReport } from './services/rotate';
export type { ISecretEncryptor } from './crypto';
export type { IConfigOptions } from './config';
