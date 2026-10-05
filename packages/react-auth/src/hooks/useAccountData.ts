import type {
	AuthClient,
	IAccountDeletionResult,
	IConfirmAccountDeletionInput,
	IRequestAccountDeletionInput,
	IRequestAccountDeletionResult,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { clearToken } from '../storage';

export interface IUseAccountDataReturn {
	// GET /users/export — the caller's own data as a portable bundle (SAR).
	exportData: () => Promise<unknown>;
	/** @deprecated No proof, no notice — use requestDeletion + confirmDeletion. */
	deleteUser: () => Promise<void>;
	// Deleting with proof: a code to the chosen channel ('email' | 'sms')…
	requestDeletion: (input: IRequestAccountDeletionInput) => Promise<IRequestAccountDeletionResult>;
	// …then the code (+ mfaCode when requested) closes the account and ends
	// this session. It is permanently deleted on `deleteOn` unless kept by
	// signing in again before then.
	confirmDeletion: (input: IConfirmAccountDeletionInput) => Promise<IAccountDeletionResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useAccountData(client?: AuthClient): IUseAccountDataReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAccountData');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const run = useCallback(async <T>(op: () => Promise<T>): Promise<T> => {
		setIsLoading(true);
		setError(null);
		try {
			return await op();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, []);

	const exportData = useCallback(
		() =>
			run(async () => {
				const { result } = await auth.exportData();
				return result;
			}),
		[auth, run],
	);

	const deleteUser = useCallback(
		() =>
			run(async () => {
				await auth.deleteUser();
				auth.setAccessToken(undefined);
				clearToken();
			}),
		[auth, run],
	);

	const requestDeletion = useCallback(
		(input: IRequestAccountDeletionInput) =>
			run(async () => (await auth.requestAccountDeletion(input)).result),
		[auth, run],
	);

	const confirmDeletion = useCallback(
		(input: IConfirmAccountDeletionInput) =>
			run(async () => {
				const { result } = await auth.confirmAccountDeletion(input);
				auth.setAccessToken(undefined);
				clearToken();
				return result;
			}),
		[auth, run],
	);

	return { exportData, deleteUser, requestDeletion, confirmDeletion, isLoading, error };
}
