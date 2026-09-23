import type {
	CourierAdminClient,
	IPreviewTemplateInput,
	IRenderedTemplateResult,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseTemplatePreviewReturn {
	preview: IRenderedTemplateResult | null;
	isPreviewing: boolean;
	error: FonderieApiError | null;
	renderPreview: (
		type: string,
		input: IPreviewTemplateInput,
		locale?: string | null,
	) => Promise<IRenderedTemplateResult>;
	clearPreview: () => void;
}

// On demand, not on mount: the caller decides when the editor's content is
// worth rendering. Server-side, so what comes back is what the resolver
// produces — the layout shell and the variable substitution included.
export function useTemplatePreview(client: CourierAdminClient): IUseTemplatePreviewReturn {
	const [preview, setPreview] = useState<IRenderedTemplateResult | null>(null);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const renderPreview = useCallback(
		async (type: string, input: IPreviewTemplateInput, locale?: string | null) => {
			setIsPreviewing(true);
			setError(null);
			try {
				const { result } = await client.previewTemplate(type, input, locale);
				setPreview(result);
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsPreviewing(false);
			}
		},
		[client],
	);

	const clearPreview = useCallback(() => setPreview(null), []);

	return { preview, isPreviewing, error, renderPreview, clearPreview };
}
