import type { AuthClient, IMfaEnabledResult, IMfaSetupResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { persistToken } from '../storage';

export interface IUseMfaSetupReturn {
	// Step 1: request enrollment — returns a data-URI QR code to scan and the
	// one-time backup codes generated at setup.
	setup: () => Promise<IMfaSetupResult>;
	setupData: Ref<IMfaSetupResult | null>;
	// Step 2: verify the first TOTP code. The server rotates the session's
	// tokens on success — the composable persists them exactly like a login,
	// so the session stays valid after enrollment.
	verify: (code: string) => Promise<IMfaEnabledResult>;
	disable: (code: string) => Promise<void>;
	regenerateBackupCodes: (code: string) => Promise<string[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useMfaSetup(client?: AuthClient): IUseMfaSetupReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useMfaSetup');
	const setupData = ref<IMfaSetupResult | null>(null);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function run<T>(op: () => Promise<T>): Promise<T> {
		isLoading.value = true;
		error.value = null;
		try {
			return await op();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	function setup() {
		return run(async () => {
			const { result } = await auth.mfa.setup();
			setupData.value = result;
			return result;
		});
	}

	function verify(code: string) {
		return run(async () => {
			const { result } = await auth.mfa.verify(code);
			auth.setAccessToken(result.tokens.access);
			persistToken(result.tokens.access);
			return result;
		});
	}

	function disable(code: string) {
		return run(async () => {
			await auth.mfa.disable(code);
		});
	}

	function regenerateBackupCodes(code: string) {
		return run(async () => {
			const { result } = await auth.mfa.regenerateBackupCodes(code);
			return result.backupCodes;
		});
	}

	return { setup, setupData, verify, disable, regenerateBackupCodes, isLoading, error };
}
