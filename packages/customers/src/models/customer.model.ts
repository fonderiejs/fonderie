import type { IStoreAdapter } from '@fonderie-js/store';

import { DEFAULT_REFERENCE_CODE_PREFIX } from '../config';
import type {
	ICustomer,
	ICustomerAddress,
	ICustomerDetail,
	ICustomerDetailD2,
	ICustomerEmail,
	ICustomerPhone,
	ICustomerRelationship,
	ICustomerRelationshipExpanded,
	ICustomerShallow,
	ICustomerShallowD2,
} from '../types';

function groupByCustomer<T extends { customerId: string }>(rows: T[]): Map<string, T[]> {
	return rows.reduce((m, r) => {
		if (!m.has(r.customerId)) m.set(r.customerId, []);
		m.get(r.customerId)!.push(r);
		return m;
	}, new Map<string, T[]>());
}

const SELECT_CUSTOMER = `
	id,
	workspace_id   AS "workspaceId",
	type,
	sex,
	first_name     AS "firstName",
	last_name      AS "lastName",
	company_name   AS "companyName",
	avatar_url     AS "avatarUrl",
	locale,
	reference_code AS "referenceCode",
	is_blacklisted    AS "isBlacklisted",
	blacklist_reason  AS "blacklistReason",
	created_by     AS "createdBy",
	created_at     AS "createdAt",
	updated_at     AS "updatedAt"
`;

export interface ListCustomersOpts {
	workspaceId: string;
	search?: string | undefined;
	blacklisted?: boolean | undefined;
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
	avatarUrl?: string | null;
	locale?: string;
	/** Explicit code to assign. Omit to keep existing or auto-generate if none. */
	referenceCode?: string;
}

export class CustomerModel {
	constructor(private readonly store: IStoreAdapter) {}

	private async allocateCode(workspaceId: string, prefix: string): Promise<string> {
		const [row] = await this.store.query<{ nextVal: number }>(
			`INSERT INTO fonderie_customer_sequences (workspace_id, prefix, next_val)
			 VALUES ($1, $2, 1)
			 ON CONFLICT (workspace_id, prefix) DO UPDATE
			   SET next_val = fonderie_customer_sequences.next_val + 1
			 RETURNING next_val AS "nextVal"`,
			[workspaceId, prefix],
		);
		return `${prefix}-${String(row!.nextVal).padStart(4, '0')}`;
	}

