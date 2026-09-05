import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';
import { EVENT_KEYS } from '../config';
import { toCustomerDTO } from '../dtos/customer';
import { CustomersModule } from '../module';
import type { ICustomer } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const CUST_ID = '00000000-0000-0000-0000-000000000001';
const WS_ID   = '00000000-0000-0000-0000-000000000002';

const CUSTOMER: ICustomer = {
	id: CUST_ID,
	workspaceId: WS_ID,
	type: 'individual',
	sex: 'UNKNOWN',
	firstName: 'Jane',
	lastName: 'Doe',
	companyName: null,
	avatarUrl: null,
	locale: 'en-US',
	referenceCode: null,
	referralCode: null,
	referredBy: null,
	isBlacklisted: false,
	blacklistReason: null,
	createdBy: null,
	createdAt: NOW,
	updatedAt: NOW,
};

function makeStore(opts: { customer?: ICustomer | null } = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_customers') && sql.includes('WHERE id = $1')) {
				if (!opts.customer) return [] as T[];
				return [opts.customer] as unknown as T[];
			}
			if (sql.includes('fonderie_customer_sequences')) {
				return [{ nextVal: 1 }] as unknown as T[];
			}
			if (sql.includes('INSERT INTO fonderie_customers')) {
				if (!opts.customer) return [] as T[];
				return [opts.customer] as unknown as T[];
			}
			if (sql.includes('UPDATE fonderie_customers') && sql.includes('RETURNING')) {
				if (!opts.customer) return [] as T[];
				return [opts.customer] as unknown as T[];
			}
			if (sql.includes('fonderie_customer_emails') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			if (sql.includes('fonderie_customer_phones') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			if (sql.includes('fonderie_customer_addresses') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			if (sql.includes('fonderie_customer_notes') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			if (sql.includes('fonderie_customer_relationships') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			if (sql.includes('fonderie_customer_tags') && sql.includes('ORDER BY')) {
				return [] as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

function makeCtx(
	opts: {
		workspaceId?: string;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		user?: { id: string; email: string } | null;
	} = {},
): any {
	return {
		user: opts.user ?? null,
		workspace: opts.workspaceId ? { id: opts.workspaceId, name: 'Test Workspace' } : null,
		tenant: null,
		meta: {
			body: opts.body ?? {},
			params: opts.params ?? {},
		},
		request: new Request('http://localhost/customers'),
	};
}

// ── CustomersModule ───────────────────────────────────────────────────────────

test('CustomersModule instantiates', () => {
	assert.equal(new CustomersModule({} as never).name, '@fonderie/customers');
});

test('CustomersModule.install registers routes', () => {
	const routes: unknown[] = [];
	const fakeApp = { addRoute: (...args: unknown[]) => routes.push(args), use: () => {} } as any;
	new CustomersModule(makeStore(), {}).install(fakeApp);
	assert.ok(routes.length > 0, 'routes should be registered');
});

// ── EVENT_KEYS ────────────────────────────────────────────────────────────────

test('EVENT_KEYS are defined', () => {
	assert.ok(EVENT_KEYS.customerCreated);
	assert.ok(EVENT_KEYS.customerBlacklisted);
	assert.ok(EVENT_KEYS.customerUpdated);
	assert.ok(EVENT_KEYS.customerDeleted);
	assert.ok(EVENT_KEYS.customerUnblacklisted);
});

// ── toCustomerDTO ─────────────────────────────────────────────────────────────

test('toCustomerDTO: maps all fields correctly', () => {
	const dto = toCustomerDTO(CUSTOMER);
	assert.equal(dto.id, CUST_ID);
	assert.equal(dto.type, 'individual');
	assert.equal(dto.firstName, 'Jane');
	assert.equal(dto.lastName, 'Doe');
	assert.equal(dto.companyName, '');
	assert.equal(dto.blacklisted.status, false);
	assert.equal(dto.blacklisted.reason, null);
});

// ── referral code + referred_by (CustomerModel) ──────────────────────────────

test('create: auto-generates a random workspace-unique referral code, resolves referredByCode', async () => {
	const { CustomerModel } = await import('../models/customer.model');
	let insertParams: unknown[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_customer_sequences')) return [{ nextVal: 1 }] as unknown as T[];
			// allocateReferralCode collision pre-check → no collision
			if (sql.includes('1 AS one') && sql.includes('referral_code = $2')) return [] as T[];
			// resolveReferralCode → the referrer's id
			if (sql.includes('SELECT id') && sql.includes('referral_code = $2')) {
				return [{ id: 'referrer-id' }] as unknown as T[];
			}
			if (sql.includes('INSERT INTO fonderie_customers')) {
				insertParams = params ?? [];
				return [{ ...CUSTOMER }] as unknown as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const model = new CustomerModel(store);
	await model.create({ workspaceId: WS_ID, firstName: 'Jane', referredByCode: 'REFERRERX' });

	// INSERT order: (…, reference_code[8], referral_code[9], referred_by[10], created_by[11])
	const referralCode = insertParams[9] as string;
	const referredBy = insertParams[10];
	assert.equal(typeof referralCode, 'string');
	assert.equal(referralCode.length, 8, 'referral code is 8 chars');
	assert.match(referralCode, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/, 'unambiguous alphabet, random');
	assert.equal(referredBy, 'referrer-id', 'referredByCode resolved to the referrer id');
});

test('create: unknown referredByCode is ignored (signup does not fail), referred_by null', async () => {
	const { CustomerModel } = await import('../models/customer.model');
	let insertParams: unknown[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_customer_sequences')) return [{ nextVal: 1 }] as unknown as T[];
			if (sql.includes('1 AS one') && sql.includes('referral_code = $2')) return [] as T[];
			if (sql.includes('SELECT id') && sql.includes('referral_code = $2')) return [] as T[]; // not found
			if (sql.includes('INSERT INTO fonderie_customers')) { insertParams = params ?? []; return [{ ...CUSTOMER }] as unknown as T[]; }
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const model = new CustomerModel(store);
	await model.create({ workspaceId: WS_ID, referredByCode: 'NOPENOPE' });
	assert.equal(insertParams[10], null, 'unresolved referral code → referred_by null, not an error');
});

test('toCustomerDTO: exposes referralCode and referredBy', () => {
	const dto = toCustomerDTO({ ...CUSTOMER, referralCode: 'AB23CD45', referredBy: 'referrer-id' });
	assert.equal(dto.referralCode, 'AB23CD45');
	assert.equal(dto.referredBy, 'referrer-id');
});

// ── customerController ────────────────────────────────────────────────────────

test('customerController.list: 400 when workspaceId missing', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.list(makeCtx({}));
	assert.equal(res.status, 400);
});

test('customerController.list: 200 with customers array', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const store: IStoreAdapter = {
		query: async <T = unknown>() => [CUSTOMER] as unknown as T[],
		transaction: async (fn) => fn(store),
	};
	const ctrl = customerController(store);
	const res = await ctrl.list(makeCtx({ workspaceId: WS_ID }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMERS_FETCHED');
	assert.ok(Array.isArray(body.result.customers));
});

test('customerController.create: 422 when type is invalid', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(makeCtx({ workspaceId: WS_ID, body: { type: 'corporation' } }));
	assert.equal(res.status, 422);
});

test('customerController.create: 201 with customer DTO', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(
		makeCtx({
			workspaceId: WS_ID,
			user: { id: 'user-1', email: 'a@b.com' },
			body: { firstName: 'Jane', lastName: 'Doe' },
		}),
	);
	assert.equal(res.status, 201);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_CREATED');
	assert.ok(body.result.customer);
	assert.equal(body.result.customer.id, CUST_ID);
});

test('customerController.get: 404 when customer not found', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: null }));
	const res = await ctrl.get(makeCtx({ workspaceId: WS_ID, params: { customerId: '00000000-0000-0000-0000-000000000099' } }));
	assert.equal(res.status, 404);
});

test('customerController.delete: 404 when customer not found', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: null }));
	const res = await ctrl.delete(makeCtx({ workspaceId: WS_ID, params: { customerId: '00000000-0000-0000-0000-000000000099' } }));
	assert.equal(res.status, 404);
});

