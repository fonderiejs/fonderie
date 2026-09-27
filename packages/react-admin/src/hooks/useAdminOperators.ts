import type {
	AdminClient,
	AdminScope,
	IAdminCreatedLink,
	IAdminOperator,
	IAdminOperatorsReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminOperatorsReturn {
	report: IAdminOperatorsReport | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	/** Highest scope + a fresh code (403 STEP_UP_REQUIRED otherwise). The link is in the result once. */
	invite: (input: {
		email: string;
		scopes: AdminScope[];
		expiresInHours?: number;
	}) => Promise<IAdminCreatedLink>;
	recover: (id: string) => Promise<IAdminCreatedLink>;
	update: (
		id: string,
		input: { scopes?: AdminScope[]; name?: string; disabled?: boolean },
	) => Promise<IAdminOperator>;
	revokeLink: (id: string) => Promise<void>;
}

export function useAdminOperators(client: AdminClient): IUseAdminOperatorsReturn {
	const [report, set] = useState<IAdminOperatorsReport | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.operators();
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
		invite: (input) => write(() => client.inviteOperator(input)),
		recover: (id) => write(() => client.recoverOperator(id)),
		update: (id, input) => write(() => client.updateOperator(id, input)),
		revokeLink: async (id) => {
			await write(() => client.revokeOperatorLink(id));
		},
	};
}
