import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IBillingConfig } from '../config';
import { PlanModel }           from '../models/plan.model';
import { toPlanDTO }           from '../dtos/billing';

export function planController(store: IStoreAdapter, _config: IBillingConfig) {
	const plans = new PlanModel(store)

	return {
		async list(_ctx: IFonderieContext): Promise<Response> {
			const list = await plans.list()
			return setApiResponse(200, 'PLANS_FETCHED', 'Plans retrieved successfully.', {
				plans: list.map(toPlanDTO),
			})
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setErrorResponse(400, 'INVALID_PARAMETER', 'Plan ID required')

			const plan = await plans.findById(id)
			if (!plan) return setErrorResponse(404, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(200, 'PLAN_FETCHED', 'Plan retrieved successfully.', { plan: toPlanDTO(plan) })
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const name = body?.['name']

			if (typeof name !== 'string' || !name.trim()) {
				return setErrorResponse(422, 'INVALID_PARAMETER', 'name is required')
			}

			const data: Parameters<typeof plans.create>[0] = { name: name.trim() }

			if ('seats'          in (body ?? {})) data.seats          = typeof body?.['seats']          === 'number' ? body['seats']          as number : null
			if ('trialDays'      in (body ?? {})) data.trialDays      = typeof body?.['trialDays']      === 'number' ? body['trialDays']      as number : 0
			if ('monthlyAmount'  in (body ?? {})) data.monthlyAmount  = typeof body?.['monthlyAmount']  === 'number' ? body['monthlyAmount']  as number : null
			if ('monthlyPriceId' in (body ?? {})) data.monthlyPriceId = typeof body?.['monthlyPriceId'] === 'string' ? body['monthlyPriceId'] as string : null
			if ('yearlyAmount'   in (body ?? {})) data.yearlyAmount   = typeof body?.['yearlyAmount']   === 'number' ? body['yearlyAmount']   as number : null
			if ('yearlyPriceId'  in (body ?? {})) data.yearlyPriceId  = typeof body?.['yearlyPriceId']  === 'string' ? body['yearlyPriceId']  as string : null

			const plan = await plans.create(data)
			return setApiResponse(201, 'PLAN_CREATED', 'Plan created successfully.', { plan: toPlanDTO(plan) })
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setErrorResponse(400, 'INVALID_PARAMETER', 'Plan ID required')

			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const b    = body ?? {}
			const data: Parameters<typeof plans.update>[1] = {}

			if ('name'           in b && typeof b['name']           === 'string') data.name           = b['name'] as string
			if ('trialDays'      in b && typeof b['trialDays']      === 'number') data.trialDays      = b['trialDays'] as number
			if ('seats'          in b) data.seats          = typeof b['seats']          === 'number' ? b['seats']          as number : null
			if ('monthlyAmount'  in b) data.monthlyAmount  = typeof b['monthlyAmount']  === 'number' ? b['monthlyAmount']  as number : null
			if ('monthlyPriceId' in b) data.monthlyPriceId = typeof b['monthlyPriceId'] === 'string' ? b['monthlyPriceId'] as string : null
			if ('yearlyAmount'   in b) data.yearlyAmount   = typeof b['yearlyAmount']   === 'number' ? b['yearlyAmount']   as number : null
			if ('yearlyPriceId'  in b) data.yearlyPriceId  = typeof b['yearlyPriceId']  === 'string' ? b['yearlyPriceId']  as string : null

			const plan = await plans.update(id, data)
			if (!plan) return setErrorResponse(404, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(200, 'PLAN_UPDATED', 'Plan updated successfully.', { plan: toPlanDTO(plan) })
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setErrorResponse(400, 'INVALID_PARAMETER', 'Plan ID required')

			const deleted = await plans.delete(id)
			if (!deleted) return setErrorResponse(404, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(200, 'PLAN_DELETED', 'Plan deleted successfully.')
		},
	}
}
