export type {
	ICourierAdminClientOptions,
	IPreviewTemplateInput,
	IRenderedTemplateResult,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';

export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export {
	useTemplate,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from './composables';
