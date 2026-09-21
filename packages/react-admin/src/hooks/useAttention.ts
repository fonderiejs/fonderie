import type { AdminClient, IAdminAttention } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAttentionReturn {
	attention: IAdminAttention | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useAttention(client: AdminClient): IUseAttentionReturn {
	const [attention, set] = useState<IAdminAttention | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.attention();
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

	return { attention, isLoading, error, refresh };
}
