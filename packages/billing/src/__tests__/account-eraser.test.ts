import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';

import { getMigrationsPath } from '../migrations';
import { accountController } from '../controllers/account.controller';
import { accountEraser } from '../services/account-eraser';
import { createRecordedCustomer, latestRecordedCustomer } from '../services/provider-customers';

// What billing erases when an account is purged (deletion design Phase 4, D7,
// D8). Real PostgreSQL — the eraser reads billing's tables AND the workspaces
// brick's — and a recording fake provider that keeps each customer's email, so
// the compare-and-set on a surviving team's customer is exercised for real.
// Every id is fresh per test: CI runs all suites against one shared database.
//
//   BILLING_PG_URL=postgres://... npm test -w @fonderie/billing

const PG_URL = process.env['BILLING_PG_URL'];
const skip = PG_URL ? false : 'set BILLING_PG_URL to run';

// The workspaces and auth schemas, from source: billing cannot depend on
// @fonderie/workspaces (workspaces' tests depend on billing).
const PACKAGES = join(import.meta.dirname, '../../..');

type Call = { op: string; arg: unknown };
function fakeProvider(emails: Record<string, string | null>, opts: { gone?: string[]; fail?: Error } = {}) {
	const calls: Call[] = [];
	const live = new Map(Object.entries(emails));
	return {
		calls,
		live,
		provider: {
			name: 'fake',
			createCustomer: async (arg: { email: string }) => {
				const id = `cus_${randomUUID().slice(0, 8)}`;
				live.set(id, arg.email);
				calls.push({ op: 'createCustomer', arg });
				return { customerId: id };
			},
			deleteCustomer: async (id: string) => {
				calls.push({ op: 'deleteCustomer', arg: id });
				if (opts.fail) throw opts.fail;
				if (opts.gone?.includes(id) || !live.has(id)) {
					throw Object.assign(new Error(`No such customer: '${id}'`), { code: 'resource_missing' });
				}
				live.delete(id);
			},
			replaceCustomerEmail: async (arg: { customerId: string; email: string; replacement: string | null }) => {
				calls.push({ op: 'replaceCustomerEmail', arg });
				const cur = live.get(arg.customerId);
				if (cur === undefined || (cur ?? '').toLowerCase() !== arg.email.toLowerCase()) return false;
				live.set(arg.customerId, arg.replacement);
				return true;
			},
		},
	};
}

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, join(PACKAGES, 'auth/src/migrations/sql')).run();
	await new InternalMigrationRunner(store, join(PACKAGES, 'workspaces/src/migrations/sql')).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	return store;
}
type Store = Awaited<ReturnType<typeof connect>>;
const close = (store: unknown) => (store as { end?: () => Promise<void> }).end?.();

async function workspace(store: Store, owner: string, members: Array<{ id: string; removed?: boolean; suspended?: boolean }>, email: string | null = null) {
	const id = randomUUID();
	await store.query(
		`INSERT INTO fonderie_workspaces (id, name, slug, owner_id, email) VALUES ($1, 'Acme', $2, $3, $4)`,
		[id, `erase-${id}`, owner, email],
	);
	const [role] = await store.query<{ id: string }>(`SELECT id FROM fonderie_roles WHERE name = 'ADMIN' AND workspace_id IS NULL`);
	for (const m of [{ id: owner }, ...members]) {
		await store.query(
			`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed, removed, suspended) VALUES ($1, $2, $3, true, $4, $5)`,
			[m.id, id, role!.id, m.removed ?? false, (m as { suspended?: boolean }).suspended ?? false],
		);
	}
	return id;
}

async function subscription(store: Store, type: 'user' | 'workspace', id: string, customer: string) {
	await store.query(
		`INSERT INTO fonderie_subscriptions (subscriber_type, subscriber_id, plan, interval, status, provider_customer_id, provider_subscription_id)
		 VALUES ($1, $2, 'pro', 'month', 'active', $3, $4)`,
		[type, id, customer, `sub_${customer}`],
	);
}

