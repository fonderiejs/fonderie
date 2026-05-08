import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';
import { getDBPlans }            from '../services/plans';

export function listPlansHandler(store: IStoreAdapter, _config: IBillingConfig) {
	return async (_ctx: IFonderieContext): Promise<Response> => {
		const plans = await getDBPlans(store);
		return Response.json({ plans });
	}
}
