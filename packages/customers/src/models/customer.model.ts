import { DEFAULT_SYSTEM_LOCALE } from '@fonderie/core';
import { randomInt } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

import { binCustomer } from './customer-bin';
import { DEFAULT_REFERENCE_CODE_PREFIX, REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH } from '../config';
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

// How many hand-set codes in a row the counter will step over before giving up.
const MAX_CODE_SKIPS = 100;
// How many times a create or update retries a code it generated itself after
// losing it to a concurrent writer (the unique index is the final guard).
const MAX_CODE_RETRIES = 3;

/** Which workspace-unique code a unique violation was about, if either. */
export function duplicateCode(err: unknown): 'reference' | 'referral' | null {
	const e = err as { code?: string; constraint?: string; message?: string };
	if (e?.code !== '23505') return null;
	const name = e.constraint ?? e.message ?? '';
	if (name.includes('idx_fc_reference_code')) return 'reference';
	if (name.includes('idx_fc_referral_code')) return 'referral';
	return null;
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
	timezone,
	reference_code AS "referenceCode",
	referral_code  AS "referralCode",
	referred_by    AS "referredBy",
	is_blacklisted    AS "isBlacklisted",
	is_archived       AS "isArchived",
	archived_at       AS "archivedAt",
	blacklist_reason  AS "blacklistReason",
	created_by     AS "createdBy",
	created_at     AS "createdAt",
	updated_at     AS "updatedAt"
`;

// The same columns read through the `c` alias the list/count queries use.
const SELECT_CUSTOMER_C = `
	c.id,
	c.workspace_id   AS "workspaceId",
	c.type,
	c.sex,
	c.first_name     AS "firstName",
	c.last_name      AS "lastName",
	c.company_name   AS "companyName",
	c.avatar_url     AS "avatarUrl",
	c.locale,
	c.timezone,
	c.reference_code AS "referenceCode",
	c.referral_code  AS "referralCode",
	c.referred_by    AS "referredBy",
	c.is_blacklisted    AS "isBlacklisted",
	c.is_archived       AS "isArchived",
	c.archived_at       AS "archivedAt",
	c.blacklist_reason  AS "blacklistReason",
	c.created_by     AS "createdBy",
	c.created_at     AS "createdAt",
	c.updated_at     AS "updatedAt"
`;

export interface ListCustomersOpts {
	workspaceId: string;
	search?: string | undefined;
	blacklisted?: boolean | undefined;
	/** false (default): active only; true: archived only; 'all': both. */
	archived?: boolean | 'all' | undefined;
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
	/** IANA time zone (e.g. 'America/Toronto'). Omit or null: none — the business's zone applies. */
	timezone?: string | null;
	/** Explicit code to assign. Omit to auto-generate ({prefix}-0001, …). */
	referenceCode?: string;
	/** Prefix used when auto-generating. Defaults to 'CLT'. */
	referenceCodePrefix?: string;
	/** Explicit referral code. Omit to auto-generate a random, workspace-unique one. */
	referralCode?: string;
	/** The referrer's referral code (from signup). Resolved to `referredBy` within the same workspace; ignored if it doesn't match a customer. */
	referredByCode?: string;
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
	/** IANA time zone; null clears it. */
	timezone?: string | null;
	/** Explicit code to assign. Omit to keep existing or auto-generate if none. */
	referenceCode?: string;
}

export class CustomerModel {
	constructor(private readonly store: IStoreAdapter) {}

	/**
	 * The next counter code no customer holds yet. Codes can also be set by hand,
	 * so the counter may reach one that is taken: it skips past it rather than
	 * handing it out — a create then failed with a "duplicate reference code" the
	 * caller never sent, and an update with a 500. Each bump is atomic, so
	 * concurrent callers never get the same value; a code set by hand between the
	 * check and the write is the insert's retry to absorb.
	 */
	private async allocateCode(workspaceId: string, prefix: string): Promise<string> {
		for (let skipped = 0; skipped < MAX_CODE_SKIPS; skipped++) {
			// Formatted as padStart(4, '0') would: lpad alone cuts 12345 to 1234.
			const [row] = await this.store.query<{ code: string; taken: boolean }>(
				`WITH bumped AS (
				   INSERT INTO fonderie_customer_sequences (workspace_id, prefix, next_val)
				   VALUES ($1, $2, 1)
				   ON CONFLICT (workspace_id, prefix) DO UPDATE
				     SET next_val = fonderie_customer_sequences.next_val + 1
				   RETURNING $2::text || '-' || CASE WHEN next_val >= 1000 THEN next_val::text
				                                     ELSE lpad(next_val::text, 4, '0') END AS code
				 )
				 SELECT code, EXISTS (
				   SELECT 1 FROM fonderie_customers c WHERE c.workspace_id = $1 AND c.reference_code = bumped.code
				 ) AS taken
				 FROM bumped`,
				[workspaceId, prefix],
			);
			if (!row!.taken) return row!.code;
		}
		throw new Error('could not allocate a free reference code');
	}

	/** A random referral code (crypto-random over the unambiguous alphabet). */
	private randomReferralCode(): string {
		let out = '';
		for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
			out += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
		}
		return out;
	}

	/**
	 * A referral code unique within the workspace. Random codes collide only
	 * astronomically rarely; we still pre-check and retry a few times, and the
	 * unique index is the final guard — create() retries on it. Throws only if
	 * the space is somehow exhausted (not reachable in practice).
	 */
	private async allocateReferralCode(workspaceId: string): Promise<string> {
		for (let attempt = 0; attempt < 5; attempt++) {
			const code = this.randomReferralCode();
			const [hit] = await this.store.query<{ one: number }>(
				`SELECT 1 AS one FROM fonderie_customers WHERE workspace_id = $1 AND referral_code = $2 LIMIT 1`,
				[workspaceId, code],
			);
			if (!hit) return code;
		}
		throw new Error('could not allocate a unique referral code');
	}

	/** Resolve a referral code to the referring customer's id, within a workspace. */
	async resolveReferralCode(workspaceId: string, code: string): Promise<string | null> {
		const [row] = await this.store.query<{ id: string }>(
			`SELECT id FROM fonderie_customers WHERE workspace_id = $1 AND referral_code = $2 LIMIT 1`,
			[workspaceId, code],
		);
		return row?.id ?? null;
	}

	// One WHERE for the list and its count, so the total always describes the
	// same rows. Search covers names, company, reference code, any email, and
	// any phone — by digits, so '514 555' finds '+1 (514) 555-0100'.
	private where(opts: Omit<ListCustomersOpts, 'limit' | 'offset'>): { sql: string; params: unknown[] } {
		const conditions: string[] = ['c.workspace_id = $1'];
		const params: unknown[] = [opts.workspaceId];

		if (opts.blacklisted !== undefined) {
			params.push(opts.blacklisted);
			conditions.push(`c.is_blacklisted = $${params.length}`);
		}
		if (opts.archived !== 'all') {
			params.push(opts.archived === true);
			conditions.push(`c.is_archived = $${params.length}`);
		}
		const search = opts.search?.trim();
		if (search) {
			params.push(`%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
			const idx = params.length;
			const any = [
				`c.first_name ILIKE $${idx}`,
				`c.last_name ILIKE $${idx}`,
				`c.company_name ILIKE $${idx}`,
				`c.reference_code ILIKE $${idx}`,
				`EXISTS (SELECT 1 FROM fonderie_customer_emails e WHERE e.customer_id = c.id AND e.email ILIKE $${idx})`,
			];
			const digits = search.replace(/\D/g, '');
			if (digits.length >= 3) {
				params.push(`%${digits}%`);
				any.push(
					`EXISTS (SELECT 1 FROM fonderie_customer_phones p WHERE p.customer_id = c.id AND regexp_replace(p.phone, '\\D', '', 'g') LIKE $${params.length})`,
				);
			}
			conditions.push(`(${any.join(' OR ')})`);
		}
		return { sql: conditions.join(' AND '), params };
	}

	async list(opts: ListCustomersOpts): Promise<ICustomer[]> {
		const { sql, params } = this.where(opts);
		const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
		const offset = Math.max(0, opts.offset ?? 0);
		params.push(limit, offset);
		return this.store.query<ICustomer>(
			`SELECT ${SELECT_CUSTOMER_C}
			 FROM fonderie_customers c
			 WHERE ${sql}
			 ORDER BY c.created_at DESC, c.id
			 LIMIT $${params.length - 1} OFFSET $${params.length}`,
			params,
		);
	}

	async count(opts: Omit<ListCustomersOpts, 'limit' | 'offset'>): Promise<number> {
		const { sql, params } = this.where(opts);
		const [row] = await this.store.query<{ count: string }>(
			`SELECT COUNT(*) AS count FROM fonderie_customers c WHERE ${sql}`,
			params,
		);
		return Number(row?.count ?? 0);
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
		const prefix = opts.referenceCodePrefix ?? DEFAULT_REFERENCE_CODE_PREFIX;
		let referenceCode = opts.referenceCode ?? await this.allocateCode(opts.workspaceId, prefix);

		// Every customer gets a shareable referral code at creation.
		let referralCode = opts.referralCode ?? await this.allocateReferralCode(opts.workspaceId);

		// If they signed up with someone's code, record who referred them (same
		// workspace). An unknown code is ignored, not an error — signup shouldn't
		// fail because a referral code was mistyped.
		const referredBy = opts.referredByCode
			? await this.resolveReferralCode(opts.workspaceId, opts.referredByCode)
			: null;

		// A generated code can still be taken between its check and this insert
		// (a concurrent create, a code typed by hand). That one is generated
		// again; a code the caller chose is theirs to change, so its duplicate
		// goes back to them (duplicateCode → 409), never a 500.
		for (let attempt = 0; ; attempt++) {
			try {
				const [row] = await this.store.query<ICustomer>(
					`INSERT INTO fonderie_customers
					   (workspace_id, type, sex, first_name, last_name, company_name, avatar_url, locale, reference_code, referral_code, referred_by, created_by, timezone)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
					 RETURNING ${SELECT_CUSTOMER}`,
					[
						opts.workspaceId,
						opts.type ?? 'individual',
						opts.sex ?? 'UNKNOWN',
						opts.firstName ?? null,
						opts.lastName ?? null,
						opts.companyName ?? null,
						opts.avatarUrl ?? null,
						opts.locale ?? DEFAULT_SYSTEM_LOCALE,
						referenceCode,
						referralCode,
						referredBy,
						opts.createdBy ?? null,
						opts.timezone ?? null,
					],
				);
				if (!row) throw new Error('Failed to create customer');
				return row;
			} catch (err) {
				const which = duplicateCode(err);
				if (attempt >= MAX_CODE_RETRIES) throw err;
				if (which === 'reference' && !opts.referenceCode) {
					referenceCode = await this.allocateCode(opts.workspaceId, prefix);
				} else if (which === 'referral' && !opts.referralCode) {
					referralCode = await this.allocateReferralCode(opts.workspaceId);
				} else {
					throw err;
				}
			}
		}
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
		if (opts.timezone !== undefined) {
			params.push(opts.timezone);
			sets.push(`timezone = $${params.length}`);
		}
		const resolvedCode = opts.referenceCode ?? autoCode;
		if (resolvedCode !== undefined) {
			params.push(resolvedCode);
			sets.push(`reference_code = $${params.length}`);
		}

		// As in create(): a generated code lost to a concurrent writer is
		// generated again; a duplicate the caller chose is thrown for a 409.
		for (let attempt = 0; ; attempt++) {
			try {
				const [row] = await this.store.query<ICustomer>(
					`UPDATE fonderie_customers
					 SET ${sets.join(', ')}
					 WHERE id = $1 AND workspace_id = $2
					 RETURNING ${SELECT_CUSTOMER}`,
					params,
				);
				return row ?? null;
			} catch (err) {
				if (autoCode === undefined || duplicateCode(err) !== 'reference' || attempt >= MAX_CODE_RETRIES) {
					throw err;
				}
				autoCode = await this.allocateCode(workspaceId, referenceCodePrefix);
				params[params.length - 1] = autoCode;
			}
		}
	}

	/**
	 * Delete a customer and everything attached, in ONE transaction. Before, the
	 * attachments went first in separate statements: when the database then
	 * refused the customer row (an app's job or invoice still references it),
	 * their emails, phones and notes were already gone. Now a refusal undoes
	 * everything and surfaces as CustomerInUseError.
	 */
	async delete(id: string, workspaceId: string, deletedBy: string | null = null): Promise<void> {
		try {
			await this.store.transaction(async (tx) => {
				// Into the undo bin first: restorable for 30 days. Same transaction,
				// so a refused delete leaves no snapshot behind.
				await binCustomer(tx, id, workspaceId, deletedBy);
				await tx.query(
					`DELETE FROM fonderie_addresses WHERE id IN (
						SELECT addr_id FROM fonderie_customer_addresses WHERE customer_id = $1
					)`,
					[id],
				);
				await tx.query(`DELETE FROM fonderie_customer_relationships WHERE customer_id = $1 OR related_id = $1`, [id]);
				// Emails, phones, notes, tags and label links cascade with the row.
				await tx.query(`DELETE FROM fonderie_customers WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
			});
		} catch (err) {
			if ((err as { code?: string }).code === '23503') throw new CustomerInUseError(id);
			throw err;
		}
	}

	async archive(id: string, workspaceId: string): Promise<boolean> {
		const rows = await this.store.query(
			`UPDATE fonderie_customers SET is_archived = true, archived_at = now(), updated_at = now()
			 WHERE id = $1 AND workspace_id = $2 RETURNING id`,
			[id, workspaceId],
		);
		return rows.length > 0;
	}

	async unarchive(id: string, workspaceId: string): Promise<boolean> {
		const rows = await this.store.query(
			`UPDATE fonderie_customers SET is_archived = false, archived_at = NULL, updated_at = now()
			 WHERE id = $1 AND workspace_id = $2 RETURNING id`,
			[id, workspaceId],
		);
		return rows.length > 0;
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

/** Something still references this customer (a job, a quote, an invoice…): archive it instead. */
export class CustomerInUseError extends Error {
	constructor(readonly customerId: string) {
		super('Customer is still referenced');
		this.name = 'CustomerInUseError';
	}
}
