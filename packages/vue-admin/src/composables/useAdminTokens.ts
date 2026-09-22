import type {
	AdminClient,
	IAdminIssuedToken,
	IAdminIssueTokenInput,
	IAdminTokensReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useAdminTokens(client: AdminClient) {
	const report = ref<IAdminTokensReport | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.tokens();
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
		// Root token only; the plaintext is in the result once.
		issue: (input: IAdminIssueTokenInput): Promise<IAdminIssuedToken> =>
			write(() => client.issueToken(input)),
		// Root token only.
		revoke: async (id: string): Promise<void> => {
			await write(() => client.revokeToken(id));
		},
	};
}
