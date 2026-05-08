import type { IStoreAdapter }  from '@fonderie-js/store';

import type { IUsageRecord }   from '../types';

export async function recordUsage(
	opts: { workspaceId: string; metric: string; quantity: number },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_usage_records (workspace_id, metric, quantity)
		VALUES ($1, $2, $3)`,
		[opts.workspaceId, opts.metric, opts.quantity],
	);
}

export async function getUsage(
	workspaceId: string,
	metric:      string,
	since:       Date,
	store:       IStoreAdapter,
): Promise<number> {
	const rows = await store.query<{ total: string }>(
		`SELECT COALESCE(SUM(quantity), 0) AS total
		FROM fonderie_usage_records
		WHERE workspace_id = $1
			AND metric       = $2
			AND recorded_at >= $3`,
		[workspaceId, metric, since],
	)
	return parseInt(rows[0]?.total ?? '0', 10)
}
