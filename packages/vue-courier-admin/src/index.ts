export type {
	IBuiltInTemplate,
	ICourierAdminClientOptions,
	IPreviewTemplateInput,
	IRenderedTemplateResult,
	IRollbackTemplateInput,
	ISetTemplateInput,
	ITemplateCatalog,
	ITemplateCatalogEntry,
	ITemplateEntry,
	ITemplateResolution,
	ITemplateRevision,
} from '@fonderie/client';

export { CourierAdminClient, FonderieApiError } from '@fonderie/client';
export {
	useBuiltInTemplate,
	useTemplate,
	useTemplateCatalog,
	useTemplateResolution,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from './composables';
