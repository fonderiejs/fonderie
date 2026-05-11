import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IBillingConfig } from '../config';
import type { IPlan }          from '../types';
import { PlanModel }           from '../models/plan.model';
import { toPlanDTO }           from '../dtos/billing';

export function planController(store: IStoreAdapter, _config: IBillingConfig) {
	const plans = new PlanModel(store)

	return {
		async list(_ctx: IFonderieContext): Promise<Response> {
			const list = await plans.list()
			const dtos = list.map(toPlanDTO)
			return setApiResponse(HTTP.OK, 'PLAN_LIST', `Retrieved ${list.length} workspace plans`, {
				plans: dtos,
				count: dtos.length,
				tiers: [...dtos]
					.sort((a, b) => a.tier - b.tier)
					.map(p => ({ id: p.id, tier: p.tier, name: p.name })),
			})
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required')

			const plan = await plans.findById(id)
			if (!plan) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(HTTP.OK, 'PLAN_FETCHED', 'Plan retrieved successfully.', { plan: toPlanDTO(plan) })
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const name = body?.['name']

			if (typeof name !== 'string' || !name.trim()) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'name is required')
			}

			const b    = body ?? {}
			const data: Parameters<typeof plans.create>[0] = { name: name.trim() }

			if ('description'    in b) data.description    = typeof b['description']    === 'string' ? b['description']    as string  : null
			if ('tier'           in b) data.tier           = typeof b['tier']           === 'number' ? b['tier']           as number  : 0
			if ('seats'          in b) data.seats          = typeof b['seats']          === 'number' ? b['seats']          as number  : null
			if ('trialDays'      in b) data.trialDays      = typeof b['trialDays']      === 'number' ? b['trialDays']      as number  : 0
			if ('monthlyAmount'  in b) data.monthlyAmount  = typeof b['monthlyAmount']  === 'number' ? b['monthlyAmount']  as number  : null
			if ('monthlyPriceId' in b) data.monthlyPriceId = typeof b['monthlyPriceId'] === 'string' ? b['monthlyPriceId'] as string  : null
			if ('yearlyAmount'   in b) data.yearlyAmount   = typeof b['yearlyAmount']   === 'number' ? b['yearlyAmount']   as number  : null
			if ('yearlyPriceId'  in b) data.yearlyPriceId  = typeof b['yearlyPriceId']  === 'string' ? b['yearlyPriceId']  as string  : null
			if ('features'       in b && Array.isArray(b['features']))        data.features = b['features']
			if ('limits'         in b && b['limits']   && typeof b['limits']   === 'object') data.limits   = b['limits']
			if ('metadata'       in b && b['metadata'] && typeof b['metadata'] === 'object') data.metadata = b['metadata']

			const plan = await plans.create(data)
			return setApiResponse(HTTP.CREATED, 'PLAN_CREATED', 'Plan created successfully.', { plan: toPlanDTO(plan) })
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required')

			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const b    = body ?? {}
			const data: Parameters<typeof plans.update>[1] = {}

			if ('name'           in b && typeof b['name']           === 'string') data.name           = b['name'] as string
			if ('description'    in b)                                             data.description    = typeof b['description'] === 'string' ? b['description'] as string : null
			if ('tier'           in b && typeof b['tier']           === 'number') data.tier           = b['tier'] as number
			if ('trialDays'      in b && typeof b['trialDays']      === 'number') data.trialDays      = b['trialDays'] as number
			if ('seats'          in b) data.seats          = typeof b['seats']          === 'number' ? b['seats']          as number : null
			if ('monthlyAmount'  in b) data.monthlyAmount  = typeof b['monthlyAmount']  === 'number' ? b['monthlyAmount']  as number : null
			if ('monthlyPriceId' in b) data.monthlyPriceId = typeof b['monthlyPriceId'] === 'string' ? b['monthlyPriceId'] as string : null
			if ('yearlyAmount'   in b) data.yearlyAmount   = typeof b['yearlyAmount']   === 'number' ? b['yearlyAmount']   as number : null
			if ('yearlyPriceId'  in b) data.yearlyPriceId  = typeof b['yearlyPriceId']  === 'string' ? b['yearlyPriceId']  as string : null
			if ('features'       in b && Array.isArray(b['features']))        data.features = b['features'] as IPlan['features']
			if ('limits'         in b && b['limits']   && typeof b['limits']   === 'object') data.limits   = b['limits'] as IPlan['limits']
			if ('metadata'       in b && b['metadata'] && typeof b['metadata'] === 'object') data.metadata = b['metadata'] as IPlan['metadata']

			const plan = await plans.update(id, data)
			if (!plan) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(HTTP.OK, 'PLAN_UPDATED', 'Plan updated successfully.', { plan: toPlanDTO(plan) })
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined
			const id     = params?.['planId']
			if (!id) return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Plan ID required')

			const deleted = await plans.delete(id)
			if (!deleted) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Plan not found')

			return setApiResponse(HTTP.OK, 'PLAN_DELETED', 'Plan deleted successfully.')
		},
	}
}
