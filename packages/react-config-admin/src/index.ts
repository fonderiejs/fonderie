export type {
	IConfigAdminClientOptions,
	IConfigEntry,
	IConfigRevision,
	IRollbackInput,
	ISecretEntry,
	ISecretRevision,
	ISetConfigInput,
	ISetSecretInput,
} from '@fonderie/client';
export { ConfigAdminClient, FonderieApiError } from '@fonderie/client';
export type {
	IUseConfigEntriesReturn,
	IUseConfigEntryReturn,
	IUseConfigRevisionsReturn,
	IUseRevealSecretReturn,
	IUseSecretReturn,
	IUseSecretRevisionsReturn,
	IUseSecretsReturn,
} from './hooks';
export {
	useConfigEntries,
	useConfigEntry,
	useConfigRevisions,
	useRevealSecret,
	useSecret,
	useSecretRevisions,
	useSecrets,
} from './hooks';
