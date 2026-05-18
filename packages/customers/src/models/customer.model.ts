import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomer, ICustomerDetail } from '../types';

const SELECT_CUSTOMER = `
	id,
	workspace_id   AS "workspaceId",
	type,
	sex,
	first_name     AS "firstName",
	last_name      AS "lastName",
	company_name   AS "companyName",
	job_title      AS "jobTitle",
	avatar_url     AS "avatarUrl",
	locale,
	reference_code AS "referenceCode",
	is_archived    AS "isArchived",
	created_by     AS "createdBy",
	created_at     AS "createdAt",
	updated_at     AS "updatedAt"
`;

export interface ListCustomersOpts {
	workspaceId: string;
	search?: string | undefined;
	archived?: boolean | undefined;
	limit?: number | undefined;
	offset?: number | undefined;
}

export interface CreateCustomerOpts {
	workspaceId: string;
	type?: string;
	sex?: string;
	firstName?: string | null;
	lastName?: string | null;
	companyName?: string | null;
	jobTitle?: string | null;
	avatarUrl?: string | null;
	locale?: string;
	/** Explicit code to assign. Omit to auto-generate ({prefix}-0001, …). */
	referenceCode?: string;
	/** Prefix used when auto-generating. Defaults to 'CLT'. */
	referenceCodePrefix?: string;
	createdBy?: string | null;
}

export interface UpdateCustomerOpts {
	type?: string;
	sex?: string;
	firstName?: string | null;
	lastName?: string | null;
	companyName?: string | null;
	jobTitle?: string | null;
	avatarUrl?: string | null;
	locale?: string;
	/** Explicit code to assign. Omit to keep existing or auto-generate if none. */
	referenceCode?: string;
}

export class CustomerModel {
	constructor(private readonly store: IStoreAdapter) {}

