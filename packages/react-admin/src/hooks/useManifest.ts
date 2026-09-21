import type { AdminClient, IAdminManifest } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseManifestReturn {
	manifest: IAdminManifest | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useManifest(client: AdminClient): IUseManifestReturn {
	const [manifest, set] = useState<IAdminManifest | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.manifest();
			set(result);
		} catch (err) {
			setError(
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
			);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { manifest, isLoading, error, refresh };
}
