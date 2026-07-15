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
