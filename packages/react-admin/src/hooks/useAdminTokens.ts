import type {
	AdminClient,
	IAdminIssuedToken,
	IAdminIssueTokenInput,
	IAdminTokensReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminTokensReturn {
	report: IAdminTokensReport | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	// Root token only; the plaintext is in the result once.
	issue: (input: IAdminIssueTokenInput) => Promise<IAdminIssuedToken>;
	// Root token only.
	revoke: (id: string) => Promise<void>;
}

export function useAdminTokens(client: AdminClient): IUseAdminTokensReturn {
	const [report, set] = useState<IAdminTokensReport | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.tokens();
			set(result);
		} catch (err) {
			setError(toError(err));
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const write = useCallback(
		async <T>(fn: () => Promise<{ result: T }>): Promise<T> => {
			setError(null);
			try {
				const { result } = await fn();
				await refresh();
				return result;
			} catch (err) {
				const e = toError(err);
				setError(e);
				throw e;
			}
		},
		[refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		report,
		isLoading,
		error,
		refresh,
		issue: (input) => write(() => client.issueToken(input)),
		revoke: async (id) => {
			await write(() => client.revokeToken(id));
		},
	};
}
