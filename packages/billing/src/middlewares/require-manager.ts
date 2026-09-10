import type { Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { isWorkspaceManager } from '../services/membership';
import { resolveSubscriber } from '../utils';

// RBAC gate for MONEY-MUTATING billing routes (checkout, cancel, card
// management, wallet purchases). withBilling verifies *membership*, but a
// plain member must not be able to spend the workspace's card or cancel its
// subscription — that is a manager action: the workspace OWNER or a holder of
// an active SYSTEM role (the seeded ADMIN).
//
// - User-scoped billing (no workspace subscriber) passes: the caller manages
//   their own money.
// - config.management: 'any-member' restores the legacy behaviour for apps
//   that deliberately let every member manage billing.
export function requireBillingManager(store: IStoreAdapter, config: IBillingConfig): Middleware {
	return async (ctx, next) => {
		if (config.management === 'any-member') return next();

		const subscriber = resolveSubscriber(ctx);
		if (!subscriber || subscriber.type !== 'workspace') return next();

		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}

		if (!(await isWorkspaceManager(ctx.user.id, subscriber.id, store, config.managerRoles ?? ['ADMIN']))) {
			return setApiResponse(
				HTTP.FORBIDDEN,
				'MANAGER_REQUIRED',
				'Managing billing requires the workspace owner or an admin role',
			);
		}

		return next();
	};
}