	async list(opts: ListCustomersOpts): Promise<ICustomer[]> {
		const conditions: string[] = ['workspace_id = $1'];
		const params: unknown[] = [opts.workspaceId];

		if (opts.blacklisted !== undefined) {
			params.push(opts.blacklisted);
			conditions.push(`is_blacklisted = $${params.length}`);
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

	async findDetail(id: string, workspaceId: string, depth: 2): Promise<ICustomerDetailD2 | null>;
	async findDetail(id: string, workspaceId: string, depth?: 1): Promise<ICustomerDetail | null>;
	async findDetail(id: string, workspaceId: string, depth = 1): Promise<ICustomerDetail | ICustomerDetailD2 | null> {
		const [row] = await this.store.query<ICustomer>(
			`SELECT ${SELECT_CUSTOMER}
			 FROM fonderie_customers
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
		if (!row) return null;

		const [emailRows, phoneRows, addressRows, noteRows, relationshipRows, tagRows] = await Promise.all([
			this.store.query<ICustomerEmail>(
				`SELECT id,
				        customer_id AS "customerId",
				        email,
				        label_id    AS "labelId",
				        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
				        is_primary  AS "isPrimary",
				        created_at  AS "createdAt"
				 FROM fonderie_customer_emails
				 WHERE customer_id = $1
				 ORDER BY is_primary DESC, created_at ASC`,
				[id],
			),
			this.store.query<ICustomerPhone>(
				`SELECT id,
				        customer_id AS "customerId",
				        phone,
				        label_id    AS "labelId",
				        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
				        is_primary  AS "isPrimary",
				        created_at  AS "createdAt"
				 FROM fonderie_customer_phones
				 WHERE customer_id = $1
				 ORDER BY is_primary DESC, created_at ASC`,
				[id],
			),
			this.store.query<ICustomerAddress>(
				`SELECT ca.addr_id     AS "addrId",
				        ca.customer_id AS "customerId",
				        ca.label_id    AS "labelId",
				        (SELECT value FROM fonderie_customer_labels WHERE id = ca.label_id) AS label,
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
				 FROM fonderie_customer_addresses ca
				 JOIN fonderie_addresses a ON a.id = ca.addr_id
				 WHERE ca.customer_id = $1
				 ORDER BY ca.is_primary DESC`,
				[id],
			),
			this.store.query<{
				id: string;
				customerId: string;
				authorId: string | null;
				body: string;
				createdAt: string;
				updatedAt: string;
			}>(
				`SELECT id,
				        customer_id AS "customerId",
				        author_id   AS "authorId",
				        body,
				        created_at  AS "createdAt",
				        updated_at  AS "updatedAt"
				 FROM fonderie_customer_notes
				 WHERE customer_id = $1
				 ORDER BY created_at DESC`,
				[id],
			),
			this.store.query<ICustomerRelationship>(
				`SELECT id,
				        workspace_id AS "workspaceId",
				        customer_id  AS "customerId",
				        related_id   AS "relatedId",
				        relationship,
				        is_primary   AS "isPrimary",
				        created_at   AS "createdAt"
				 FROM fonderie_customer_relationships
				 WHERE customer_id = $1
				 ORDER BY is_primary DESC, created_at ASC`,
				[id],
			),
			this.store.query<{ tag: string }>(
				`SELECT tag FROM fonderie_customer_tags WHERE customer_id = $1 ORDER BY tag ASC`,
				[id],
			),
		]);

		// Batch-resolve related customers so the caller gets full detail in one request.
		const relatedIds = relationshipRows.map((r) => r.relatedId);
		let expandedRelationships: ICustomerRelationshipExpanded[] = [];

		if (relatedIds.length > 0) {
			const [relCustomers, relEmails, relPhones, relAddresses, relNotes, relTags] = await Promise.all([
				this.store.query<ICustomer>(
					`SELECT ${SELECT_CUSTOMER} FROM fonderie_customers WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
					[relatedIds, workspaceId],
				),
				this.store.query<ICustomerEmail>(
					`SELECT id, customer_id AS "customerId", email, label_id AS "labelId",
					        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
					        is_primary AS "isPrimary", created_at AS "createdAt"
					 FROM fonderie_customer_emails WHERE customer_id = ANY($1::uuid[]) ORDER BY is_primary DESC, created_at ASC`,
					[relatedIds],
				),
				this.store.query<ICustomerPhone>(
					`SELECT id, customer_id AS "customerId", phone, label_id AS "labelId",
					        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
					        is_primary AS "isPrimary", created_at AS "createdAt"
					 FROM fonderie_customer_phones WHERE customer_id = ANY($1::uuid[]) ORDER BY is_primary DESC, created_at ASC`,
					[relatedIds],
				),
				this.store.query<ICustomerAddress>(
					`SELECT ca.addr_id     AS "addrId",
					        ca.customer_id AS "customerId",
					        ca.label_id    AS "labelId",
					        (SELECT value FROM fonderie_customer_labels WHERE id = ca.label_id) AS label,
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
					 FROM fonderie_customer_addresses ca
					 JOIN fonderie_addresses a ON a.id = ca.addr_id
					 WHERE ca.customer_id = ANY($1::uuid[])
					 ORDER BY ca.is_primary DESC`,
					[relatedIds],
				),
				this.store.query<{ id: string; customerId: string; authorId: string | null; body: string; createdAt: string; updatedAt: string }>(
					`SELECT id, customer_id AS "customerId", author_id AS "authorId", body, created_at AS "createdAt", updated_at AS "updatedAt"
					 FROM fonderie_customer_notes WHERE customer_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
					[relatedIds],
				),
				this.store.query<{ customerId: string; tag: string }>(
					`SELECT customer_id AS "customerId", tag FROM fonderie_customer_tags WHERE customer_id = ANY($1::uuid[]) ORDER BY tag ASC`,
					[relatedIds],
				),
			]);

			const customerMap = new Map(relCustomers.map((c) => [c.id, c]));

			const emailMap = groupByCustomer(relEmails);
			const phoneMap = groupByCustomer(relPhones);
			const addrMap  = groupByCustomer(relAddresses);
			const noteMap  = groupByCustomer(relNotes);
			const tagMap   = relTags.reduce((m, t) => {
				if (!m.has(t.customerId)) m.set(t.customerId, []);
				m.get(t.customerId)!.push(t.tag);
				return m;
			}, new Map<string, string[]>());

			expandedRelationships = relationshipRows.map((rel) => ({
				id:           rel.id,
				workspaceId:  rel.workspaceId,
				customerId:   rel.customerId,
				relationship: rel.relationship,
				isPrimary:    rel.isPrimary,
				createdAt:    rel.createdAt,
				customer: {
					...(customerMap.get(rel.relatedId) ?? ({ id: rel.relatedId } as ICustomer)),
					emails:    emailMap.get(rel.relatedId) ?? [],
					phones:    phoneMap.get(rel.relatedId) ?? [],
					addresses: addrMap.get(rel.relatedId)  ?? [],
					notes:     noteMap.get(rel.relatedId)  ?? [],
					tags:      tagMap.get(rel.relatedId)   ?? [],
				} as ICustomerShallow,
			}));
		}

		// ── Depth-2: resolve relationships of relationships ────────────────────
		if (depth >= 2 && expandedRelationships.length > 0) {
			const visited = new Set([id]); // guard against cycles back to root
			const d1Ids  = expandedRelationships.map((r) => r.customer.id);

			const d2RelRows = await this.store.query<ICustomerRelationship>(
				`SELECT id,
				        workspace_id AS "workspaceId",
				        customer_id  AS "customerId",
				        related_id   AS "relatedId",
				        relationship,
				        is_primary   AS "isPrimary",
				        created_at   AS "createdAt"
				 FROM fonderie_customer_relationships
				 WHERE customer_id = ANY($1::uuid[])
				 ORDER BY is_primary DESC, created_at ASC`,
				[d1Ids],
			);

			const validD2Rows = d2RelRows.filter((r) => !visited.has(r.relatedId));
			const d2Ids       = [...new Set(validD2Rows.map((r) => r.relatedId))];

			let d2CustomerMap = new Map<string, ICustomer>();
			let d2EmailMap    = new Map<string, ICustomerEmail[]>();
			let d2PhoneMap    = new Map<string, ICustomerPhone[]>();
			let d2NoteMap     = new Map<string, { id: string; customerId: string; authorId: string | null; body: string; createdAt: string; updatedAt: string }[]>();
			let d2TagMap      = new Map<string, string[]>();

			if (d2Ids.length > 0) {
				// Addresses are omitted at depth-2: family members share the parent tenant's
				// address and duplicating it inflates mobile payloads unnecessarily.
				const [d2Customers, d2Emails, d2Phones, d2Notes, d2Tags] = await Promise.all([
					this.store.query<ICustomer>(
						`SELECT ${SELECT_CUSTOMER} FROM fonderie_customers WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
						[d2Ids, workspaceId],
					),
					this.store.query<ICustomerEmail>(
						`SELECT id, customer_id AS "customerId", email, label_id AS "labelId",
						        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
						        is_primary AS "isPrimary", created_at AS "createdAt"
						 FROM fonderie_customer_emails WHERE customer_id = ANY($1::uuid[]) ORDER BY is_primary DESC, created_at ASC`,
						[d2Ids],
					),
					this.store.query<ICustomerPhone>(
						`SELECT id, customer_id AS "customerId", phone, label_id AS "labelId",
						        (SELECT value FROM fonderie_customer_labels WHERE id = label_id) AS label,
						        is_primary AS "isPrimary", created_at AS "createdAt"
						 FROM fonderie_customer_phones WHERE customer_id = ANY($1::uuid[]) ORDER BY is_primary DESC, created_at ASC`,
						[d2Ids],
					),
					this.store.query<{ id: string; customerId: string; authorId: string | null; body: string; createdAt: string; updatedAt: string }>(
						`SELECT id, customer_id AS "customerId", author_id AS "authorId", body, created_at AS "createdAt", updated_at AS "updatedAt"
						 FROM fonderie_customer_notes WHERE customer_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
						[d2Ids],
					),
					this.store.query<{ customerId: string; tag: string }>(
						`SELECT customer_id AS "customerId", tag FROM fonderie_customer_tags WHERE customer_id = ANY($1::uuid[]) ORDER BY tag ASC`,
						[d2Ids],
					),
				]);

				d2CustomerMap = new Map(d2Customers.map((c) => [c.id, c]));
				d2EmailMap    = groupByCustomer(d2Emails);
				d2PhoneMap    = groupByCustomer(d2Phones);
				d2NoteMap     = groupByCustomer(d2Notes);
				d2TagMap      = d2Tags.reduce((m, t) => {
					if (!m.has(t.customerId)) m.set(t.customerId, []);
					m.get(t.customerId)!.push(t.tag);
					return m;
				}, new Map<string, string[]>());
			}

			const d2Relationships: ICustomerRelationshipExpanded[] = validD2Rows.map((d2rel) => ({
				id:           d2rel.id,
				workspaceId:  d2rel.workspaceId,
				customerId:   d2rel.customerId,
				relationship: d2rel.relationship,
				isPrimary:    d2rel.isPrimary,
				createdAt:    d2rel.createdAt,
				customer: {
					...(d2CustomerMap.get(d2rel.relatedId) ?? ({ id: d2rel.relatedId } as ICustomer)),
					emails:    d2EmailMap.get(d2rel.relatedId) ?? [],
					phones:    d2PhoneMap.get(d2rel.relatedId) ?? [],
					addresses: [],
					notes:     d2NoteMap.get(d2rel.relatedId)  ?? [],
					tags:      d2TagMap.get(d2rel.relatedId)   ?? [],
				} as ICustomerShallow,
			}));

			const d2RelsByD1Id = groupByCustomer(d2Relationships);

			const d2ExpandedRelationships = expandedRelationships.map((rel) => ({
				...rel,
				customer: {
					...rel.customer,
					relationships: d2RelsByD1Id.get(rel.customer.id) ?? [],
				} as ICustomerShallowD2,
			}));

			return {
				...row,
				emails:        emailRows as unknown as ICustomerDetail['emails'],
				phones:        phoneRows as unknown as ICustomerDetail['phones'],
				addresses:     addressRows,
				notes:         noteRows as unknown as ICustomerDetail['notes'],
				relationships: d2ExpandedRelationships,
				tags:          tagRows.map((t) => t.tag),
			} as ICustomerDetailD2;
		}

		return {
			...row,
			// DB returns TEXT for label; cast to the narrow union that callers expect.
			emails: emailRows as unknown as ICustomerDetail['emails'],
			phones: phoneRows as unknown as ICustomerDetail['phones'],
			addresses: addressRows,
			notes: noteRows as unknown as ICustomerDetail['notes'],
			relationships: expandedRelationships,
			tags: tagRows.map((t) => t.tag),
		};
	}

	async create(opts: CreateCustomerOpts): Promise<ICustomer> {
		const referenceCode = opts.referenceCode
			?? await this.allocateCode(opts.workspaceId, opts.referenceCodePrefix ?? DEFAULT_REFERENCE_CODE_PREFIX);

		const [row] = await this.store.query<ICustomer>(
			`INSERT INTO fonderie_customers
			   (workspace_id, type, sex, first_name, last_name, company_name, avatar_url, locale, reference_code, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			 RETURNING ${SELECT_CUSTOMER}`,
			[
				opts.workspaceId,
				opts.type ?? 'individual',
				opts.sex ?? 'UNKNOWN',
				opts.firstName ?? null,
				opts.lastName ?? null,
				opts.companyName ?? null,
				opts.avatarUrl ?? null,
				opts.locale ?? 'en-US',
				referenceCode,
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
		referenceCodePrefix = DEFAULT_REFERENCE_CODE_PREFIX,
	): Promise<ICustomer | null> {
		// Auto-assign a reference code if the customer doesn't have one yet.
		let autoCode: string | undefined;
		if (!opts.referenceCode) {
			const current = await this.findById(id, workspaceId);
			if (!current) return null;
			if (!current.referenceCode) {
				autoCode = await this.allocateCode(workspaceId, referenceCodePrefix);
			}
		}

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
		if (opts.avatarUrl !== undefined) {
			params.push(opts.avatarUrl);
			sets.push(`avatar_url = $${params.length}`);
		}
		if (opts.locale !== undefined) {
			params.push(opts.locale);
			sets.push(`locale = $${params.length}`);
		}
		const resolvedCode = opts.referenceCode ?? autoCode;
		if (resolvedCode !== undefined) {
			params.push(resolvedCode);
			sets.push(`reference_code = $${params.length}`);
		}

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
		// Delete all sub-resources in parallel, then the customer.
		// Relationships: remove both sides (owner and target) — detach strategy,
		// related customers are left intact.
		// Addresses: delete the underlying fonderie_addresses rows directly; their
		// ON DELETE CASCADE removes the customer_addresses link automatically.
		// The remaining DB cascades on the customer row act as a safety net.
		await Promise.all([
			this.store.query(`DELETE FROM fonderie_customer_emails WHERE customer_id = $1`, [id]),
			this.store.query(`DELETE FROM fonderie_customer_phones WHERE customer_id = $1`, [id]),
			this.store.query(
				`DELETE FROM fonderie_addresses WHERE id IN (
					SELECT addr_id FROM fonderie_customer_addresses WHERE customer_id = $1
				)`,
				[id],
			),
			this.store.query(`DELETE FROM fonderie_customer_notes WHERE customer_id = $1`, [id]),
			this.store.query(`DELETE FROM fonderie_customer_tags WHERE customer_id = $1`, [id]),
			this.store.query(
				`DELETE FROM fonderie_customer_relationships WHERE customer_id = $1 OR related_id = $1`,
				[id],
			),
		]);
		await this.store.query(`DELETE FROM fonderie_customers WHERE id = $1 AND workspace_id = $2`, [
			id,
			workspaceId,
		]);
	}

	async blacklist(id: string, workspaceId: string, reason?: string | null): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customers
			 SET is_blacklisted = true, blacklist_reason = $3, updated_at = now()
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId, reason ?? null],
		);
	}

	async unblacklist(id: string, workspaceId: string): Promise<void> {
		await this.store.query(
			`UPDATE fonderie_customers
			 SET is_blacklisted = false, blacklist_reason = null, updated_at = now()
			 WHERE id = $1 AND workspace_id = $2`,
			[id, workspaceId],
		);
	}
}
