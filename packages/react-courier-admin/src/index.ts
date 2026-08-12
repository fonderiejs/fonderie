export type {
	ICourierAdminClientOptions,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';
export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export type {
	IUseDeleteTemplateReturn,
	IUseSaveTemplateReturn,
	IUseTemplateReturn,
	IUseTemplateRevisionsReturn,
	IUseTemplatesReturn,
} from './hooks';
export {
	useDeleteTemplate,
	useSaveTemplate,
	useTemplate,
	useTemplateRevisions,
	useTemplates,
} from './hooks';
