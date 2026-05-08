import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }                from '../config';
import { getDBPlans, getPlanById, createPlan,
         updatePlan, deletePlan }             from '../services/plans';
import { toPlanDTO }                          from '../dtos/billing';

export function listPlansHandler(store: IStoreAdapter, _config: IBillingConfig) {
	return async (_ctx: IFonderieContext): Promise<Response> => {
		const plans = await getDBPlans(store);
		return Response.json({ plans: plans.map(toPlanDTO) });
	}
}

export function getPlanHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const params = ctx.meta['params'] as Record<string, string> | undefined
		const id     = params?.['planId']
		if (!id) return Response.json({ error: 'Plan ID required' }, { status: 400 })

		const plan = await getPlanById(id, store)
		if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

		return Response.json({ plan: toPlanDTO(plan) })
	}
}

export function createPlanHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined

		const name = body?.['name']
		if (typeof name !== 'string' || !name.trim()) {
			return Response.json({ error: 'name is required' }, { status: 422 })
		}

		const data: Parameters<typeof createPlan>[0] = { name: name.trim() }

		if ('seats'          in (body ?? {})) data.seats          = typeof body?.['seats']          === 'number' ? body['seats']          as number  : null
		if ('trialDays'      in (body ?? {})) data.trialDays      = typeof body?.['trialDays']      === 'number' ? body['trialDays']      as number  : 0
		if ('monthlyAmount'  in (body ?? {})) data.monthlyAmount  = typeof body?.['monthlyAmount']  === 'number' ? body['monthlyAmount']  as number  : null
		if ('monthlyPriceId' in (body ?? {})) data.monthlyPriceId = typeof body?.['monthlyPriceId'] === 'string' ? body['monthlyPriceId'] as string  : null
		if ('yearlyAmount'   in (body ?? {})) data.yearlyAmount   = typeof body?.['yearlyAmount']   === 'number' ? body['yearlyAmount']   as number  : null
		if ('yearlyPriceId'  in (body ?? {})) data.yearlyPriceId  = typeof body?.['yearlyPriceId']  === 'string' ? body['yearlyPriceId']  as string  : null

		const plan = await createPlan(data, store)
		return Response.json({ plan: toPlanDTO(plan) }, { status: 201 })
	}
}

export function updatePlanHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const params = ctx.meta['params'] as Record<string, string> | undefined
		const id     = params?.['planId']
		if (!id) return Response.json({ error: 'Plan ID required' }, { status: 400 })

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const data: Partial<Omit<import('../types').IPlan, 'id'>> = {}

		const b = body ?? {}
		if ('name'           in b && typeof b['name']           === 'string') data.name           = b['name'] as string
		if ('trialDays'      in b && typeof b['trialDays']      === 'number') data.trialDays      = b['trialDays'] as number
		if ('seats'          in b) data.seats          = typeof b['seats']          === 'number' ? b['seats']          as number  : null
		if ('monthlyAmount'  in b) data.monthlyAmount  = typeof b['monthlyAmount']  === 'number' ? b['monthlyAmount']  as number  : null
		if ('monthlyPriceId' in b) data.monthlyPriceId = typeof b['monthlyPriceId'] === 'string' ? b['monthlyPriceId'] as string  : null
		if ('yearlyAmount'   in b) data.yearlyAmount   = typeof b['yearlyAmount']   === 'number' ? b['yearlyAmount']   as number  : null
		if ('yearlyPriceId'  in b) data.yearlyPriceId  = typeof b['yearlyPriceId']  === 'string' ? b['yearlyPriceId']  as string  : null

		const plan = await updatePlan(id, data, store)
		if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

		return Response.json({ plan: toPlanDTO(plan) })
	}
}

export function deletePlanHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const params = ctx.meta['params'] as Record<string, string> | undefined
		const id     = params?.['planId']
		if (!id) return Response.json({ error: 'Plan ID required' }, { status: 400 })

		const deleted = await deletePlan(id, store)
		if (!deleted) return Response.json({ error: 'Plan not found' }, { status: 404 })

		return Response.json({ ok: true })
	}
}
