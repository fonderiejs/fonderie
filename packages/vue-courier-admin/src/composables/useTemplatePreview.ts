import type {
	CourierAdminClient,
	IPreviewTemplateInput,
	IRenderedTemplateResult,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// On demand, not on mount: the caller decides when the editor's content is
// worth rendering. Server-side, so what comes back is what the resolver
// produces — the layout shell and the variable substitution included.
export function useTemplatePreview(client: CourierAdminClient) {
	const preview = ref<IRenderedTemplateResult | null>(null);
	const isPreviewing = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function renderPreview(
		type: string,
		input: IPreviewTemplateInput,
		locale?: string | null,
	): Promise<IRenderedTemplateResult> {
		isPreviewing.value = true;
		error.value = null;
		try {
			const { result } = await client.previewTemplate(type, input, locale);
			preview.value = result;
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isPreviewing.value = false;
		}
	}

	const clearPreview = () => {
		preview.value = null;
	};

	return { preview, isPreviewing, error, renderPreview, clearPreview };
}
