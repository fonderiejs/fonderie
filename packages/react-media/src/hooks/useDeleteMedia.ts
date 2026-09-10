import type { MediaClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseDeleteMediaReturn {
	remove: (id: string) => Promise<void>;
	isDeleting: boolean;
	error: FonderieApiError | null;
}

// Delete an asset you uploaded (DELETE /media/:id — uploader-only server-side).
export function useDeleteMedia(client?: MediaClient): IUseDeleteMediaReturn {
	const media = useFonderieSubClient(client, (c) => c.media, 'useDeleteMedia');
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const remove = useCallback(
		async (id: string) => {
			setIsDeleting(true);
			setError(null);
			try {
				await media.delete(id);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsDeleting(false);
			}
		},
		[media],
	);

	return { remove, isDeleting, error };
}
