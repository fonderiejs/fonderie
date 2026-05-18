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
		'unit',            a.unit,
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
		unit?: string | null;
		line1?: string | null;
		line2?: string | null;
		label?: string;
		isPrimary?: boolean;
	}): Promise<ICustomerAddress> {
		const [existing] = await this.store.query<{ addrId: string }>(
			`SELECT ca.addr_id AS "addrId"
			 FROM fonderie_customer_addresses ca
			 JOIN fonderie_addresses a ON a.id = ca.addr_id
			 WHERE ca.customer_id = $1
			   AND a.country_iso        = $2
			   AND a.zip_postal_code    = $3
			   AND a.subdivision1_iso IS NOT DISTINCT FROM $4
			   AND a.subdivision2_iso IS NOT DISTINCT FROM $5
			   AND a.unit             IS NOT DISTINCT FROM $6
			   AND a.line1            IS NOT DISTINCT FROM $7
			   AND a.line2            IS NOT DISTINCT FROM $8
			 LIMIT 1`,
			[
				opts.customerId,
				opts.countryIso,
				opts.zipPostalCode,
				opts.subdivision1Iso ?? null,
				opts.subdivision2Iso ?? null,
				opts.unit ?? null,
				opts.line1 ?? null,
				opts.line2 ?? null,
			],
		);
		if (existing) {
			throw Object.assign(new Error('Duplicate address for this customer'), { code: 'DUPLICATE_ADDRESS' });
		}

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
				   (id, country_iso, subdivision1_iso, subdivision2_iso, zip_postal_code, unit, line1, line2)
				 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
				 RETURNING id`,
				[
					opts.countryIso,
					opts.subdivision1Iso ?? null,
					opts.subdivision2Iso ?? null,
					opts.zipPostalCode,
					opts.unit ?? null,
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
		await this.store.transaction(async (tx) => {
			await tx.query(
				`UPDATE fonderie_customer_addresses SET is_primary = false WHERE customer_id = $1`,
				[customerId],
			);
			await tx.query(
				`UPDATE fonderie_customer_addresses SET is_primary = true WHERE addr_id = $1 AND customer_id = $2`,
				[addrId, customerId],
			);
		});
	}

	async remove(addrId: string, customerId: string): Promise<void> {
		await this.store.transaction(async (tx) => {
			const [deleted] = await tx.query<{ isPrimary: boolean }>(
				`DELETE FROM fonderie_customer_addresses
				 WHERE addr_id = $1 AND customer_id = $2
				 RETURNING is_primary AS "isPrimary"`,
				[addrId, customerId],
			);
			await tx.query(`DELETE FROM fonderie_addresses WHERE id = $1`, [addrId]);
			if (deleted?.isPrimary) {
				await tx.query(
					`UPDATE fonderie_customer_addresses
					 SET is_primary = true
					 WHERE addr_id = (
					   SELECT addr_id FROM fonderie_customer_addresses
					   WHERE customer_id = $1
					   ORDER BY addr_id ASC
					   LIMIT 1
					 )`,
					[customerId],
				);
			}
		});
	}
}
