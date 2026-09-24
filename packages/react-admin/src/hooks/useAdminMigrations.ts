import type {
	AdminClient,
	IAdminMigrationModule,
	IAdminMigrationsReport,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminMigrationsReturn {
	report: IAdminMigrationsReport | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	/**
	 * Apply one module's pending migrations — all of them, or none.
	 *
	 * Pass the pending list you rendered. If it no longer matches, the server
	 * refuses rather than applying a set nobody reviewed.
	 *
	 * `write` refreshes on success, but this one refreshes on FAILURE too: an
	 * apply that dies partway still committed every file it finished (each is
	 * its own transaction), so the only honest state is the one the database
	 * reports afterwards — never what the request appeared to do.
	 */
	apply: (module: string, expect: readonly string[]) => Promise<IAdminMigrationModule>;
}

export function useAdminMigrations(client: AdminClient): IUseAdminMigrationsReturn {
	const [report, set] = useState<IAdminMigrationsReport | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.migrations();
			set(result);
		} catch (err) {
			setError(toError(err));
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const apply = useCallback(
		async (module: string, expect: readonly string[]): Promise<IAdminMigrationModule> => {
			setError(null);
			try {
				const { result } = await client.applyMigrations(module, expect);
				await refresh();
				return result;
			} catch (err) {
				const e = toError(err);
				// Re-read BEFORE setting the error, not after: refresh() clears
				// `error` as its first act, so the other order silently wipes the
				// message the operator needs. A refusal changed nothing, but a
				// timeout or mid-apply failure may have committed some files, and
				// leaving the stale list on screen would misreport it.
				await refresh().catch(() => {});
				setError(e);
				throw e;
			}
		},
		[client, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { report, isLoading, error, refresh, apply };
}
