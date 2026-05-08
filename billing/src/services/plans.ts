import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IPlan }                        from '../types';
import type { IBillingConfig, IBillingPlan } from '../config';

export function getPlans(config: IBillingConfig): IBillingPlan[] {
	return config.plans;
}

export function getPlanByName(name: string, config: IBillingConfig): IBillingPlan | null {
	return config.plans.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function syncPlansToDB(
	config: IBillingConfig,
	store:  IStoreAdapter,
): Promise<void> {
	const plans = config.plans;
	if (plans.length === 0) return;

	const values = plans.map((_, i) => {
		const b = i * 7;
		return `($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7})`;
	});

	const params = plans.flatMap(plan => [
		plan.name,
		plan.seats            ?? null,
		plan.trialDays        ?? 0,
		plan.monthly?.amount  ?? null,
		plan.monthly?.priceId ?? null,
		plan.yearly?.amount   ?? null,
		plan.yearly?.priceId  ?? null,
	]);

	await store.query(
		`INSERT INTO fonderie_plans
			(name, seats, trial_days,
			 monthly_amount, monthly_price_id,
			 yearly_amount,  yearly_price_id)
		VALUES ${values.join(', ')}
		ON CONFLICT (name) DO UPDATE SET
			seats            = EXCLUDED.seats,
			trial_days       = EXCLUDED.trial_days,
			monthly_amount   = EXCLUDED.monthly_amount,
			monthly_price_id = EXCLUDED.monthly_price_id,
			yearly_amount    = EXCLUDED.yearly_amount,
			yearly_price_id  = EXCLUDED.yearly_price_id`,
		params,
	);
}

export async function getDBPlans(store: IStoreAdapter): Promise<IPlan[]> {
	return store.query<IPlan>(
		`SELECT
			id,
			name,
			seats,
			trial_days        AS "trialDays",
			monthly_amount    AS "monthlyAmount",
			monthly_price_id  AS "monthlyPriceId",
			yearly_amount     AS "yearlyAmount",
			yearly_price_id   AS "yearlyPriceId"
		FROM fonderie_plans
		ORDER BY monthly_amount ASC NULLS LAST`,
	);
}
