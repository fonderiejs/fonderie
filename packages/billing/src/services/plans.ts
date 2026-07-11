import type { IStoreAdapter } from '@fonderie/store';

import type { IPlan } from '../types';
import type { IBillingConfig, IBillingPlan } from '../config';

export function getPlans(config: IBillingConfig): IBillingPlan[] {
	return config.plans;
}

export function getPlanByName(name: string, config: IBillingConfig): IBillingPlan | null {
	return config.plans.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function syncPlansToDB(config: IBillingConfig, store: IStoreAdapter): Promise<void> {
	const plans = config.plans;
	if (plans.length === 0) return;

	const values = plans.map((_, i) => {
		const b = i * 9;
		return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}::jsonb)`;
	});

	const params = plans.flatMap((plan) => [
		plan.name,
		plan.trialDays ?? 0,
		plan.monthly?.amount ?? null,
		plan.monthly?.priceId ?? null,
		plan.yearly?.amount ?? null,
		plan.yearly?.priceId ?? null,
		plan.description ?? null,
		plan.tier ?? 0,
		JSON.stringify(plan.metadata ?? {}),
	]);

	await store.query(
		`INSERT INTO fonderie_plans
			(name, trial_days,
			 monthly_amount, monthly_price_id,
			 yearly_amount,  yearly_price_id,
			 description, tier, metadata)
		VALUES ${values.join(', ')}
		ON CONFLICT (name) DO UPDATE SET
			trial_days       = EXCLUDED.trial_days,
			monthly_amount   = EXCLUDED.monthly_amount,
			monthly_price_id = EXCLUDED.monthly_price_id,
			yearly_amount    = EXCLUDED.yearly_amount,
			yearly_price_id  = EXCLUDED.yearly_price_id,
			description      = EXCLUDED.description,
			tier             = EXCLUDED.tier,
			metadata         = EXCLUDED.metadata`,
		params,
	);
}

const SELECT_PLAN = `
	SELECT
		id,
		name,
		seats,
		trial_days        AS "trialDays",
		monthly_amount    AS "monthlyAmount",
		monthly_price_id  AS "monthlyPriceId",
		yearly_amount     AS "yearlyAmount",
		yearly_price_id   AS "yearlyPriceId",
		description,
		tier,
		features,
		metadata
	FROM fonderie_plans`;

export async function getDBPlans(store: IStoreAdapter): Promise<IPlan[]> {
	return store.query<IPlan>(
		`${SELECT_PLAN} WHERE active = true ORDER BY tier ASC, monthly_amount ASC NULLS LAST`,
	);
}

export async function getPlanById(id: string, store: IStoreAdapter): Promise<IPlan | null> {
	const [row] = await store.query<IPlan>(`${SELECT_PLAN} WHERE id = $1`, [id]);
	return row ?? null;
}

export async function createPlan(
	data: {
		name: string;
		description?: string | null;
		tier?: number;
		seats?: number | null;
		trialDays?: number;
		features?: unknown;
		metadata?: unknown;
		monthlyAmount?: number | null;
		monthlyPriceId?: string | null;
		yearlyAmount?: number | null;
		yearlyPriceId?: string | null;
	},
	store: IStoreAdapter,
): Promise<IPlan> {
	const [row] = await store.query<IPlan>(
		`INSERT INTO fonderie_plans
			(name, seats, trial_days, monthly_amount, monthly_price_id,
			 yearly_amount, yearly_price_id, description, tier, features, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
		RETURNING
			id, name, seats,
			trial_days        AS "trialDays",
			monthly_amount    AS "monthlyAmount",
			monthly_price_id  AS "monthlyPriceId",
			yearly_amount     AS "yearlyAmount",
			yearly_price_id   AS "yearlyPriceId",
			description, tier, features, metadata`,
		[
			data.name,
			data.seats ?? null,
			data.trialDays ?? 0,
			data.monthlyAmount ?? null,
			data.monthlyPriceId ?? null,
			data.yearlyAmount ?? null,
			data.yearlyPriceId ?? null,
			data.description ?? null,
			data.tier ?? 0,
			JSON.stringify(data.features ?? []),
			JSON.stringify(data.metadata ?? {}),
		],
	);
	if (!row) throw new Error('Failed to create plan');
	return row;
}

export async function updatePlan(
	id: string,
	data: Partial<Omit<IPlan, 'id'>>,
	store: IStoreAdapter,
): Promise<IPlan | null> {
	const fieldMap: Record<string, string> = {
		name: 'name',
		seats: 'seats',
		trialDays: 'trial_days',
		monthlyAmount: 'monthly_amount',
		monthlyPriceId: 'monthly_price_id',
		yearlyAmount: 'yearly_amount',
		yearlyPriceId: 'yearly_price_id',
		description: 'description',
		tier: 'tier',
	};

	const jsonbFields = new Set(['features', 'metadata']);
	const setClauses: string[] = [];
	const params: unknown[] = [id];

	for (const [key, col] of Object.entries(fieldMap)) {
		if (key in data) {
			params.push((data as Record<string, unknown>)[key]);
			setClauses.push(`${col} = $${params.length}`);
		}
	}

	for (const key of jsonbFields) {
		if (key in data) {
			params.push(JSON.stringify((data as Record<string, unknown>)[key]));
			setClauses.push(`${key} = $${params.length}::jsonb`);
		}
	}

	if (setClauses.length === 0) return getPlanById(id, store);

	const [row] = await store.query<IPlan>(
		`UPDATE fonderie_plans SET ${setClauses.join(', ')}
		WHERE id = $1
		RETURNING
			id, name, seats,
			trial_days        AS "trialDays",
			monthly_amount    AS "monthlyAmount",
			monthly_price_id  AS "monthlyPriceId",
			yearly_amount     AS "yearlyAmount",
			yearly_price_id   AS "yearlyPriceId",
			description, tier, features, metadata`,
		params,
	);
	return row ?? null;
}

export async function deletePlan(id: string, store: IStoreAdapter): Promise<boolean> {
	const rows = await store.query<{ id: string }>(
		`DELETE FROM fonderie_plans WHERE id = $1 RETURNING id`,
		[id],
	);
	return rows.length > 0;
}