	async list(opts: ListCustomersOpts): Promise<ICustomer[]> {
		const conditions: string[] = ['workspace_id = $1'];
		const params: unknown[] = [opts.workspaceId];

		if (opts.archived !== undefined) {
			params.push(opts.archived);
			conditions.push(`is_archived = $${params.length}`);
		} else {
			conditions.push('is_archived = false');
		}

		if (opts.search) {
			params.push(`%${opts.search}%`);
			const idx = params.length;
			conditions.push(
				`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR company_name ILIKE $${idx} OR reference_code ILIKE $${idx})`,
			);
		}

		const limit = Math.min(opts.limit ?? 50, 200);
		const offset = opts.offset ?? 0;
		params.push(limit, offset);
		const limitIdx = params.length - 1;
		const offsetIdx = params.length;

		return this.store.query<ICustomer>(
			`SELECT ${SELECT_CUSTOMER}
			 FROM fonderie_customers
			 WHERE ${conditions.join(' AND ')}
			 ORDER BY created_at DESC
			 LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
			params,
		);
	}

	async findById(id: string, workspaceId: string): Promise<ICustomer | null> {
		const [row] = await this.store.query<ICustomer>(
			`SELECT ${SELECT_CUSTOMER}
			 FROM fonderie_customers
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
		return row ?? null;
	}

	async findDetail(id: string, workspaceId: string): Promise<ICustomerDetail | null> {
		const [row] = await this.store.query<ICustomer>(
			`SELECT ${SELECT_CUSTOMER}
			 FROM fonderie_customers
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
		if (!row) return null;

		const [emailRows, phoneRows, tagRows] = await Promise.all([
			this.store.query<{
				id: string;
				customerId: string;
				email: string;
				label: string;
				isPrimary: boolean;
				createdAt: string;
			}>(
				`SELECT id,
				        customer_id AS "customerId",
				        email,
				        label,
				        is_primary  AS "isPrimary",
				        created_at  AS "createdAt"
				 FROM fonderie_customer_emails
				 WHERE customer_id = $1
				 ORDER BY is_primary DESC, created_at ASC`,
				[id],
			),
			this.store.query<{
				id: string;
				customerId: string;
				phone: string;
				label: string;
				isPrimary: boolean;
				createdAt: string;
			}>(
				`SELECT id,
				        customer_id AS "customerId",
				        phone,
				        label,
				        is_primary  AS "isPrimary",
				        created_at  AS "createdAt"
				 FROM fonderie_customer_phones
				 WHERE customer_id = $1
				 ORDER BY is_primary DESC, created_at ASC`,
				[id],
			),
			this.store.query<{ tag: string }>(
				`SELECT tag FROM fonderie_customer_tags WHERE customer_id = $1 ORDER BY tag ASC`,
				[id],
			),
		]);

		return {
			...row,
			// DB returns TEXT for label; cast to the narrow union that callers expect.
			emails: emailRows as unknown as ICustomerDetail['emails'],
			phones: phoneRows as unknown as ICustomerDetail['phones'],
			tags: tagRows.map((t) => t.tag),
		};
	}

	async create(opts: CreateCustomerOpts): Promise<ICustomer> {
		const pfx = opts.referenceCodePrefix ?? 'CLT';
		const [row] = await this.store.query<ICustomer>(
			`WITH next_code AS (
			   SELECT $12 || '-' || LPAD((
			     COALESCE(MAX(
			       CASE WHEN reference_code ~ ('^' || $12 || '-[0-9]+$')
			            THEN SUBSTRING(reference_code FROM LENGTH($12) + 2)::int
			            ELSE 0 END
			     ), 0) + 1
			   )::text, 4, '0') AS code
			   FROM fonderie_customers
			   WHERE workspace_id = $1
			 )
			 INSERT INTO fonderie_customers
			   (workspace_id, type, sex, first_name, last_name, company_name, job_title, avatar_url, locale, reference_code, created_by)
			 SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, next_code.code), $11
			 FROM next_code
			 RETURNING ${SELECT_CUSTOMER}`,
			[
				opts.workspaceId,
				opts.type ?? 'individual',
				opts.sex ?? 'UNKNOWN',
				opts.firstName ?? null,
				opts.lastName ?? null,
				opts.companyName ?? null,
				opts.jobTitle ?? null,
				opts.avatarUrl ?? null,
				opts.locale ?? 'en-US',
				opts.referenceCode ?? null,
				opts.createdBy ?? null,
				pfx,
			],
		);
		if (!row) throw new Error('Failed to create customer');
		return row;
	}

	async update(
		id: string,
		workspaceId: string,
		opts: UpdateCustomerOpts,
		referenceCodePrefix = 'CLT',
	): Promise<ICustomer | null> {
		const sets: string[] = ['updated_at = now()'];
		const params: unknown[] = [id, workspaceId];

		if (opts.type !== undefined) {
			params.push(opts.type);
			sets.push(`type = $${params.length}`);
		}
		if (opts.sex !== undefined) {
			params.push(opts.sex);
			sets.push(`sex = $${params.length}`);
		}
		if (opts.firstName !== undefined) {
			params.push(opts.firstName);
			sets.push(`first_name = $${params.length}`);
		}
		if (opts.lastName !== undefined) {
			params.push(opts.lastName);
			sets.push(`last_name = $${params.length}`);
		}
		if (opts.companyName !== undefined) {
			params.push(opts.companyName);
			sets.push(`company_name = $${params.length}`);
		}
		if (opts.jobTitle !== undefined) {
			params.push(opts.jobTitle);
			sets.push(`job_title = $${params.length}`);
		}
		if (opts.avatarUrl !== undefined) {
			params.push(opts.avatarUrl);
			sets.push(`avatar_url = $${params.length}`);
		}
		if (opts.locale !== undefined) {
			params.push(opts.locale);
			sets.push(`locale = $${params.length}`);
		}
		const pfx = referenceCodePrefix;
		params.push(opts.referenceCode ?? null);
		const refIdx = params.length;
		params.push(pfx);
		const pfxIdx = params.length;
		sets.push(
			`reference_code = COALESCE($${refIdx}::text, reference_code, $${pfxIdx} || '-' || LPAD((` +
			`SELECT COALESCE(MAX(CASE WHEN reference_code ~ ('^' || $${pfxIdx} || '-[0-9]+$') ` +
			`THEN SUBSTRING(reference_code FROM LENGTH($${pfxIdx}) + 2)::int ELSE 0 END), 0) + 1 ` +
			`FROM fonderie_customers WHERE workspace_id = $2)::text, 4, '0'))`,
		);

		const [row] = await this.store.query<ICustomer>(
			`UPDATE fonderie_customers
			 SET ${sets.join(', ')}
			 WHERE id = $1 AND workspace_id = $2
			 RETURNING ${SELECT_CUSTOMER}`,
			params,
		);
		return row ?? null;
	}

	async delete(id: string, workspaceId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_customers WHERE id = $1 AND workspace_id = $2`, [
			id,
			workspaceId,
		]);
	}

	async archive(id: string, workspaceId: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customers
			 SET is_archived = true, updated_at = now()
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
	}

	async restore(id: string, workspaceId: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customers
			 SET is_archived = false, updated_at = now()
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
	}
}