test('customerController.blacklist: 200 on success', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.blacklist(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_BLACKLISTED');
});

test('customerController.unblacklist: 200 on success', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.unblacklist(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_UNBLACKLISTED');
});

// ── customerEmailController ───────────────────────────────────────────────────

test('customerEmailController.add: 422 when email missing', async () => {
	const { customerEmailController } = await import('../controllers/customer-email.controller');
	const ctrl = customerEmailController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID }, body: {} }));
	assert.equal(res.status, 422);
});

// ── customerPhoneController ───────────────────────────────────────────────────

test('customerPhoneController.add: 422 when phone missing', async () => {
	const { customerPhoneController } = await import('../controllers/customer-phone.controller');
	const ctrl = customerPhoneController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID }, body: {} }));
	assert.equal(res.status, 422);
});

// ── customerNoteController ────────────────────────────────────────────────────

test('customerNoteController.create: 422 when body missing', async () => {
	const { customerNoteController } = await import('../controllers/customer-note.controller');
	const ctrl = customerNoteController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(
		makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID }, body: {} }),
	);
	assert.equal(res.status, 422);
});

// ── customerTagController ─────────────────────────────────────────────────────

test('customerTagController.add: 422 when tag missing', async () => {
	const { customerTagController } = await import('../controllers/customer-tag.controller');
	const ctrl = customerTagController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID }, body: {} }));
	assert.equal(res.status, 422);
});

test('customerTagController.list: 200 with tags array', async () => {
	const { customerTagController } = await import('../controllers/customer-tag.controller');
	const ctrl = customerTagController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.list(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.ok(Array.isArray(body.result.tags));
});

// ── customerRelationshipController ────────────────────────────────────────────

test('customerRelationshipController.add: 422 when relatedId missing', async () => {
	const { customerRelationshipController } = await import('../controllers/customer-relationship.controller');
	const ctrl = customerRelationshipController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID }, body: {} }));
	assert.equal(res.status, 422);
});

