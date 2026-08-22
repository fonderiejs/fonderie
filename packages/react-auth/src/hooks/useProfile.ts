import type {
	AuthClient,
	IUpdatePreferencesInput,
	IUpdateProfileInput,
	IUserDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseProfileReturn {
	user: IUserDTO | null;
	refresh: () => Promise<void>;
	updateProfile: (input: IUpdateProfileInput) => Promise<IUserDTO>;
	updatePreferences: (input: IUpdatePreferencesInput) => Promise<IUserDTO>;
	// Email/phone changes re-fetch the profile (their endpoints don't return it).
	updateEmail: (email: string) => Promise<void>;
	updatePhone: (phone: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useProfile(client?: AuthClient): IUseProfileReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useProfile');
	const [user, setUser] = useState<IUserDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await auth.getUser();
			setUser(result.user);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [auth]);

	const mutate = useCallback(
		async <T>(op: () => Promise<T>): Promise<T> => {
			setError(null);
			try {
				return await op();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[],
	);

	const updateProfile = useCallback(
		(input: IUpdateProfileInput) =>
			mutate(async () => {
				const { result } = await auth.updateProfile(input);
				setUser(result.user);
				return result.user;
			}),
		[auth, mutate],
	);

	const updatePreferences = useCallback(
		(input: IUpdatePreferencesInput) =>
			mutate(async () => {
				const { result } = await auth.updatePreferences(input);
				setUser(result.user);
				return result.user;
			}),
		[auth, mutate],
	);

	const updateEmail = useCallback(
		(email: string) =>
			mutate(async () => {
				await auth.updateEmail(email);
				await refresh();
			}),
		[auth, mutate, refresh],
	);

	const updatePhone = useCallback(
		(phone: string) =>
			mutate(async () => {
				await auth.updatePhone(phone);
				await refresh();
			}),
		[auth, mutate, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { user, refresh, updateProfile, updatePreferences, updateEmail, updatePhone, isLoading, error };
}
