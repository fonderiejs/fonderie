import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomerAddress } from '../types';

const SELECT_CUSTOMER_ADDRESS = `
	ca.addr_id     AS "addrId",
	ca.customer_id AS "customerId",
	ca.label,
	ca.is_primary  AS "isPrimary",
	jsonb_build_object(
		'id',              a.id,
		'countryIso',      a.country_iso,
		'subdivision1Iso', a.subdivision1_iso,
		'subdivision2Iso', a.subdivision2_iso,
		'zipPostalCode',   a.zip_postal_code,
		'line1',           a.line1,
		'line2',           a.line2
	) AS address
`;

export class CustomerAddressModel {
	constructor(private readonly store: IStoreAdapter) {}

	list(customerId: string): Promise<ICustomerAddress[]> {
		return this.store.query<ICustomerAddress>(
			`SELECT ${SELECT_CUSTOMER_ADDRESS}
			 FROM fonderie_customer_addresses ca
			 JOIN fonderie_addresses a ON a.id = ca.addr_id
			 WHERE ca.customer_id = $1
			 ORDER BY ca.is_primary DESC`,
			[customerId],
		);
	}

	async add(opts: {
		customerId: string;
		countryIso: string;
		subdivision1Iso?: string | null;
		subdivision2Iso?: string | null;
		zipPostalCode: string;
		line1?: string | null;
		line2?: string | null;
		label?: string;
		isPrimary?: boolean;
	}): Promise<ICustomerAddress> {
		return this.store.transaction(async (tx) => {
			if (opts.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_addresses
					 SET is_primary = false
					 WHERE customer_id = $1`,
					[opts.customerId],
				);
			}

			const [addr] = await tx.query<{ id: string }>(
				`INSERT INTO fonderie_addresses
				   (id, country_iso, subdivision1_iso, subdivision2_iso, zip_postal_code, line1, line2)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
				 RETURNING id`,
				[
					opts.countryIso,
					opts.subdivision1Iso ?? null,
					opts.subdivision2Iso ?? null,
					opts.zipPostalCode,
					opts.line1 ?? null,
					opts.line2 ?? null,
				],
			);
			if (!addr) throw new Error('Failed to create address');

			const [row] = await tx.query<ICustomerAddress>(
				`INSERT INTO fonderie_customer_addresses (addr_id, customer_id, label, is_primary)
				 VALUES ($1, $2, $3, $4)
				 RETURNING
				   addr_id     AS "addrId",
				   customer_id AS "customerId",
				   label,
				   is_primary  AS "isPrimary",
				   NULL::jsonb AS address`,
				[addr.id, opts.customerId, opts.label ?? 'service', opts.isPrimary ?? false],
			);
			if (!row) throw new Error('Failed to link address');

			const [full] = await tx.query<ICustomerAddress>(
				`SELECT ${SELECT_CUSTOMER_ADDRESS}
				 FROM fonderie_customer_addresses ca
				 JOIN fonderie_addresses a ON a.id = ca.addr_id
				 WHERE ca.addr_id = $1 AND ca.customer_id = $2`,
				[addr.id, opts.customerId],
			);
			if (!full) throw new Error('Failed to fetch created address');
			return full;
		});
	}

	async setPrimary(addrId: string, customerId: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customer_addresses
			 SET is_primary = (addr_id = $1)
			 WHERE customer_id = $2`,
			[addrId, customerId],
		);
	}

	async remove(addrId: string, customerId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			await tx.query(
				`DELETE FROM fonderie_customer_addresses
				 WHERE addr_id = $1 AND customer_id = $2`,
				[addrId, customerId],
			);
			await tx.query(`DELETE FROM fonderie_addresses WHERE id = $1`, [addrId]);
		});
	}
}
