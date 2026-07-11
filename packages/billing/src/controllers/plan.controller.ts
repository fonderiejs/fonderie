import { setApiResponse, HTTP, stringOrEmpty, numberOrZero } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

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

		async create(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const name = stringOrEmpty(body?.['name']);
			if (!name) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'VALIDATION_ERROR', 'name is required');
			}

			const plan = await plans.create({
				name,
				description:      body?.['description']      != null ? String(body['description'])      : null,
				tier:             body?.['tier']              != null ? numberOrZero(body['tier'])        : 0,
				seats:            body?.['seats']             != null ? numberOrZero(body['seats'])       : null,
				trialDays:        body?.['trialDays']         != null ? numberOrZero(body['trialDays'])   : 0,
				monthlyAmount:    body?.['monthlyAmount']     != null ? numberOrZero(body['monthlyAmount']) : null,
				monthlyPriceId:   body?.['monthlyPriceId']   != null ? String(body['monthlyPriceId'])   : null,
				yearlyAmount:     body?.['yearlyAmount']      != null ? numberOrZero(body['yearlyAmount'])  : null,
				yearlyPriceId:    body?.['yearlyPriceId']    != null ? String(body['yearlyPriceId'])    : null,
				features:         body?.['features'],
				metadata:         body?.['metadata'],
			});

			return setApiResponse(HTTP.CREATED, 'PLAN_CREATED', 'Plan created successfully.', {
				plan: toPlanDTO(plan),
			});
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['planId'];
			if (!id) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required');
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			if (!body || Object.keys(body).length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'VALIDATION_ERROR', 'Request body is empty');
			}

			const patch: Record<string, unknown> = {};
			const allowed = ['name', 'description', 'tier', 'seats', 'trialDays',
				'monthlyAmount', 'monthlyPriceId', 'yearlyAmount', 'yearlyPriceId',
				'features', 'metadata'];

			for (const key of allowed) {
				if (key in body) patch[key] = body[key];
			}

			const plan = await plans.update(id, patch);
			if (!plan) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found');
			}

			return setApiResponse(HTTP.OK, 'PLAN_UPDATED', 'Plan updated successfully.', {
				plan: toPlanDTO(plan),
			});
		},

		async delete(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['planId'];
			if (!id) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required');
			}

			const deleted = await plans.delete(id);
			if (!deleted) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found');
			}

			return setApiResponse(HTTP.OK, 'PLAN_DELETED', 'Plan deleted successfully.');
		},
	};
}
