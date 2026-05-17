import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { IStoreAdapter } from '@fonderie-js/store';
import { EVENT_KEYS } from '../config';
import { toCustomerDTO } from '../dtos/customer';
import { CustomersModule } from '../module';
import type { ICustomer } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const CUSTOMER: ICustomer = {
	id: 'cust-1',
	workspaceId: 'ws-1',
	type: 'individual',
	firstName: 'Jane',
	lastName: 'Doe',
	companyName: null,
	jobTitle: null,
	avatarUrl: null,
	locale: 'en-US',
	referenceCode: null,
	isArchived: false,
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
	assert.equal(new CustomersModule({} as never).name, '@fonderie-js/customers');
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
	assert.ok(EVENT_KEYS.customerArchived);
	assert.ok(EVENT_KEYS.customerUpdated);
	assert.ok(EVENT_KEYS.customerDeleted);
	assert.ok(EVENT_KEYS.customerRestored);
});

// ── toCustomerDTO ─────────────────────────────────────────────────────────────

test('toCustomerDTO: maps all fields correctly', () => {
	const dto = toCustomerDTO(CUSTOMER);
	assert.equal(dto.id, 'cust-1');
	assert.equal(dto.workspaceId, 'ws-1');
	assert.equal(dto.type, 'individual');
	assert.equal(dto.firstName, 'Jane');
	assert.equal(dto.lastName, 'Doe');
	assert.equal(dto.companyName, '');
	assert.equal(dto.isArchived, false);
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
	const res = await ctrl.list(makeCtx({ workspaceId: 'ws-1' }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMERS_FETCHED');
	assert.ok(Array.isArray(body.result.customers));
});

test('customerController.create: 422 when type is invalid', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(makeCtx({ workspaceId: 'ws-1', body: { type: 'corporation' } }));
	assert.equal(res.status, 422);
});

test('customerController.create: 201 with customer DTO', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(
		makeCtx({
			workspaceId: 'ws-1',
			user: { id: 'user-1', email: 'a@b.com' },
			body: { firstName: 'Jane', lastName: 'Doe' },
		}),
	);
	assert.equal(res.status, 201);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_CREATED');
	assert.ok(body.result.customer);
	assert.equal(body.result.customer.id, 'cust-1');
});

test('customerController.get: 404 when customer not found', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: null }));
	const res = await ctrl.get(makeCtx({ workspaceId: 'ws-1', params: { id: 'missing' } }));
	assert.equal(res.status, 404);
});

test('customerController.delete: 404 when customer not found', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: null }));
	const res = await ctrl.delete(makeCtx({ workspaceId: 'ws-1', params: { id: 'missing' } }));
	assert.equal(res.status, 404);
});

test('customerController.archive: 200 on success', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.archive(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_ARCHIVED');
});

test('customerController.restore: 200 on success', async () => {
	const { customerController } = await import('../controllers/customer.controller');
	const ctrl = customerController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.restore(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'CUSTOMER_RESTORED');
});

// ── customerEmailController ───────────────────────────────────────────────────

test('customerEmailController.add: 422 when email missing', async () => {
	const { customerEmailController } = await import('../controllers/customer-email.controller');
	const ctrl = customerEmailController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' }, body: {} }));
	assert.equal(res.status, 422);
});

// ── customerPhoneController ───────────────────────────────────────────────────

test('customerPhoneController.add: 422 when phone missing', async () => {
	const { customerPhoneController } = await import('../controllers/customer-phone.controller');
	const ctrl = customerPhoneController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' }, body: {} }));
	assert.equal(res.status, 422);
});

// ── customerNoteController ────────────────────────────────────────────────────

test('customerNoteController.create: 422 when body missing', async () => {
	const { customerNoteController } = await import('../controllers/customer-note.controller');
	const ctrl = customerNoteController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.create(
		makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' }, body: {} }),
	);
	assert.equal(res.status, 422);
});

// ── customerTagController ─────────────────────────────────────────────────────

test('customerTagController.add: 422 when tag missing', async () => {
	const { customerTagController } = await import('../controllers/customer-tag.controller');
	const ctrl = customerTagController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.add(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' }, body: {} }));
	assert.equal(res.status, 422);
});

test('customerTagController.list: 200 with tags array', async () => {
	const { customerTagController } = await import('../controllers/customer-tag.controller');
	const ctrl = customerTagController(makeStore({ customer: CUSTOMER }));
	const res = await ctrl.list(makeCtx({ workspaceId: 'ws-1', params: { id: 'cust-1' } }));
	assert.equal(res.status, 200);
	const body = (await res.json()) as any;
	assert.ok(Array.isArray(body.result.tags));
});
