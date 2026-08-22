export type {
	ICourierAdminClientOptions,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';
export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export type {
	IUseTemplateReturn,
	IUseTemplateRevisionsReturn,
	IUseTemplatesReturn,
} from './hooks';
export {
	useTemplate,
	useTemplateRevisions,
	useTemplates,
} from './hooks';
