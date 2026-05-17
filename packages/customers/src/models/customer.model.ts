import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomer, ICustomerDetail } from '../types';

const SELECT_CUSTOMER = `
	id,
	workspace_id   AS "workspaceId",
	type,
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
	firstName?: string | null;
	lastName?: string | null;
	companyName?: string | null;
	jobTitle?: string | null;
	avatarUrl?: string | null;
	locale?: string;
	referenceCode?: string | null;
	createdBy?: string | null;
}

export interface UpdateCustomerOpts {
	type?: string;
	firstName?: string | null;
	lastName?: string | null;
	companyName?: string | null;
	jobTitle?: string | null;
	avatarUrl?: string | null;
	locale?: string;
	referenceCode?: string | null;
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
		const [row] = await this.store.query<ICustomer>(
			`INSERT INTO fonderie_customers
			   (workspace_id, type, first_name, last_name, company_name, job_title, avatar_url, locale, reference_code, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING ${SELECT_CUSTOMER}`,
			[
				opts.workspaceId,
				opts.type ?? 'individual',
				opts.firstName ?? null,
				opts.lastName ?? null,
				opts.companyName ?? null,
				opts.jobTitle ?? null,
				opts.avatarUrl ?? null,
				opts.locale ?? 'en-US',
				opts.referenceCode ?? null,
				opts.createdBy ?? null,
			],
		);
		if (!row) throw new Error('Failed to create customer');
		return row;
	}

	async update(
		id: string,
		workspaceId: string,
		opts: UpdateCustomerOpts,
	): Promise<ICustomer | null> {
		const sets: string[] = ['updated_at = now()'];
		const params: unknown[] = [id, workspaceId];

		if (opts.type !== undefined) {
			params.push(opts.type);
			sets.push(`type = $${params.length}`);
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
		if (opts.referenceCode !== undefined) {
			params.push(opts.referenceCode);
			sets.push(`reference_code = $${params.length}`);
		}

		if (sets.length === 1) return this.findById(id, workspaceId);

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
