export type {
	ICourierAdminClientOptions,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';

export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export {
	useDeleteTemplate,
	useSaveTemplate,
	useTemplate,
	useTemplateRevisions,
	useTemplates,
} from './composables';
