import type { FonderieApiError, IDeletedWebhookEndpointDTO, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseDeletedWebhookEndpointsReturn {
	endpoints: IDeletedWebhookEndpointDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Back where it was, with the same id.
	restore: (id: string) => Promise<void>;
	// Gone for good — the workspace owner only (403 OWNER_REQUIRED otherwise).
	purge: (id: string) => Promise<void>;
}

const NONE: IDeletedWebhookEndpointDTO[] = [];

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): what was deleted in
// the selected workspace, restorable until each item's `purgeAt`.
export function useDeletedWebhookEndpoints(client?: WebhooksClient): IUseDeletedWebhookEndpointsReturn {
	const api = useFonderieSubClient(client, (c) => c.webhooks, 'useDeletedWebhookEndpoints');
	const q = useScopedQuery(api, '/webhooks/bin', async (bust) => (await api.listDeletedWebhookEndpoints({ bust })).result.endpoints);
	const w = useWrite(q.refresh);
	const restore = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.restoreWebhookEndpoint(id);
			}),
		[api, w.run],
	);
	const purge = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.purgeDeletedWebhookEndpoint(id);
			}),
		[api, w.run],
	);
	return { endpoints: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, restore, purge };
}
