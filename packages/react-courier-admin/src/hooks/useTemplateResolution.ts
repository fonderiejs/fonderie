import type { CourierAdminClient, ITemplateResolution } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseTemplateResolutionReturn {
	resolution: ITemplateResolution | null;
	isResolving: boolean;
	error: FonderieApiError | null;
	/** Which version a send in `locale` would use. */
	resolve: (type: string, locale?: string | null) => Promise<ITemplateResolution | null>;
}

// Who receives what — asked of the server, which decides with the same function
// a real send runs.
export function useTemplateResolution(client: CourierAdminClient): IUseTemplateResolutionReturn {
	const [resolution, setResolution] = useState<ITemplateResolution | null>(null);
	const [isResolving, setIsResolving] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const resolve = useCallback(
		async (type: string, locale?: string | null) => {
			setIsResolving(true);
			setError(null);
			try {
				const { result } = await client.resolveTemplate(type, locale);
				setResolution(result);
				return result;
			} catch (err) {
				setError(
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
				);
				setResolution(null);
				return null;
			} finally {
				setIsResolving(false);
			}
		},
		[client],
	);

	return { resolution, isResolving, error, resolve };
}
