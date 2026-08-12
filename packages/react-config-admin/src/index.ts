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
	IUseDeleteConfigEntryReturn,
	IUseDeleteSecretReturn,
	IUseRevealSecretReturn,
	IUseSaveConfigEntryReturn,
	IUseSaveSecretReturn,
	IUseSecretReturn,
	IUseSecretRevisionsReturn,
	IUseSecretsReturn,
} from './hooks';
export {
	useConfigEntries,
	useConfigEntry,
	useConfigRevisions,
	useDeleteConfigEntry,
	useDeleteSecret,
	useRevealSecret,
	useSaveConfigEntry,
	useSaveSecret,
	useSecret,
	useSecretRevisions,
	useSecrets,
} from './hooks';
