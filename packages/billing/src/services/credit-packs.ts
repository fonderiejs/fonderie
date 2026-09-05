import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig, IBillingCreditPack } from '../config';
import { normalizeCurrency } from '../utils';

// Credit packs mirror the plans pattern: config is the runtime source of
// truth (checkout reads it directly); the DB copy exists for ops visibility
// and reporting, upserted at boot.

export function findCreditPack(packId: string, config: IBillingConfig): IBillingCreditPack | null {
	const pack = config.wallet?.creditPacks?.find((p) => p.id === packId);
	if (!pack || pack.active === false) return null;
	return pack;
}

export async function syncCreditPacksToDB(
	config: IBillingConfig,
	store: IStoreAdapter,
): Promise<void> {
	const packs = config.wallet?.creditPacks ?? [];
	if (packs.length === 0) return;

	const defaultCurrency = normalizeCurrency(config.wallet?.currency ?? 'USD');
	const values = packs.map((_, i) => {
		const b = i * 8;
		return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::jsonb)`;
	});

	const params = packs.flatMap((pack) => [
		pack.id,
		pack.name,
		normalizeCurrency(pack.currency ?? defaultCurrency),
		pack.credits.toString(),
		pack.priceAmount.toString(),
		pack.priceId ?? null,
		pack.active !== false,
		JSON.stringify(pack.metadata ?? {}),
	]);

	await store.query(
		`INSERT INTO fonderie_credit_packs
			(id, name, currency, credits, price_amount, price_id, active, metadata)
		VALUES ${values.join(', ')}
		ON CONFLICT (id) DO UPDATE SET
			name         = EXCLUDED.name,
			currency     = EXCLUDED.currency,
			credits      = EXCLUDED.credits,
			price_amount = EXCLUDED.price_amount,
			price_id     = EXCLUDED.price_id,
			active       = EXCLUDED.active,
			metadata     = EXCLUDED.metadata`,
		params,
	);
}
