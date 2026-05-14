import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { PlanModel } from '../models/plan.model';
import { toPlanDTO } from '../dtos/billing';

export function planController(store: IStoreAdapter) {
	const plans = new PlanModel(store);

	return {
		async list(_ctx: IFonderieContext): Promise<Response> {
			const list = await plans.list();
			const dtos = list.map(toPlanDTO);
			return setApiResponse(HTTP.OK, 'PLAN_LIST', `Retrieved ${list.length} workspace plans`, {
				plans: dtos,
			});
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['planId'];
			if (!id) return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required');

			const plan = await plans.findById(id);
			if (!plan) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found');

			return setApiResponse(HTTP.OK, 'PLAN_FETCHED', 'Plan retrieved successfully.', {
				plan: toPlanDTO(plan),
			});
		},
	};
}
