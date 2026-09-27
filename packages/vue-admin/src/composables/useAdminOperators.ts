import type {
	AdminClient,
	AdminScope,
	IAdminCreatedLink,
	IAdminOperator,
	IAdminOperatorsReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useAdminOperators(client: AdminClient) {
	const report = ref<IAdminOperatorsReport | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.operators();
			report.value = result;
		} catch (err) {
			error.value = toError(err);
		} finally {
			isLoading.value = false;
		}
	}

	async function write<T>(fn: () => Promise<{ result: T }>): Promise<T> {
		error.value = null;
		try {
			const { result } = await fn();
			await refresh();
			return result;
		} catch (err) {
			const e = toError(err);
			error.value = e;
			throw e;
		}
	}

	void refresh();

	return {
		report,
		isLoading,
		error,
		refresh,
		/** Highest scope + a fresh code (403 STEP_UP_REQUIRED otherwise). The link is in the result once. */
		invite: (input: {
			email: string;
			scopes: AdminScope[];
			expiresInHours?: number;
		}): Promise<IAdminCreatedLink> => write(() => client.inviteOperator(input)),
		recover: (id: string): Promise<IAdminCreatedLink> => write(() => client.recoverOperator(id)),
		update: (
			id: string,
			input: { scopes?: AdminScope[]; name?: string; disabled?: boolean },
		): Promise<IAdminOperator> => write(() => client.updateOperator(id, input)),
		revokeLink: async (id: string): Promise<void> => {
			await write(() => client.revokeOperatorLink(id));
		},
	};
}
