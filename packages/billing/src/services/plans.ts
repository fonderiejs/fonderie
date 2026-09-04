import type { IStoreAdapter } from '@fonderie/store';

import type { IPlan } from '../types';
import type { IBillingConfig, IBillingPlan } from '../config';
import { moneyToNumber } from '../utils';

// fonderie_plans money columns are BIGINT (int8) since 006_wallet.sql — pg
// returns those as strings. The read model keeps JS numbers (bounded display
// cents; the wire format stays numeric), guarded loudly at 2^53.
type IPlanRow = Omit<IPlan, 'monthlyAmount' | 'yearlyAmount'> & {
	monthlyAmount: string | number | null;
	yearlyAmount: string | number | null;
};

const planAmount = (v: string | number | null): number | null =>
	v == null ? null : moneyToNumber(BigInt(v));

function mapPlanRow(row: IPlanRow): IPlan {
	return {
		...row,
		monthlyAmount: planAmount(row.monthlyAmount),
		yearlyAmount: planAmount(row.yearlyAmount),
	};
}

export function getPlans(config: IBillingConfig): IBillingPlan[] {
	return config.plans;
}

export function getPlanByName(name: string, config: IBillingConfig): IBillingPlan | null {
	return config.plans.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Attribute a subscription to a Fonderie plan by its price, precedence
 * `lookup_key → priceId` (§16.3). Pure — pass the plans list. Returns null so the
 * caller can fall back to the legacy nickname-derived plan.
 */
export function resolvePlanNameByPrice(
	price: { lookupKey?: string | null; priceId?: string | null },
	plans: IBillingPlan[],
): string | null {
	const find = (pred: (p?: { lookupKey?: string; priceId?: string }) => boolean) =>
		plans.find((pl) => pred(pl.monthly) || pred(pl.yearly))?.name ?? null;
	if (price.lookupKey) {
		const m = find((p) => p?.lookupKey === price.lookupKey);
		if (m) return m;
	}
	if (price.priceId) {
		const m = find((p) => p?.priceId === price.priceId);
		if (m) return m;
	}
	return null;
}

// Plan wallet config carries bigints; the JSONB ops copy stores them as
// digit strings.
const walletToJson = (wallet: IBillingPlan['wallet']): string | null =>
	wallet == null
		? null
		: JSON.stringify(wallet, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

export async function syncPlansToDB(config: IBillingConfig, store: IStoreAdapter): Promise<void> {
	const plans = config.plans;
	if (plans.length === 0) return;

	const values = plans.map((_, i) => {
		const b = i * 10;
		return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}::jsonb, $${b + 10}::jsonb)`;
	});

	const params = plans.flatMap((plan) => [
		plan.name,
		plan.trialDays ?? 0,
		// bigint params go over the wire as strings; pg casts into the column type.
		plan.monthly?.amount?.toString() ?? null,
		plan.monthly?.priceId ?? null,
		plan.yearly?.amount?.toString() ?? null,
		plan.yearly?.priceId ?? null,
		plan.description ?? null,
		plan.tier ?? 0,
		JSON.stringify(plan.metadata ?? {}),
		walletToJson(plan.wallet),
	]);

	await store.query(
		`INSERT INTO fonderie_plans
			(name, trial_days,
			 monthly_amount, monthly_price_id,
			 yearly_amount,  yearly_price_id,
			 description, tier, metadata, wallet)
		VALUES ${values.join(', ')}
		ON CONFLICT (name) DO UPDATE SET
			trial_days       = EXCLUDED.trial_days,
			monthly_amount   = EXCLUDED.monthly_amount,
			monthly_price_id = EXCLUDED.monthly_price_id,
			yearly_amount    = EXCLUDED.yearly_amount,
			yearly_price_id  = EXCLUDED.yearly_price_id,
			description      = EXCLUDED.description,
			tier             = EXCLUDED.tier,
			metadata         = EXCLUDED.metadata,
			wallet           = EXCLUDED.wallet`,
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
	const rows = await store.query<IPlanRow>(
		`${SELECT_PLAN} WHERE active = true ORDER BY tier ASC, monthly_amount ASC NULLS LAST`,
	);
	return rows.map(mapPlanRow);
}

export async function getPlanById(id: string, store: IStoreAdapter): Promise<IPlan | null> {
	const [row] = await store.query<IPlanRow>(`${SELECT_PLAN} WHERE id = $1`, [id]);
	return row ? mapPlanRow(row) : null;
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
	const [row] = await store.query<IPlanRow>(
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
	return mapPlanRow(row);
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

	const [row] = await store.query<IPlanRow>(
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
	return row ? mapPlanRow(row) : null;
}

export async function deletePlan(id: string, store: IStoreAdapter): Promise<boolean> {
	const rows = await store.query<{ id: string }>(
		`DELETE FROM fonderie_plans WHERE id = $1 RETURNING id`,
		[id],
	);
	return rows.length > 0;
}