async function recorded(store: Store, type: 'user' | 'workspace', id: string, customer: string, createdBy: string | null) {
	await store.query(
		`INSERT INTO fonderie_billing_customers (provider, provider_customer_id, subscriber_type, subscriber_id, created_by)
		 VALUES ('fake', $1, $2, $3, $4)`,
		[customer, type, id, createdBy],
	);
}

test('erasure deletes the customers that go with the person, takes their email off the ones that survive them, and keeps the money records', {
	skip,
}, async () => {
	const store = await connect();
	try {
		const gone = randomUUID();
		const colleague = randomUUID();
		const email = 'gone@acme.example';
		const k = randomUUID().slice(0, 8);
		const cus = (n: string) => `cus_${n}_${k}`;

		// Their own: a subscription customer, a wallet customer, and one created
		// for card setup with the wallet off — recorded nowhere else.
		await subscription(store, 'user', gone, cus('user_sub'));
		await store.query(
			`INSERT INTO fonderie_wallet_customers (subscriber_type, subscriber_id, provider, provider_customer_id) VALUES ('user', $1, 'fake', $2)`,
			[gone, cus('user_wallet')],
		);
		await recorded(store, 'user', gone, cus('user_setup'), gone);
		// A workspace they own alone (the workspaces eraser deletes it), from before the record existed.
		const solo = await workspace(store, gone, []);
		await subscription(store, 'workspace', solo, cus('solo'));
		// A team they own whose only other member is herself awaiting deletion: goes too.
		const ghostMember = randomUUID();
		await store.query(
			`INSERT INTO fonderie_users (id, email, deleted_at) VALUES ($1, $2, now())`,
			[ghostMember, `ghost-${k}@acme.example`],
		);
		const ghostTeam = await workspace(store, gone, [{ id: ghostMember }]);
		await subscription(store, 'workspace', ghostTeam, cus('ghost_team'));
		// A colleague's team they belong to; they paid for it with their email.
		const team = await workspace(store, colleague, [{ id: gone }], 'billing@acme.example');
		await subscription(store, 'workspace', team, cus('team'));
		await recorded(store, 'workspace', team, cus('team'), gone);
		// A team they handed over and left; its customer still carries their email.
		const handedOver = await workspace(store, colleague, [{ id: gone, removed: true }]);
		await recorded(store, 'workspace', handedOver, cus('handed_over'), gone);
		// A workspace already deleted, whose customer they created.
		await recorded(store, 'workspace', randomUUID(), cus('ws_deleted'), gone);
		// Someone else's team they have nothing to do with.
		const other = await workspace(store, colleague, []);
		await subscription(store, 'workspace', other, cus('bystander'));
		await recorded(store, 'workspace', other, cus('bystander'), colleague);

		const { provider, calls, live } = fakeProvider({
			[cus('user_sub')]: email,
			[cus('user_wallet')]: email,
			[cus('user_setup')]: email,
			[cus('solo')]: email,
			[cus('ghost_team')]: email,
			[cus('team')]: 'GONE@acme.example',
			[cus('handed_over')]: email,
			[cus('ws_deleted')]: email,
			[cus('bystander')]: 'colleague@acme.example',
		});
		const eraser = accountEraser(store as never, { provider: provider as never });
		assert.equal(eraser.name, 'billing');
		const out = await eraser.erase({ userId: gone, email, phone: null });

		const deleted = calls.filter((c) => c.op === 'deleteCustomer').map((c) => c.arg).sort();
		assert.deepEqual(
			deleted,
			[cus('ghost_team'), cus('solo'), cus('user_setup'), cus('user_sub'), cus('user_wallet'), cus('ws_deleted')].sort(),
			'their own customers + the workspaces that go with them, each once',
		);
		const relabeled = calls.filter((c) => c.op === 'replaceCustomerEmail').map((c) => c.arg);
		assert.deepEqual(
			relabeled.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
			[
				{ customerId: cus('handed_over'), email, replacement: null },
				{ customerId: cus('team'), email, replacement: 'billing@acme.example' },
			],
			"a surviving team's customer is never deleted: their email goes, the business email (when there is one) replaces it",
		);
		assert.equal(live.get(cus('team')), 'billing@acme.example');
		assert.equal(live.get(cus('handed_over')), null);
		assert.equal(live.get(cus('bystander')), 'colleague@acme.example', 'a bystander customer is untouched');
		assert.ok(!calls.some((c) => JSON.stringify(c.arg).includes(cus('bystander'))), 'no provider call names the bystander');
		assert.equal(out.erased, 8, '6 deleted + 2 emails replaced');
		assert.match(out.kept ?? '', /financial records/);
		assert.match(out.kept ?? '', /workspace survives/);

		// Money records stay, untouched (D8).
		const subs = await store.query<{ n: number }>(
			`SELECT count(*)::int AS n FROM fonderie_subscriptions WHERE subscriber_id = ANY($1::uuid[])`,
			[[gone, solo, ghostTeam, team]],
		);
		assert.equal(subs[0]?.n, 4);

		// Idempotent: the purge retries the whole fan-out when a later brick fails.
		calls.length = 0;
		const again = await eraser.erase({ userId: gone, email, phone: null });
		assert.deepEqual(calls.filter((c) => c.op === 'deleteCustomer'), [], 'a deleted customer is not asked for again');
		assert.equal(again.erased, 0, 'nothing left to erase');
	} finally {
		await close(store);
	}
});

