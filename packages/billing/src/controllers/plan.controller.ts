import { setApiResponse, HTTP, stringOrEmpty, numberOrZero } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { IPlan } from '../types';
import type { IPlanDTO } from '../dtos/billing';
import { PlanModel } from '../models/plan.model';
import { applyConfigPolicy, toPlanDTO } from '../dtos/billing';
import { PriceCache } from '../services/price-cache';
import { toSafeNumber } from '../utils';

// Read-through hydration: override the DTO's amount/currency with live Stripe
// prices (source of truth). Best-effort per plan — on error (incl. currency
// mismatch, §16.4) keep the fallback amount/currency and flag pricingStale.
async function hydratePricing(
	dto: IPlanDTO,
	plan: IPlan,
	config: IBillingConfig,
	cache: PriceCache,
): Promise<void> {
	try {
		let stale = false;
		const resolve = async (priceId: string | null) => {
			if (!priceId) return null;
			const r = await cache.byPriceId(priceId, config.provider);
			if (r.stale) stale = true;
			return r.price;
		};
		const [m, y] = await Promise.all([resolve(plan.monthlyPriceId), resolve(plan.yearlyPriceId)]);
		if (m && y && m.currency !== y.currency) {
			throw new Error(
				`[billing] plan "${plan.name}": monthly/yearly currency mismatch (${m.currency} vs ${y.currency})`,
			);
		}
		if (m) dto.pricing.monthly = toSafeNumber(m.unitAmount);
		if (y) dto.pricing.yearly = toSafeNumber(y.unitAmount);
		const currency = m?.currency ?? y?.currency;
		if (currency) dto.pricing.currency = currency.toUpperCase();
		if (stale) dto.pricingStale = true;
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(`[billing] pricing hydration failed for "${plan.name}":`, (err as Error).message);
		dto.pricingStale = true;
	}
}

export function planController(store: IStoreAdapter, config: IBillingConfig, cache: PriceCache) {
	const plans = new PlanModel(store);
	const hydrate = config.pricing?.hydration === true;
	const configPlan = (name: string) => config.plans.find((p) => p.name === name);

	return {
		async list(_ctx: IFonderieContext): Promise<Response> {
			const list = await plans.list();
			const dtos = list.map((p) => applyConfigPolicy(toPlanDTO(p), configPlan(p.name)));
			if (hydrate) {
				await Promise.all(dtos.map((dto, i) => hydratePricing(dto, list[i]!, config, cache)));
				// An unpriced plan (free) has nothing to hydrate, so it kept the DTO's
				// 'USD' default beside paid plans hydrated to the provider's currency
				// (e.g. "USD 0" next to "CAD 9"). When every priced plan agrees on one
				// currency, the free plan shows it too.
				const priced = list
					.map((p, i) => (p.monthlyPriceId || p.yearlyPriceId ? dtos[i]! : null))
					.filter((d): d is IPlanDTO => d !== null && !d.pricingStale);
				const currencies = new Set(priced.map((d) => d.pricing.currency));
				if (currencies.size === 1) {
					const [currency] = currencies;
					list.forEach((p, i) => {
						if (!p.monthlyPriceId && !p.yearlyPriceId) dtos[i]!.pricing.currency = currency!;
					});
				}
			}
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

			const dto = applyConfigPolicy(toPlanDTO(plan), configPlan(plan.name));
			if (hydrate) await hydratePricing(dto, plan, config, cache);

			return setApiResponse(HTTP.OK, 'PLAN_FETCHED', 'Plan retrieved successfully.', {
				plan: dto,
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
				description: body?.['description'] != null ? String(body['description']) : null,
				tier: body?.['tier'] != null ? numberOrZero(body['tier']) : 0,
				seats: body?.['seats'] != null ? numberOrZero(body['seats']) : null,
				trialDays: body?.['trialDays'] != null ? numberOrZero(body['trialDays']) : 0,
				monthlyAmount: body?.['monthlyAmount'] != null ? numberOrZero(body['monthlyAmount']) : null,
				monthlyPriceId: body?.['monthlyPriceId'] != null ? String(body['monthlyPriceId']) : null,
				yearlyAmount: body?.['yearlyAmount'] != null ? numberOrZero(body['yearlyAmount']) : null,
				yearlyPriceId: body?.['yearlyPriceId'] != null ? String(body['yearlyPriceId']) : null,
				features: body?.['features'],
				metadata: body?.['metadata'],
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
			const allowed = [
				'name',
				'description',
				'tier',
				'seats',
				'trialDays',
				'monthlyAmount',
				'monthlyPriceId',
				'yearlyAmount',
				'yearlyPriceId',
				'features',
				'metadata',
			];

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
