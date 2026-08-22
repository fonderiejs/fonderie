export type {
	ICourierAdminClientOptions,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';

export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export {
	useTemplate,
	useTemplateRevisions,
	useTemplates,
} from './composables';
