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
} from './composables';
