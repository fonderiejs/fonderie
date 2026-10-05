import type { IFonderieContext } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { listCustomerBin, purgeCustomerFromBin, restoreCustomer } from '../models/customer-bin';
import { isUuid } from '../utils';

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): deleted customers,
// restorable for 30 days; only the workspace owner empties one early.
export function customerBinController(store: IStoreAdapter) {
	const idOf = (ctx: IFonderieContext) => (ctx.meta['params'] as Record<string, string> | undefined)?.['customerId'];
	const noWorkspace = () => setApiResponse(HTTP.BAD_REQUEST, 'MISSING_WORKSPACE', 'Workspace context is required');
	const badId = () => setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const rows = await listCustomerBin(store, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'CUSTOMER_BIN', 'Deleted customers.', {
				customers: rows.map((r) => ({
					...r,
					deletedAt: new Date(r.deletedAt).toISOString(),
					purgeAt: new Date(r.purgeAt).toISOString(),
				})),
			});
		},

		async restore(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = idOf(ctx);
			if (!isUuid(id)) return badId();
			switch (await restoreCustomer(store, id, ctx.workspace.id)) {
				case 'restored':
					return setApiResponse(HTTP.OK, 'CUSTOMER_RESTORED', 'Customer restored.', { id });
				case 'not-in-bin':
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Nothing to restore: not deleted here, or deleted too long ago.');
				case 'conflict':
					return setApiResponse(
						HTTP.CONFLICT,
						'RESTORE_CONFLICT',
						'Another customer now has this reference code. Change theirs, then restore.',
					);
			}
		},

		// The owner only: a manager who could empty the bin could delete and
		// then erase the undo.
		async purge(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			if ((ctx.workspace as { ownerId?: string }).ownerId !== ctx.user?.id)
				return setApiResponse(HTTP.FORBIDDEN, 'OWNER_REQUIRED', 'Only the workspace owner can empty the bin.');
			const id = idOf(ctx);
			if (!isUuid(id)) return badId();
			if (!(await purgeCustomerFromBin(store, id, ctx.workspace.id)))
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Not in the bin.');
			return new Response(null, { status: HTTP.NO_CONTENT });
		},
	};
}
