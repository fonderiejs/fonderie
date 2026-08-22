import type { AuthClient, IMfaEnabledResult, IMfaSetupResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseMfaSetupReturn {
	// Step 1: request enrollment — returns a data-URI QR code to scan and the
	// one-time backup codes generated at setup.
	setup: () => Promise<IMfaSetupResult>;
	setupData: IMfaSetupResult | null;
	// Step 2: verify the first TOTP code. The server rotates the session's
	// tokens on success — the hook persists them exactly like a login, so the
	// session stays valid after enrollment.
	verify: (code: string) => Promise<IMfaEnabledResult>;
	disable: (code: string) => Promise<void>;
	regenerateBackupCodes: (code: string) => Promise<string[]>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useMfaSetup(client?: AuthClient): IUseMfaSetupReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useMfaSetup');
	const [setupData, setSetupData] = useState<IMfaSetupResult | null>(null);
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

	const setup = useCallback(
		() =>
			run(async () => {
				const { result } = await auth.mfa.setup();
				setSetupData(result);
				return result;
			}),
		[auth, run],
	);

	const verify = useCallback(
		(code: string) =>
			run(async () => {
				const { result } = await auth.mfa.verify(code);
				auth.setAccessToken(result.tokens.access);
				persistToken(result.tokens.access);
				return result;
			}),
		[auth, run],
	);

	const disable = useCallback(
		(code: string) =>
			run(async () => {
				await auth.mfa.disable(code);
			}),
		[auth, run],
	);

	const regenerateBackupCodes = useCallback(
		(code: string) =>
			run(async () => {
				const { result } = await auth.mfa.regenerateBackupCodes(code);
				return result.backupCodes;
			}),
		[auth, run],
	);

	return { setup, setupData, verify, disable, regenerateBackupCodes, isLoading, error };
}
