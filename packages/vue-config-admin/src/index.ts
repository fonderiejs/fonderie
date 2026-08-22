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
	useRevealSecret,
	useSecret,
	useSecretRevisions,
	useSecrets,
} from './composables';
