import type {
	AdminClient,
	IAdminEnrollment,
	IAdminSecondFactor,
	IAdminSession,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminSessionReturn {
	/** null until the first read. `state` says which screen to show. */
	session: IAdminSession | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	/** One-time: `rootClient` must carry the root adminToken. */
	claim: (
		rootClient: AdminClient,
		input: { email: string; password: string; name?: string },
	) => Promise<IAdminSession>;
	login: (input: { email: string; password: string }) => Promise<IAdminSession>;
	enrollment: () => Promise<IAdminEnrollment>;
	confirmEnrollment: (code: string) => Promise<IAdminSession>;
	verify: (factor: IAdminSecondFactor) => Promise<IAdminSession>;
	stepUp: (factor: IAdminSecondFactor) => Promise<void>;
	logout: () => Promise<void>;
	inspectLink: (token: string) => Promise<{ kind: 'invite' | 'recovery'; email: string }>;
	redeemLink: (input: { token: string; password: string; name?: string }) => Promise<IAdminSession>;
}

// The operator sign-in flow. The session itself is an HttpOnly cookie the
// browser holds — this hook only ever sees its state.
export function useAdminSession(client: AdminClient): IUseAdminSessionReturn {
	const [session, setSession] = useState<IAdminSession | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.session();
			setSession(result);
		} catch (err) {
			setError(toError(err));
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const run = useCallback(async <T>(fn: () => Promise<{ result: T }>, keep = true): Promise<T> => {
		setError(null);
		try {
			const { result } = await fn();
			if (keep)
				setSession(
					(prev) =>
						({
							...(prev ?? { state: 'signed-out', operator: null }),
							...(result as object),
						}) as IAdminSession,
				);
			return result;
		} catch (err) {
			const e = toError(err);
			setError(e);
			throw e;
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		session,
		isLoading,
		error,
		refresh,
		claim: (rootClient, input) => run(() => rootClient.claim(input)),
		login: (input) => run(() => client.login(input)),
		enrollment: () => run(() => client.enrollment(), false),
		confirmEnrollment: (code) => run(() => client.confirmEnrollment(code)),
		verify: (factor) => run(() => client.verify(factor)),
		stepUp: async (factor) => {
			await run(() => client.stepUp(factor));
		},
		logout: async () => {
			await run(() => client.logout(), false);
			setSession((prev) => ({
				state: 'signed-out',
				operator: null,
				claimable: prev?.claimable ?? false,
			}));
		},
		inspectLink: (token) => run(() => client.inspectLink(token), false),
		redeemLink: (input) => run(() => client.redeemLink(input)),
	};
}