test('a customer already gone at the provider is success; a real failure throws so the purge retries', { skip }, async () => {
	const store = await connect();
	try {
		const gone = randomUUID();
		const k = randomUUID().slice(0, 8);
		await subscription(store, 'user', gone, `cus_a_${k}`);

		const { provider } = fakeProvider({}, { gone: [`cus_a_${k}`] });
		const out = await accountEraser(store as never, { provider: provider as never }).erase({ userId: gone, email: null, phone: null });
		assert.equal(out.erased, 1);

		const gone2 = randomUUID();
		await subscription(store, 'user', gone2, `cus_b_${k}`);
		const failing = fakeProvider({ [`cus_b_${k}`]: 'x@acme.example' }, { fail: new Error('provider unavailable') });
		await assert.rejects(
			accountEraser(store as never, { provider: failing.provider as never }).erase({ userId: gone2, email: null, phone: null }),
			/provider unavailable/,
		);
		const [row] = await store.query<{ erased: Date | null }>(
			`SELECT erased_at AS erased FROM fonderie_billing_customers WHERE provider_customer_id = $1`,
			[`cus_b_${k}`],
		);
		assert.equal(row, undefined, 'a failed delete is not recorded as erased — the retry asks again');
	} finally {
		await close(store);
	}
});

test('negative: someone billing never saw erases nothing, and a provider without the capabilities says what it kept', { skip }, async () => {
	const store = await connect();
	try {
		const { provider, calls } = fakeProvider({});
		const out = await accountEraser(store as never, { provider: provider as never }).erase({ userId: randomUUID(), email: 'nobody@acme.example', phone: null });
		assert.equal(out.erased, 0);
		assert.deepEqual(calls, []);

		const gone = randomUUID();
		const colleague = randomUUID();
		const k = randomUUID().slice(0, 8);
		await subscription(store, 'user', gone, `cus_own_${k}`);
		const team = await workspace(store, colleague, [{ id: gone }]);
		await recorded(store, 'workspace', team, `cus_team_${k}`, gone);
		const bare = await accountEraser(store as never, { provider: { name: 'fake' } }).erase({ userId: gone, email: 'gone@acme.example', phone: null });
		assert.equal(bare.erased, 0);
		assert.match(bare.kept ?? '', /cannot delete customers/);
		assert.match(bare.kept ?? '', /cannot change a customer's email/);
	} finally {
		await close(store);
	}
});

test('every customer billing creates is recorded with who created it', { skip }, async () => {
	const store = await connect();
	try {
		const user = randomUUID();
		const { provider } = fakeProvider({});
		const { customerId } = await createRecordedCustomer(store as never, provider as never, {
			email: 'new@acme.example',
			subscriberType: 'user',
			subscriberId: user,
			userId: user,
		});
		const [row] = await store.query<{ createdBy: string }>(
			`SELECT created_by AS "createdBy" FROM fonderie_billing_customers WHERE provider_customer_id = $1`,
			[customerId],
		);
		assert.equal(row?.createdBy, user);
		assert.equal(await latestRecordedCustomer(store as never, 'fake', { type: 'user', id: user }), customerId);
	} finally {
		await close(store);
	}
});

test('wallet off: the customer card setup creates is found again when the card is saved, and is recorded for erasure', { skip }, async () => {
	// Before the record, setup created a customer nothing pointed at: save
	// answered 422 NO_CUSTOMER and the customer (with the email) was lost.
	const store = await connect();
	try {
		const user = randomUUID();
		const { provider, calls } = fakeProvider({});
		const config = {
			provider: {
				...provider,
				createSetupIntent: async () => ({ clientSecret: 'seti_secret', setupIntentId: 'seti_1' }),
				setDefaultPaymentMethod: async (arg: unknown) => void calls.push({ op: 'setDefault', arg }),
				getPaymentMethod: async () => null,
			},
			successUrl: 's',
			cancelUrl: 'c',
			plans: [{ name: 'free' }],
		};
		const ctx = (body: Record<string, unknown> = {}) =>
			({ meta: { body }, user: { id: user, email: 'card@acme.example' }, workspace: null, tenant: null, request: new Request('http://localhost/') }) as never;
		const ctrl = accountController(store as never, config as never);
		assert.equal((await ctrl.setupPaymentMethod(ctx())).status, 200);
		assert.equal((await ctrl.setupPaymentMethod(ctx())).status, 200);
		assert.equal(calls.filter((c) => c.op === 'createCustomer').length, 1, 'a second setup reuses the customer');
		const saved = await ctrl.savePaymentMethod(ctx({ paymentMethodId: 'pm_1' }));
		assert.equal(saved.status, 200);
		const created = calls.find((c) => c.op === 'createCustomer');
		const customerId = await latestRecordedCustomer(store as never, 'fake', { type: 'user', id: user });
		assert.deepEqual(calls.find((c) => c.op === 'setDefault')?.arg, { customerId, paymentMethodId: 'pm_1' });
		assert.ok(created && customerId);

		const out = await accountEraser(store as never, { provider: provider as never }).erase({ userId: user, email: 'card@acme.example', phone: null });
		assert.equal(out.erased, 1);
		assert.ok(calls.some((c) => c.op === 'deleteCustomer' && c.arg === customerId), 'the erasure reaches it');
	} finally {
		await close(store);
	}
});

test('billing decides "this workspace goes" by the workspaces eraser\'s rule: a suspended or account-less member does not keep it', { skip }, async () => {
	const store = await connect();
	try {
		const gone = randomUUID();
		const k = randomUUID().slice(0, 8);
		// The only other member is suspended — the workspaces eraser deletes this workspace…
		const suspended = randomUUID();
		await store.query(`INSERT INTO fonderie_users (id, email) VALUES ($1, $2)`, [suspended, `susp-${k}@acme.example`]);
		const team = await workspace(store, gone, [{ id: suspended, suspended: true }]);
		await subscription(store, 'workspace', team, `cus_susp_${k}`);
		// …and so is one whose only other membership has no account at all.
		const ghost = await workspace(store, gone, [{ id: randomUUID() }]);
		await subscription(store, 'workspace', ghost, `cus_ghost_${k}`);
		const { provider, calls } = fakeProvider({ [`cus_susp_${k}`]: 'gone@acme.example', [`cus_ghost_${k}`]: 'gone@acme.example' });
		await accountEraser(store, { provider }).erase({ userId: gone, email: 'gone@acme.example', phone: null });
		const deleted = calls.filter((c) => c.op === 'deleteCustomer').map((c) => c.arg);
		assert.ok(deleted.includes(`cus_susp_${k}`), 'goes with the account, so its provider customer goes too');
		assert.ok(deleted.includes(`cus_ghost_${k}`));
	} finally {
		await close(store);
	}
});