test('customerRelationshipController.list: 200 with relationships array', async () => {
	const { customerRelationshipController } = await import('../controllers/customer-relationship.controller');
	const ctrl = customerRelationshipController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.list(makeCtx({ workspaceId: WS_ID, params: { customerId: CUST_ID } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.ok(Array.isArray(body.result.relationships));
});

// ── audit closeout: update schemas match what controllers apply ──

test('email/phone/address update schemas accept only the label (the one editable field)', async () => {
	const { updateEmailSchema, updatePhoneSchema, updateAddressSchema } = await import('../schemas');
	for (const schema of [updateEmailSchema, updatePhoneSchema, updateAddressSchema]) {
		assert.equal(schema.safeParse({ label: 'work' }).success, true);
		// Content changes are remove-and-re-add; setPrimary has its own route.
		// The old schemas accepted these and the controllers silently ignored
		// them (or 422'd on the missing label anyway).
		assert.equal(schema.safeParse({ isPrimary: true }).success, false);
		assert.equal(schema.safeParse({}).success, false);
	}
	assert.equal(updateEmailSchema.safeParse({ email: 'a@b.com' }).success, false);
	assert.equal(updatePhoneSchema.safeParse({ phone: '+15550001111' }).success, false);

// ── DTO gap fixes (docs/DTO-GAP-AUDIT.md, customers batch) ────────

test('email/phone/address DTOs expose labelId for label-admin correlation', async () => {
	const { toCustomerEmailDTO, toCustomerPhoneDTO, toCustomerAddressDTO } = await import(
		'../dtos/customer'
	);
	const email = toCustomerEmailDTO({
		id: 'e1', email: 'a@b.com', label: 'work', labelId: 'lab-1', isPrimary: true,
		createdAt: '2026-09-05T00:00:00.000Z',
	} as never);
	assert.equal(email.labelId, 'lab-1');
	const phone = toCustomerPhoneDTO({
		id: 'p1', phone: '+15550001111', label: 'work', labelId: null, isPrimary: false,
		createdAt: '2026-09-05T00:00:00.000Z',
	} as never);
	assert.equal(phone.labelId, null);
	const addr = toCustomerAddressDTO({
		addrId: 'a1', label: 'home', labelId: 'lab-2', isPrimary: false,
		address: { countryIso: 'CA', zipPostalCode: 'H2X 1Y4' },
	} as never);
	assert.equal(addr.labelId, 'lab-2');
});

test('expanded relationships carry relationshipCreatedAt distinct from the customer dates', async () => {
	const { toCustomerRelationshipExpandedDTO } = await import('../dtos/customer');
	const dto = toCustomerRelationshipExpandedDTO({
		id: 'r1',
		relationship: 'spouse',
		isPrimary: true,
		createdAt: new Date('2026-09-01T00:00:00.000Z'),
		customer: {
			id: 'c2', type: 'individual', sex: 'UNKNOWN', firstName: 'Ada', lastName: 'L',
			companyName: '', avatarUrl: '', locale: '', referenceCode: '', referralCode: '',
			referredBy: null, isBlacklisted: false, blacklistReason: null, createdBy: 'u1',
			createdAt: new Date('2020-01-01T00:00:00.000Z'),
			updatedAt: new Date('2020-01-01T00:00:00.000Z'),
			emails: [], phones: [], addresses: [], notes: [], tags: [],
		},
	} as never);
	// The relationship's own date — NOT the related customer's signup date.
	assert.equal(dto.relationshipCreatedAt, '2026-09-01T00:00:00.000Z');
	assert.equal(dto.createdAt, '2020-01-01T00:00:00.000Z');
});

test('toCustomerLabelDTO serializes the Date row the label route used to leak raw', async () => {
	const { toCustomerLabelDTO } = await import('../dtos/customer');
	const dto = toCustomerLabelDTO({
		id: 'lab-1', type: 'email', value: 'work',
		createdAt: new Date('2026-09-05T00:00:00.000Z'),
	} as never);
	assert.equal(dto.createdAt, '2026-09-05T00:00:00.000Z');
});

test('addRelationshipSchema requires relationship (the controller always did)', async () => {
	const { addRelationshipSchema } = await import('../schemas');
	assert.equal(addRelationshipSchema.safeParse({ relatedId: 'c2' }).success, false);
	assert.equal(addRelationshipSchema.safeParse({ relatedId: 'c2', relationship: ' ' }).success, false);
	assert.equal(
		addRelationshipSchema.safeParse({ relatedId: 'c2', relationship: 'spouse' }).success,
		true,
	);
});

test('referral codes are create-only: update rejects a referral-only body', async () => {
	const { createCustomerSchema, updateCustomerSchema } = await import('../schemas');
	assert.equal(createCustomerSchema.safeParse({ referralCode: 'REF-1' }).success, true);
	// Unknown keys are stripped, so a referral-only update fails the
	// at-least-one-field refinement instead of 200-OK doing nothing.
	assert.equal(updateCustomerSchema.safeParse({ referralCode: 'REF-1' }).success, false);
	assert.equal(updateCustomerSchema.safeParse({ firstName: 'Ada' }).success, true);
});
