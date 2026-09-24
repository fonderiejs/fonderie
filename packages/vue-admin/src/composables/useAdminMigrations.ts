import type {
	AdminClient,
	IAdminMigrationModule,
	IAdminMigrationsReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useAdminMigrations(client: AdminClient) {
	const report = ref<IAdminMigrationsReport | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.migrations();
			report.value = result;
		} catch (err) {
			error.value = toError(err);
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return {
		report,
		isLoading,
		error,
		refresh,
		/**
		 * Apply one module's pending migrations — all of them, or none. Pass the
		 * pending list you rendered; if it no longer matches, the server refuses
		 * rather than applying a set nobody reviewed.
		 *
		 * Re-reads on failure as well as success: an apply that dies partway
		 * still committed every file it finished (each is its own transaction),
		 * so the only honest state is what the database reports afterwards.
		 * refresh() clears `error` first, so it must run BEFORE the error is set.
		 */
		apply: async (module: string, expect: readonly string[]): Promise<IAdminMigrationModule> => {
			error.value = null;
			try {
				const { result } = await client.applyMigrations(module, expect);
				await refresh();
				return result;
			} catch (err) {
				const e = toError(err);
				await refresh().catch(() => {});
				error.value = e;
				throw e;
			}
		},
	};
}
